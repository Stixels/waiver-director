import { ConvexError, v } from 'convex/values';
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query
} from './_generated/server';
import { Resend } from 'resend';
import { internal } from './_generated/api';
import { requireWorkspaceMember } from './lib/waivers';
import { escapeHtml, sanitizeRichTextHtml } from '../lib/utils/rich-text';

const DEFAULT_SEND_AFTER_HOURS = 2;
const DEFAULT_SUBJECT = 'Thank you for visiting, {customer_name}!';
const DEFAULT_BODY =
	"<p>Hi {customer_name},</p><p>We wanted to take a moment to thank you for your recent visit. It was a pleasure having you with us!</p><p>As a reminder, you can always access your signed waivers and activity history through your personal dashboard using your Booking ID: #{booking_id}.</p><p>Would you mind taking 30 seconds to share your experience with us? We'd love to hear how we did.</p>";
const TEMPLATE_PRESET_LIMIT = 100;
const FOLLOW_UP_STATS_LIMIT = 1000;

function validateEmailTemplateInput(args: {
	subject: string;
	body: string;
	sendAfterHours: number;
}): string {
	if (args.subject.trim().length === 0) {
		throw new ConvexError({ code: 'invalid_argument', message: 'Subject is required.' });
	}
	const body = sanitizeRichTextHtml(args.body);
	if (body.length === 0) {
		throw new ConvexError({ code: 'invalid_argument', message: 'Email body is required.' });
	}
	if (args.sendAfterHours < 1 || args.sendAfterHours > 168) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'Send after must be between 1 and 168 hours.'
		});
	}
	return body;
}

export const getEmailTemplate = query({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const template = await ctx.db
			.query('email_templates')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		if (!template) {
			return {
				workspaceId: args.workspaceId,
				subject: DEFAULT_SUBJECT,
				body: DEFAULT_BODY,
				sendAfterHours: DEFAULT_SEND_AFTER_HOURS,
				isDefault: true as const
			};
		}

		return {
			_id: template._id,
			workspaceId: template.workspaceId,
			subject: template.subject,
			body: template.body,
			sendAfterHours: template.sendAfterHours,
			updatedAt: template.updatedAt,
			isDefault: false as const
		};
	}
});

export const upsertEmailTemplate = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		subject: v.string(),
		body: v.string(),
		sendAfterHours: v.number()
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const subject = args.subject.trim();
		const body = validateEmailTemplateInput(args);

		const existing = await ctx.db
			.query('email_templates')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				subject,
				body,
				sendAfterHours: args.sendAfterHours,
				updatedAt: now
			});
		} else {
			await ctx.db.insert('email_templates', {
				workspaceId: args.workspaceId,
				subject,
				body,
				sendAfterHours: args.sendAfterHours,
				updatedAt: now
			});
		}
	}
});

export const listTemplatePresets = query({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		return await ctx.db
			.query('email_template_presets')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.order('desc')
			.take(TEMPLATE_PRESET_LIMIT);
	}
});

export const saveTemplatePreset = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		name: v.string(),
		subject: v.string(),
		body: v.string(),
		sendAfterHours: v.number()
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const subject = args.subject.trim();
		const body = validateEmailTemplateInput(args);

		if (args.name.trim().length === 0) {
			throw new ConvexError({ code: 'invalid_argument', message: 'Template name is required.' });
		}

		await ctx.db.insert('email_template_presets', {
			workspaceId: args.workspaceId,
			name: args.name.trim(),
			subject,
			body,
			sendAfterHours: args.sendAfterHours,
			createdAt: Date.now()
		});
	}
});

export const deleteTemplatePreset = mutation({
	args: { presetId: v.id('email_template_presets') },
	handler: async (ctx, args) => {
		const preset = await ctx.db.get(args.presetId);
		if (!preset) throw new ConvexError({ code: 'not_found', message: 'Preset not found.' });
		await requireWorkspaceMember(ctx, preset.workspaceId);
		await ctx.db.delete(args.presetId);
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

		const paused = await ctx.db
			.query('email_follow_ups')
			.withIndex('by_workspaceId_and_status', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('status', 'paused')
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
			pendingCount: queued.length + paused.length,
			// This total is capped by FOLLOW_UP_STATS_LIMIT. Use a persisted counter if this needs
			// to stay exact after a workspace has more sent follow-ups than the read limit.
			totalSent: sent.length
		};
	}
});

export const listFollowUps = query({
	args: {
		workspaceId: v.id('workspaces'),
		limit: v.optional(v.number()),
		status: v.optional(
			v.union(
				v.literal('queued'),
				v.literal('sent'),
				v.literal('cancelled'),
				v.literal('paused'),
				v.literal('failed')
			)
		)
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const q = args.status
			? ctx.db
					.query('email_follow_ups')
					.withIndex('by_workspaceId_and_status', (q) =>
						q.eq('workspaceId', args.workspaceId).eq('status', args.status!)
					)
			: ctx.db
					.query('email_follow_ups')
					.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId));

		return await q.order('desc').take(args.limit ?? 50);
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

		if (followUp.status !== 'queued' && followUp.status !== 'paused') {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Only queued or paused follow-ups can be cancelled.'
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

export const pauseFollowUp = mutation({
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
				message: 'Only queued follow-ups can be paused.'
			});
		}

		if (followUp.scheduledFunctionId) {
			try {
				await ctx.scheduler.cancel(followUp.scheduledFunctionId);
			} catch {
				// Already ran
			}
		}

		await ctx.db.patch(args.followUpId, {
			status: 'paused',
			scheduledFunctionId: undefined
		});
	}
});

