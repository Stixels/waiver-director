import { ConvexError, v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query
} from './_generated/server';
import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { Resend } from 'resend';
import { internal } from './_generated/api';
import { requireWorkspaceMember } from './lib/waivers';
import { escapeHtml, sanitizeRichTextHtml } from '../lib/utils/rich-text';

const DEFAULT_SEND_AFTER_AMOUNT = 2;
const DEFAULT_SEND_AFTER_UNIT = 'hours' as const;
const DEFAULT_SUBJECT = 'Thank you for visiting, {{customer_name}}!';
const DEFAULT_BODY =
	"<p>Hi {{customer_name}},</p><p>We wanted to take a moment to thank you for your recent visit. It was a pleasure having you with us!</p><p>Would you mind taking 30 seconds to share your experience with us? We'd love to hear how we did.</p>";
const EMAIL_TEMPLATE_LIMIT = 100;
const FOLLOW_UP_STATS_LIMIT = 1000;
const REPLY_TO_VERIFICATION_TTL_MS = 15 * 60 * 1000;
const REPLY_TO_VERIFICATION_MAX_ATTEMPTS = 5;
const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const followUpStatusValue = v.union(
	v.literal('queued'),
	v.literal('sent'),
	v.literal('cancelled'),
	v.literal('paused'),
	v.literal('failed')
);

const sendAfterUnitValue = v.union(v.literal('minutes'), v.literal('hours'), v.literal('days'));
type SendAfterUnit = 'minutes' | 'hours' | 'days';

function bytesToHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
	return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function verificationCodeHash(args: { email: string; code: string }) {
	return sha256(`${args.email}:${args.code}`);
}

function verificationCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(4));
	const value = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
	return String(value % 1_000_000).padStart(6, '0');
}

function normalizeReplyToEmail(value: string): string {
	const email = value.trim().toLowerCase();
	if (!EMAIL_ADDRESS_REGEX.test(email)) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'Enter a valid reply-to email address.'
		});
	}
	return email;
}

function configuredFromEmail(): string | null {
	return process.env.RESEND_FROM_EMAIL?.trim() || null;
}

function canSendWorkspaceEmail(settings: Doc<'workspace_email_settings'> | null): boolean {
	return Boolean(configuredFromEmail() && settings?.replyToEmail && settings.replyToVerifiedAt);
}

function requireFromEmail(): string {
	const fromAddress = configuredFromEmail();
	if (!fromAddress) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'RESEND_FROM_EMAIL is not set.'
		});
	}
	return fromAddress;
}

function emailDisplayName(value: string): string {
	return (
		value
			.replace(/[\r\n<>]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim() || 'Waiver'
	);
}

function friendlyFromAddress(displayName: string, email: string): string {
	const escapedName = emailDisplayName(displayName).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `"${escapedName}" <${email}>`;
}

async function requireWorkspaceVerifiedReplyTo(
	ctx: Pick<QueryCtx, 'db'>,
	workspaceId: Doc<'workspaces'>['_id']
) {
	if (!configuredFromEmail()) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'RESEND_FROM_EMAIL is not set.'
		});
	}

	const settings = await ctx.db
		.query('workspace_email_settings')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.unique();

	if (!settings?.replyToEmail || !settings.replyToVerifiedAt) {
		throw new ConvexError({
			code: 'reply_to_not_verified',
			message: 'Verify a reply-to email before sending follow-ups.'
		});
	}

	return settings.replyToEmail;
}

function sendAfterToMs(amount: number, unit: SendAfterUnit) {
	if (unit === 'minutes') return amount * 60 * 1000;
	if (unit === 'hours') return amount * 60 * 60 * 1000;
	return amount * 24 * 60 * 60 * 1000;
}

function validateEmailTemplateInput(args: {
	subject: string;
	body: string;
	sendAfterAmount: number;
	sendAfterUnit: SendAfterUnit;
}): string {
	if (args.subject.trim().length === 0) {
		throw new ConvexError({ code: 'invalid_argument', message: 'Subject is required.' });
	}
	const body = sanitizeRichTextHtml(args.body);
	if (body.length === 0) {
		throw new ConvexError({ code: 'invalid_argument', message: 'Email body is required.' });
	}
	if (!Number.isInteger(args.sendAfterAmount) || args.sendAfterAmount < 1) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'Send after must be a positive whole number.'
		});
	}
	return body;
}

async function resolveFollowUpBookingNumber(
	ctx: Pick<QueryCtx, 'db'>,
	followUp: Doc<'email_follow_ups'>
) {
	const submission = await ctx.db.get(followUp.submissionId);
	if (!submission || submission.workspaceId !== followUp.workspaceId) return null;
	return submission.bookingSnapshot?.providerBookingId ?? null;
}

async function withResolvedBookingNumber(
	ctx: Pick<QueryCtx, 'db'>,
	followUp: Doc<'email_follow_ups'>
) {
	const bookingNumber = await resolveFollowUpBookingNumber(ctx, followUp);
	return bookingNumber ? { ...followUp, bookingNumber } : followUp;
}

export const getEmailEditorContent = query({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const editorContent = await ctx.db
			.query('email_editor_content')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		if (editorContent) {
			return {
				_id: editorContent._id,
				workspaceId: editorContent.workspaceId,
				subject: editorContent.subject,
				body: editorContent.body,
				sendAfterAmount: editorContent.sendAfterAmount,
				sendAfterUnit: editorContent.sendAfterUnit,
				updatedAt: editorContent.updatedAt,
				isDefault: false as const
			};
		}

		return {
			workspaceId: args.workspaceId,
			subject: DEFAULT_SUBJECT,
			body: DEFAULT_BODY,
			sendAfterAmount: DEFAULT_SEND_AFTER_AMOUNT,
			sendAfterUnit: DEFAULT_SEND_AFTER_UNIT,
			isDefault: true as const
		};
	}
});

export const getWorkspaceEmailSenderSettings = query({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const workspace = await ctx.db.get(args.workspaceId);
		const settings = await ctx.db
			.query('workspace_email_settings')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();
		const platformFromEmail = configuredFromEmail();

		return {
			workspaceId: args.workspaceId,
			platformFromEmail,
			fromPreview:
				workspace && platformFromEmail
					? friendlyFromAddress(workspace.name, platformFromEmail)
					: null,
			replyToEmail: settings?.replyToEmail ?? null,
			replyToVerifiedAt: settings?.replyToVerifiedAt ?? null,
			pendingReplyToEmail: settings?.pendingReplyToEmail ?? null,
			verificationCodeExpiresAt: settings?.verificationCodeExpiresAt ?? null,
			canSendEmails: canSendWorkspaceEmail(settings)
		};
	}
});

export const startReplyToVerification = action({
	args: {
		workspaceId: v.id('workspaces'),
		replyToEmail: v.string()
	},
	handler: async (ctx, args) => {
		const email = normalizeReplyToEmail(args.replyToEmail);
		const workspace: { name: string } = await ctx.runQuery(
			internal.emails.getWorkspaceForEmailAction,
			{ workspaceId: args.workspaceId }
		);
		const code = verificationCode();
		const codeHash = await verificationCodeHash({ email, code });
		const now = Date.now();
		const expiresAt = now + REPLY_TO_VERIFICATION_TTL_MS;

		const apiKey = process.env.RESEND_API_KEY;
		if (!apiKey) {
			throw new ConvexError({
				code: 'invalid_configuration',
				message: 'RESEND_API_KEY is not set.'
			});
		}

		const resend = new Resend(apiKey);
		const from = friendlyFromAddress(workspace.name, requireFromEmail());
		const { error } = await resend.emails.send({
			from,
			to: email,
			subject: 'Verify your reply-to email',
			html: `<p>Use this code to verify ${escapeHtml(email)} as your reply-to email:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 15 minutes.</p>`,
			text: `Use this code to verify ${email} as your reply-to email: ${code}\n\nThis code expires in 15 minutes.`
		});

		if (error) throw new Error(error.message);

		await ctx.runMutation(internal.emails.storeReplyToVerification, {
			workspaceId: args.workspaceId,
			replyToEmail: email,
			verificationCodeHash: codeHash,
			verificationCodeExpiresAt: expiresAt,
			verificationCodeSentAt: now
		});
		return null;
	}
});

export const confirmReplyToVerification = action({
	args: {
		workspaceId: v.id('workspaces'),
		code: v.string()
	},
	handler: async (ctx, args) => {
		const pending: { pendingReplyToEmail: string } = await ctx.runQuery(
			internal.emails.getPendingReplyToVerification,
			{ workspaceId: args.workspaceId }
		);
		const code = args.code.trim().replace(/\s+/g, '');
		if (!/^\d{6}$/.test(code)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter the 6-digit verification code.'
			});
		}

		await ctx.runMutation(internal.emails.confirmReplyToVerificationWithHash, {
			workspaceId: args.workspaceId,
			verificationCodeHash: await verificationCodeHash({
				email: pending.pendingReplyToEmail,
				code
			})
		});
		return null;
	}
});