export const resumeFollowUp = mutation({
	args: { followUpId: v.id('email_follow_ups') },
	handler: async (ctx, args) => {
		const followUp = await ctx.db.get(args.followUpId);
		if (!followUp) {
			throw new ConvexError({ code: 'not_found', message: 'Follow-up not found.' });
		}

		await requireWorkspaceMember(ctx, followUp.workspaceId);

		if (followUp.status !== 'paused') {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Only paused follow-ups can be resumed.'
			});
		}

		const now = Date.now();
		// If the original scheduled time has passed, send in 5 minutes
		const delay = followUp.scheduledAt > now ? followUp.scheduledAt - now : 5 * 60 * 1000;
		const scheduledAt = now + delay;

		const scheduledFunctionId = await ctx.scheduler.runAfter(
			delay,
			internal.emails.deliverFollowUpEmail,
			{ followUpId: args.followUpId }
		);

		await ctx.db.patch(args.followUpId, {
			status: 'queued',
			scheduledAt,
			scheduledFunctionId
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

		if (followUp.status !== 'queued' && followUp.status !== 'paused') {
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
			if (!['queued', 'paused'].includes(followUp.status)) continue;
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

export const scheduleFollowUpOnSubmission = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions'),
		signerName: v.string(),
		signerEmail: v.string(),
		submittedAt: v.number()
	},
	handler: async (ctx, args) => {
		const template = await ctx.db
			.query('email_templates')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		const subjectTemplate = template?.subject ?? DEFAULT_SUBJECT;
		const bodyTemplate = template?.body ?? DEFAULT_BODY;
		const sendAfterHours = template?.sendAfterHours ?? DEFAULT_SEND_AFTER_HOURS;
		const sendAfterMs = sendAfterHours * 60 * 60 * 1000;
		const scheduledAt = args.submittedAt + sendAfterMs;

		const followUpId = await ctx.db.insert('email_follow_ups', {
			workspaceId: args.workspaceId,
			submissionId: args.submissionId,
			signerName: args.signerName,
			signerEmail: args.signerEmail,
			subjectTemplate,
			bodyTemplate,
			submittedAt: args.submittedAt,
			scheduledAt,
			status: 'queued'
		});

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
		return await ctx.db.get(args.followUpId);
	}
});

export const getTemplateForWorkspace = internalQuery({
	args: { workspaceId: v.id('workspaces') },
	handler: async (ctx, args) => {
		const template = await ctx.db
			.query('email_templates')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();

		return {
			subject: template?.subject ?? DEFAULT_SUBJECT,
			body: template?.body ?? DEFAULT_BODY,
			sendAfterHours: template?.sendAfterHours ?? DEFAULT_SEND_AFTER_HOURS
		};
	}
});

export const markFollowUpSent = internalMutation({
	args: {
		followUpId: v.id('email_follow_ups'),
		sentSubject: v.string(),
		sentBodyHtml: v.string()
	},
	handler: async (ctx, args) => {
		const followUp = await ctx.db.get(args.followUpId);
		if (!followUp || followUp.status === 'sent' || followUp.status === 'failed') return;

		await ctx.db.patch(args.followUpId, {
			status: 'sent',
			sentAt: Date.now(),
			sentSubject: args.sentSubject,
			sentBodyHtml: args.sentBodyHtml
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

function resolveVariables(
	template: string,
	vars: { signerName: string; bookingId: string; activityDate: string }
): string {
	return template
		.replace(/\{customer_name\}/g, vars.signerName)
		.replace(/\{booking_id\}/g, vars.bookingId)
		.replace(/\{activity_date\}/g, vars.activityDate);
}

function resolveHtmlVariables(
	template: string,
	vars: { signerName: string; bookingId: string; activityDate: string }
): string {
	return resolveVariables(template, {
		signerName: escapeHtml(vars.signerName),
		bookingId: escapeHtml(vars.bookingId),
		activityDate: escapeHtml(vars.activityDate)
	});
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

		const template =
			followUp.subjectTemplate && followUp.bodyTemplate
				? null
				: await ctx.runQuery(internal.emails.getTemplateForWorkspace, {
						workspaceId: followUp.workspaceId
					});

		const bookingId = `#BK-${followUp.submissionId.slice(-5).toUpperCase()}`;
		const activityDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
			new Date(followUp.submittedAt)
		);

		const vars = { signerName: followUp.signerName, bookingId, activityDate };
		const subjectTemplate = followUp.subjectTemplate ?? template?.subject ?? DEFAULT_SUBJECT;
		const bodyTemplate = sanitizeRichTextHtml(
			followUp.bodyTemplate ?? template?.body ?? DEFAULT_BODY
		);
		const subject = resolveVariables(subjectTemplate, vars);
		const bodyHtml = resolveHtmlVariables(bodyTemplate, vars);

		// Strip HTML tags for plain-text fallback
		const bodyText = bodyHtml
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s{2,}/g, ' ')
			.trim();

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
		const fromAddress = process.env.RESEND_FROM_EMAIL;

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

		try {
			const { error } = await resend.emails.send({
				from: fromAddress,
				to: followUp.signerEmail,
				subject,
				html,
				text: bodyText
			});

			if (error) throw new Error(error.message);
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
				sentBodyHtml: styledBodyHtml
			});
		} catch (err) {
			console.error(
				`[EMAIL] Delivered follow-up ${args.followUpId}, but failed to mark sent:`,
				err
			);
		}
	}
});