export const cancelReplyToVerification = mutation({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const settings = await ctx.db
			.query('workspace_email_settings')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		if (!settings?.pendingReplyToEmail) return;

		await ctx.db.patch(settings._id, {
			pendingReplyToEmail: undefined,
			verificationCodeHash: undefined,
			verificationCodeExpiresAt: undefined,
			verificationCodeSentAt: undefined,
			verificationAttempts: 0,
			updatedAt: Date.now()
		});
	}
});

export const upsertEmailEditorContent = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		subject: v.string(),
		body: v.string(),
		sendAfterAmount: v.number(),
		sendAfterUnit: sendAfterUnitValue
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const subject = args.subject.trim();
		const body = validateEmailTemplateInput(args);

		const existing = await ctx.db
			.query('email_editor_content')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				subject,
				body,
				sendAfterAmount: args.sendAfterAmount,
				sendAfterUnit: args.sendAfterUnit,
				updatedAt: now
			});
		} else {
			await ctx.db.insert('email_editor_content', {
				workspaceId: args.workspaceId,
				subject,
				body,
				sendAfterAmount: args.sendAfterAmount,
				sendAfterUnit: args.sendAfterUnit,
				updatedAt: now
			});
		}
	}
});

export const listEmailTemplates = query({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const templates = await ctx.db
			.query('email_templates')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.order('desc')
			.take(EMAIL_TEMPLATE_LIMIT);

		return templates.map((template) => ({
			_id: template._id,
			workspaceId: template.workspaceId,
			name: template.name,
			subject: template.subject,
			body: template.body,
			sendAfterAmount: template.sendAfterAmount,
			sendAfterUnit: template.sendAfterUnit,
			createdAt: template.createdAt
		}));
	}
});

export const saveEmailTemplate = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		name: v.string(),
		subject: v.string(),
		body: v.string(),
		sendAfterAmount: v.number(),
		sendAfterUnit: sendAfterUnitValue
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const subject = args.subject.trim();
		const body = validateEmailTemplateInput(args);

		if (args.name.trim().length === 0) {
			throw new ConvexError({ code: 'invalid_argument', message: 'Template name is required.' });
		}

		return await ctx.db.insert('email_templates', {
			workspaceId: args.workspaceId,
			name: args.name.trim(),
			subject,
			body,
			sendAfterAmount: args.sendAfterAmount,
			sendAfterUnit: args.sendAfterUnit,
			createdAt: Date.now()
		});
	}
});

export const deleteEmailTemplate = mutation({
	args: { templateId: v.id('email_templates') },
	handler: async (ctx, args) => {
		const template = await ctx.db.get(args.templateId);
		if (!template) throw new ConvexError({ code: 'not_found', message: 'Template not found.' });
		await requireWorkspaceMember(ctx, template.workspaceId);
		await ctx.db.delete(args.templateId);
	}
});

export const getFollowUpStats = query({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const queued = await ctx.db
			.query('email_follow_ups')
			.withIndex('by_workspaceId_and_status', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('status', 'queued')
			)
			.take(FOLLOW_UP_STATS_LIMIT);

		const sent = await ctx.db
			.query('email_follow_ups')
			.withIndex('by_workspaceId_and_status_and_sentAt', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('status', 'sent')
			)
			.order('desc')
			.take(FOLLOW_UP_STATS_LIMIT);

		const todayStartTime = todayStart.getTime();
		let sentToday = 0;
		for (const followUp of sent) {
			if (!followUp.sentAt) continue;
			if (followUp.sentAt < todayStartTime) break;
			sentToday++;
		}

		return {
			sentToday,
			pendingCount: queued.length,
			// This total is capped by FOLLOW_UP_STATS_LIMIT. Use a persisted counter if this needs
			// to stay exact after a workspace has more sent follow-ups than the read limit.
			totalSent: sent.length
		};
	}
});

export const listFollowUps = query({
	args: {
		workspaceId: v.id('workspaces'),
		paginationOpts: paginationOptsValidator,
		statuses: v.optional(v.array(followUpStatusValue)),
		searchQuery: v.optional(v.string()),
		dateFrom: v.optional(v.number()),
		dateTo: v.optional(v.number())
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const statuses = args.statuses ?? [];
		const searchQuery = args.searchQuery?.trim();
		const dateFrom = args.dateFrom;
		const dateTo = args.dateTo;

		if (searchQuery) {
			let q = ctx.db
				.query('email_follow_ups')
				.withSearchIndex('search_follow_ups', (q) =>
					q.search('searchText', searchQuery).eq('workspaceId', args.workspaceId)
				);

			if (statuses.length > 0) {
				q = q.filter((q) => q.or(...statuses.map((status) => q.eq(q.field('status'), status))));
			}
			if (dateFrom !== undefined) {
				q = q.filter((q) => q.gte(q.field('submittedAt'), dateFrom));
			}
			if (dateTo !== undefined) {
				q = q.filter((q) => q.lt(q.field('submittedAt'), dateTo));
			}

			const result = await q.paginate(args.paginationOpts);
			return {
				...result,
				page: await Promise.all(
					result.page.map((followUp) => withResolvedBookingNumber(ctx, followUp))
				)
			};
		}

		const followUpsQuery =
			statuses.length === 1
				? ctx.db
						.query('email_follow_ups')
						.withIndex('by_workspaceId_and_status', (q) =>
							q.eq('workspaceId', args.workspaceId).eq('status', statuses[0])
						)
				: ctx.db
						.query('email_follow_ups')
						.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId));

		let q = followUpsQuery.order('desc');

		if (statuses.length > 1) {
			q = q.filter((q) => q.or(...statuses.map((status) => q.eq(q.field('status'), status))));
		}
		if (dateFrom !== undefined) {
			q = q.filter((q) => q.gte(q.field('submittedAt'), dateFrom));
		}
		if (dateTo !== undefined) {
			q = q.filter((q) => q.lt(q.field('submittedAt'), dateTo));
		}

		const result = await q.paginate(args.paginationOpts);
		return {
			...result,
			page: await Promise.all(
				result.page.map((followUp) => withResolvedBookingNumber(ctx, followUp))
			)
		};
	}
});

export const cancelFollowUp = mutation({
	args: { followUpId: v.id('email_follow_ups') },
	handler: async (ctx, args) => {
		const followUp = await ctx.db.get(args.followUpId);
		if (!followUp) {
			throw new ConvexError({ code: 'not_found', message: 'Follow-up not found.' });
		}

		await requireWorkspaceMember(ctx, followUp.workspaceId);

		if (followUp.status !== 'queued') {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Only queued follow-ups can be cancelled.'
			});
		}

		if (followUp.scheduledFunctionId) {
			try {
				await ctx.scheduler.cancel(followUp.scheduledFunctionId);
			} catch {
				// Already ran or was already cancelled
			}
		}

		await ctx.db.patch(args.followUpId, {
			status: 'cancelled',
			cancelledAt: Date.now()
		});
	}
});

export const sendFollowUpNow = mutation({
	args: { followUpId: v.id('email_follow_ups') },
	handler: async (ctx, args) => {
		const followUp = await ctx.db.get(args.followUpId);
		if (!followUp) {
			throw new ConvexError({ code: 'not_found', message: 'Follow-up not found.' });
		}

		await requireWorkspaceMember(ctx, followUp.workspaceId);
		await requireWorkspaceVerifiedReplyTo(ctx, followUp.workspaceId);

		if (!['queued', 'paused', 'cancelled', 'failed'].includes(followUp.status)) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Follow-up cannot be sent.'
			});
		}

		if (followUp.scheduledFunctionId) {
			try {
				await ctx.scheduler.cancel(followUp.scheduledFunctionId);
			} catch {
				// Already ran
			}
		}

		const scheduledFunctionId = await ctx.scheduler.runAfter(
			0,
			internal.emails.deliverFollowUpEmail,
			{ followUpId: args.followUpId }
		);

		await ctx.db.patch(args.followUpId, {
			scheduledFunctionId,
			status: 'queued',
			cancelledAt: undefined
		});
	}
});

export const sendSelected = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		followUpIds: v.array(v.id('email_follow_ups'))
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		await requireWorkspaceVerifiedReplyTo(ctx, args.workspaceId);
		for (const followUpId of args.followUpIds) {
			const followUp = await ctx.db.get(followUpId);
			if (!followUp || followUp.workspaceId !== args.workspaceId) continue;
			if (!['queued', 'paused', 'cancelled', 'failed'].includes(followUp.status)) continue;
			if (followUp.scheduledFunctionId) {
				try {
					await ctx.scheduler.cancel(followUp.scheduledFunctionId);
				} catch {
					// Already completed or cancelled; ignore.
				}
			}
			const scheduledFunctionId = await ctx.scheduler.runAfter(
				0,
				internal.emails.deliverFollowUpEmail,
				{ followUpId }
			);
			await ctx.db.patch(followUpId, {
				scheduledFunctionId,
				status: 'queued',
				cancelledAt: undefined
			});
		}
	}
});

export const cancelSelected = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		followUpIds: v.array(v.id('email_follow_ups'))
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const now = Date.now();
		for (const followUpId of args.followUpIds) {
			const followUp = await ctx.db.get(followUpId);
			if (!followUp || followUp.workspaceId !== args.workspaceId) continue;
			if (followUp.status !== 'queued') continue;
			if (followUp.scheduledFunctionId) {
				try {
					await ctx.scheduler.cancel(followUp.scheduledFunctionId);
				} catch {
					// Already completed or cancelled; ignore.
				}
			}
			await ctx.db.patch(followUpId, { status: 'cancelled', cancelledAt: now });
		}
	}
});

// ─── Internal functions ───────────────────────────────────────────────────────

export const getWorkspaceForEmailAction = internalQuery({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}
		return { name: workspace.name };
	}
});

export const storeReplyToVerification = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		replyToEmail: v.string(),
		verificationCodeHash: v.string(),
		verificationCodeExpiresAt: v.number(),
		verificationCodeSentAt: v.number()
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const existing = await ctx.db
			.query('workspace_email_settings')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();
		const now = Date.now();
		const patch = {
			pendingReplyToEmail: args.replyToEmail,
			verificationCodeHash: args.verificationCodeHash,
			verificationCodeExpiresAt: args.verificationCodeExpiresAt,
			verificationCodeSentAt: args.verificationCodeSentAt,
			verificationAttempts: 0,
			updatedAt: now
		};

		if (existing) {
			await ctx.db.patch(existing._id, patch);
		} else {
			await ctx.db.insert('workspace_email_settings', {
				workspaceId: args.workspaceId,
				pendingReplyToEmail: args.replyToEmail,
				verificationCodeHash: args.verificationCodeHash,
				verificationCodeExpiresAt: args.verificationCodeExpiresAt,
				verificationCodeSentAt: args.verificationCodeSentAt,
				verificationAttempts: 0,
				updatedAt: now
			});
		}
	}
});

export const getPendingReplyToVerification = internalQuery({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const settings = await ctx.db
			.query('workspace_email_settings')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		if (!settings?.pendingReplyToEmail || !settings.verificationCodeHash) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Request a new verification code first.'
			});
		}
		if (
			settings.verificationCodeExpiresAt !== undefined &&
			settings.verificationCodeExpiresAt < Date.now()
		) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Verification code expired. Request a new code.'
			});
		}
		if (settings.verificationAttempts >= REPLY_TO_VERIFICATION_MAX_ATTEMPTS) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Too many attempts. Request a new verification code.'
			});
		}

		return { pendingReplyToEmail: settings.pendingReplyToEmail };
	}
});

export const confirmReplyToVerificationWithHash = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		verificationCodeHash: v.string()
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const settings = await ctx.db
			.query('workspace_email_settings')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		if (!settings?.pendingReplyToEmail || !settings.verificationCodeHash) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Request a new verification code first.'
			});
		}
		if (
			settings.verificationCodeExpiresAt !== undefined &&
			settings.verificationCodeExpiresAt < Date.now()
		) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Verification code expired. Request a new code.'
			});
		}
		if (settings.verificationAttempts >= REPLY_TO_VERIFICATION_MAX_ATTEMPTS) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Too many attempts. Request a new verification code.'
			});
		}
		if (settings.verificationCodeHash !== args.verificationCodeHash) {
			await ctx.db.patch(settings._id, {
				verificationAttempts: settings.verificationAttempts + 1,
				updatedAt: Date.now()
			});
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Verification code is incorrect.'
			});
		}

		const now = Date.now();
		await ctx.db.patch(settings._id, {
			replyToEmail: settings.pendingReplyToEmail,
			replyToVerifiedAt: now,
			pendingReplyToEmail: undefined,
			verificationCodeHash: undefined,
			verificationCodeExpiresAt: undefined,
			verificationCodeSentAt: undefined,
			verificationAttempts: 0,
			updatedAt: now
		});
	}
});

export const getVerifiedReplyToForDelivery = internalQuery({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		const replyToEmail = await requireWorkspaceVerifiedReplyTo(ctx, args.workspaceId);
		return {
			workspaceName: workspace?.name ?? '',
			replyToEmail
		};
	}
});

export const scheduleFollowUpOnSubmission = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions'),
		signerName: v.string(),
		signerEmail: v.string(),
		submittedAt: v.number()
	},
	handler: async (ctx, args) => {
		const editorContent = await ctx.db
			.query('email_editor_content')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		const subjectTemplate = editorContent?.subject ?? DEFAULT_SUBJECT;
		const bodyTemplate = editorContent?.body ?? DEFAULT_BODY;
		const sendAfterMs = sendAfterToMs(
			editorContent?.sendAfterAmount ?? DEFAULT_SEND_AFTER_AMOUNT,
			editorContent?.sendAfterUnit ?? DEFAULT_SEND_AFTER_UNIT
		);
		const scheduledAt = args.submittedAt + sendAfterMs;
		const submission = await ctx.db.get(args.submissionId);
		const bookingNumber =
			submission?.workspaceId === args.workspaceId
				? submission.bookingSnapshot?.providerBookingId
				: undefined;
		const senderSettings = await ctx.db
			.query('workspace_email_settings')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();
		const canSend = canSendWorkspaceEmail(senderSettings);

		const followUpId = await ctx.db.insert('email_follow_ups', {
			workspaceId: args.workspaceId,
			submissionId: args.submissionId,
			signerName: args.signerName,
			signerEmail: args.signerEmail,
			searchText: [args.signerName, args.signerEmail, bookingNumber]
				.filter((value): value is string => Boolean(value && value.trim()))
				.join(' '),
			subjectTemplate,
			bodyTemplate,
			submittedAt: args.submittedAt,
			scheduledAt,
			status: canSend ? 'queued' : 'paused'
		});

		if (!canSend) return;

		const scheduledFunctionId = await ctx.scheduler.runAfter(
			sendAfterMs,
			internal.emails.deliverFollowUpEmail,
			{ followUpId }
		);

		await ctx.db.patch(followUpId, { scheduledFunctionId });
	}
});

export const getFollowUpForDelivery = internalQuery({
	args: { followUpId: v.id('email_follow_ups') },
	handler: async (ctx, args) => {
		const followUp = await ctx.db.get(args.followUpId);
		return followUp ? await withResolvedBookingNumber(ctx, followUp) : null;
	}
});

export const getTemplateForWorkspace = internalQuery({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		const editorContent = await ctx.db
			.query('email_editor_content')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		return {
			workspaceName: workspace?.name ?? '',
			subject: editorContent?.subject ?? DEFAULT_SUBJECT,
			body: editorContent?.body ?? DEFAULT_BODY,
			sendAfterAmount: editorContent?.sendAfterAmount ?? DEFAULT_SEND_AFTER_AMOUNT,
			sendAfterUnit: editorContent?.sendAfterUnit ?? DEFAULT_SEND_AFTER_UNIT
		};
	}
});

export const markFollowUpSent = internalMutation({
	args: {
		followUpId: v.id('email_follow_ups'),
		sentSubject: v.string(),
		sentBodyHtml: v.string(),
		sentFrom: v.string(),
		sentReplyTo: v.string(),
		resendMessageId: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const followUp = await ctx.db.get(args.followUpId);
		if (!followUp || followUp.status === 'sent' || followUp.status === 'failed') return;

		await ctx.db.patch(args.followUpId, {
			status: 'sent',
			sentAt: Date.now(),
			sentSubject: args.sentSubject,
			sentBodyHtml: args.sentBodyHtml,
			sentFrom: args.sentFrom,
			sentReplyTo: args.sentReplyTo,
			...(args.resendMessageId ? { resendMessageId: args.resendMessageId } : {})
		});
	}
});

export const markFollowUpFailed = internalMutation({
	args: {
		followUpId: v.id('email_follow_ups'),
		reason: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const followUp = await ctx.db.get(args.followUpId);
		if (!followUp || followUp.status === 'sent' || followUp.status === 'failed') return;

		await ctx.db.patch(args.followUpId, {
			status: 'failed',
			failedAt: Date.now(),
			failureReason: args.reason
		});
	}
});

export const markFollowUpPaused = internalMutation({
	args: {
		followUpId: v.id('email_follow_ups'),
		reason: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const followUp = await ctx.db.get(args.followUpId);
		if (!followUp || followUp.status === 'sent') return;

		await ctx.db.patch(args.followUpId, {
			status: 'paused',
			failureReason: args.reason,
			scheduledFunctionId: undefined
		});
	}
});

function resolveVariables(
	template: string,
	vars: { signerName: string; bookingId: string; businessName: string; activityDate: string }
): string {
	return template
		.replace(/\{\{customer_name\}\}|\{customer_name\}/g, vars.signerName)
		.replace(/\{\{booking_id\}\}|\{booking_id\}/g, vars.bookingId)
		.replace(/\{\{business_name\}\}|\{business_name\}/g, vars.businessName)
		.replace(/\{\{activity_date\}\}|\{activity_date\}/g, vars.activityDate);
}

function resolveHtmlVariables(
	template: string,
	vars: { signerName: string; bookingId: string; businessName: string; activityDate: string }
): string {
	return resolveVariables(template, {
		signerName: escapeHtml(vars.signerName),
		bookingId: escapeHtml(vars.bookingId),
		businessName: escapeHtml(vars.businessName),
		activityDate: escapeHtml(vars.activityDate)
	});
}

function decodeHtmlEntities(value: string): string {
	return value.replace(
		/&(#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos);/gi,
		(entity, _match, dec, hex) => {
			if (dec) return String.fromCodePoint(Number(dec));
			if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));

			switch (entity.toLowerCase()) {
				case '&amp;':
					return '&';
				case '&lt;':
					return '<';
				case '&gt;':
					return '>';
				case '&quot;':
					return '"';
				case '&apos;':
					return "'";
				default:
					return entity;
			}
		}
	);
}

function htmlTemplateToText(template: string): string {
	return decodeHtmlEntities(
		template
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s{2,}/g, ' ')
			.trim()
	);
}

function plainTextTemplateWithVariables(
	template: string,
	vars: { signerName: string; bookingId: string; businessName: string; activityDate: string }
): string {
	return resolveVariables(htmlTemplateToText(template), vars)
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function mergeInlineStyleAttributes(attributes: string | undefined, styles: string): string {
	const nextStyles = styles.trim().replace(/;$/, '');
	const sourceAttributes = attributes ?? '';
	const styleMatch = sourceAttributes.match(/\sstyle=(['"])(.*?)\1/i);
	const existingStyles = styleMatch?.[2]?.trim().replace(/;$/, '') ?? '';
	const mergedStyles = existingStyles ? `${existingStyles};${nextStyles}` : nextStyles;

	if (styleMatch) {
		return sourceAttributes.replace(styleMatch[0], ` style="${mergedStyles}"`);
	}

	return `${sourceAttributes} style="${mergedStyles}"`;
}

function applyEmailClientStyles(bodyHtml: string): string {
	return bodyHtml
		.replace(
			/<p(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<p${mergeInlineStyleAttributes(attributes, 'margin:0 0 16px 0;line-height:1.6;font-size:15px')}>`
		)
		.replace(
			/<h1(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<h1${mergeInlineStyleAttributes(attributes, 'margin:0 0 12px 0;font-size:24px;font-weight:700;line-height:1.3')}>`
		)
		.replace(
			/<h2(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<h2${mergeInlineStyleAttributes(attributes, 'margin:0 0 12px 0;font-size:20px;font-weight:700;line-height:1.3')}>`
		)
		.replace(
			/<h3(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<h3${mergeInlineStyleAttributes(attributes, 'margin:0 0 10px 0;font-size:17px;font-weight:700;line-height:1.3')}>`
		)
		.replace(
			/<h4(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<h4${mergeInlineStyleAttributes(attributes, 'margin:0 0 10px 0;font-size:15px;font-weight:700;line-height:1.4')}>`
		)
		.replace(
			/<h5(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<h5${mergeInlineStyleAttributes(attributes, 'margin:0 0 8px 0;font-size:14px;font-weight:700;line-height:1.4')}>`
		)
		.replace(
			/<h6(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<h6${mergeInlineStyleAttributes(attributes, 'margin:0 0 8px 0;font-size:13px;font-weight:700;line-height:1.4')}>`
		)
		.replace(
			/<ul(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<ul${mergeInlineStyleAttributes(attributes, 'margin:0 0 16px 0;padding-left:24px')}>`
		)
		.replace(
			/<ol(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<ol${mergeInlineStyleAttributes(attributes, 'margin:0 0 16px 0;padding-left:24px')}>`
		)
		.replace(
			/<li(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<li${mergeInlineStyleAttributes(attributes, 'margin:0 0 6px 0;line-height:1.6')}>`
		)
		.replace(
			/<img(\s[^>]*)?>/gi,
			(_match, attributes: string | undefined) =>
				`<img${mergeInlineStyleAttributes(attributes, 'max-width:100%;height:auto')}>`
		)
		.replace(/<a(\s[^>]*)?>/gi, (_match, attributes: string | undefined) => {
			const sourceAttributes = attributes ?? '';
			if (/data-email-role=(['"])button\1/i.test(sourceAttributes)) {
				return `<a${sourceAttributes}>`;
			}
			return `<a${mergeInlineStyleAttributes(attributes, 'color:#7c3aed;text-decoration:underline')}>`;
		});
}

export const deliverFollowUpEmail = internalAction({
	args: { followUpId: v.id('email_follow_ups') },
	handler: async (ctx, args) => {
		const followUp = await ctx.runQuery(internal.emails.getFollowUpForDelivery, {
			followUpId: args.followUpId
		});

		if (!followUp || followUp.status !== 'queued') return;

		const template = await ctx.runQuery(internal.emails.getTemplateForWorkspace, {
			workspaceId: followUp.workspaceId
		});
		let sender: { workspaceName: string; replyToEmail: string };
		try {
			sender = await ctx.runQuery(internal.emails.getVerifiedReplyToForDelivery, {
				workspaceId: followUp.workspaceId
			});
		} catch (err) {
			await ctx.runMutation(internal.emails.markFollowUpPaused, {
				followUpId: args.followUpId,
				reason:
					err instanceof Error ? err.message : 'Verify a reply-to email before sending follow-ups.'
			});
			return;
		}

		const followUpWithBooking = followUp as typeof followUp & { bookingNumber?: string };
		const bookingId = followUpWithBooking.bookingNumber
			? `#${followUpWithBooking.bookingNumber}`
			: '';
		const activityDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
			new Date(followUp.submittedAt)
		);

		const vars = {
			signerName: followUp.signerName,
			bookingId,
			businessName: template.workspaceName,
			activityDate
		};
		const subjectTemplate = followUp.subjectTemplate ?? template.subject;
		const bodyTemplate = sanitizeRichTextHtml(followUp.bodyTemplate ?? template.body);
		const subject = resolveVariables(subjectTemplate, vars);
		const bodyHtml = resolveHtmlVariables(bodyTemplate, vars);
		const bodyText = plainTextTemplateWithVariables(bodyTemplate, vars);

		const styledBodyHtml = applyEmailClientStyles(bodyHtml);

		const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px 40px 32px;max-width:600px;width:100%">
        <tr><td style="color:#1a1a1a;font-size:15px;line-height:1.6">
          ${styledBodyHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

		const apiKey = process.env.RESEND_API_KEY;
		const fromAddress = configuredFromEmail();

		if (!apiKey) {
			console.warn('[EMAIL] RESEND_API_KEY is not set — skipping delivery.');
			await ctx.runMutation(internal.emails.markFollowUpFailed, {
				followUpId: args.followUpId,
				reason: 'RESEND_API_KEY is not set.'
			});
			return;
		}

		if (!fromAddress) {
			console.warn('[EMAIL] RESEND_FROM_EMAIL is not set — skipping delivery.');
			await ctx.runMutation(internal.emails.markFollowUpFailed, {
				followUpId: args.followUpId,
				reason: 'RESEND_FROM_EMAIL is not set.'
			});
			return;
		}

		const resend = new Resend(apiKey);
		const sentFrom = friendlyFromAddress(
			sender.workspaceName || template.workspaceName,
			fromAddress
		);
		let resendMessageId: string | undefined;

		try {
			const { data, error } = await resend.emails.send({
				from: sentFrom,
				to: followUp.signerEmail,
				replyTo: sender.replyToEmail,
				subject,
				html,
				text: bodyText
			});

			if (error) throw new Error(error.message);
			resendMessageId = data?.id;
		} catch (err) {
			console.error(`[EMAIL] Failed to deliver follow-up ${args.followUpId}:`, err);
			await ctx.runMutation(internal.emails.markFollowUpFailed, {
				followUpId: args.followUpId,
				reason: err instanceof Error ? err.message : 'Email delivery failed.'
			});
			return;
		}

		try {
			await ctx.runMutation(internal.emails.markFollowUpSent, {
				followUpId: args.followUpId,
				sentSubject: subject,
				sentBodyHtml: styledBodyHtml,
				sentFrom,
				sentReplyTo: sender.replyToEmail,
				...(resendMessageId ? { resendMessageId } : {})
			});
		} catch (err) {
			console.error(
				`[EMAIL] Delivered follow-up ${args.followUpId}, but failed to mark sent:`,
				err
			);
		}
	}
});
