import { ConvexError, v } from 'convex/values';
import { Resend } from 'resend';
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { requireWorkspaceFeature, workspaceHasBillingFeature } from './lib/billing';
import { configuredFromEmail, friendlyFromAddress } from './lib/emailSender';
import { requireWorkspaceMember, requireWorkspaceOwner, waiverFieldValidator } from './lib/waivers';
import { escapeHtml } from '../lib/utils/rich-text';
import { richTextHtmlToPlainText } from '../lib/utils/rich-text-shared';
import {
	formatUtcTimestamp,
	renderSignedWaiverPdf,
	signedRecordFingerprint,
	signedWaiverPdfFileName
} from '../lib/domain/signed-waiver-pdf';

const MANUAL_RESEND_COOLDOWN_MS = 60 * 1000;
const MANUAL_RESEND_LIMIT_PER_SUBMISSION = 10;
const AUTO_RECIPIENT_LIMIT = 3;
const AUTO_RECIPIENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const AUTO_WORKSPACE_LIMIT = 100;
const AUTO_WORKSPACE_WINDOW_MS = 60 * 60 * 1000;
const VERIFY_REPLY_TO_MESSAGE =
	'Verify a reply-to address under Email identity before turning on signed copy emails.';
const PDF_EXPORT_UPGRADE_MESSAGE = 'Upgrade to Pro to export signed waiver PDFs.';

type FunctionCtx = QueryCtx | MutationCtx;

const signedCopyDataValue = v.object({
	workspaceId: v.id('workspaces'),
	submissionId: v.id('waiver_submissions'),
	versionId: v.id('waiver_versions'),
	versionNumber: v.union(v.number(), v.null()),
	workspaceName: v.string(),
	waiverTitle: v.string(),
	introCopy: v.string(),
	fields: v.array(waiverFieldValidator),
	answers: v.record(v.string(), v.union(v.string(), v.boolean(), v.null())),
	signerName: v.string(),
	signerEmail: v.string(),
	signerDateOfBirth: v.string(),
	minors: v.array(v.string()),
	booking: v.union(
		v.null(),
		v.object({
			providerBookingId: v.string(),
			activityName: v.string(),
			startTime: v.union(v.string(), v.null())
		})
	),
	marketingConsent: v.boolean(),
	marketingConsentLabel: v.union(v.string(), v.null()),
	signatureDataUrl: v.string(),
	submittedAt: v.number()
});

type SignedCopyData = typeof signedCopyDataValue.type;

async function loadSignedCopyData(
	ctx: FunctionCtx,
	workspaceId: Id<'workspaces'>,
	submissionId: Id<'waiver_submissions'>
): Promise<SignedCopyData | null> {
	const submission = await ctx.db.get(submissionId);
	if (!submission || submission.workspaceId !== workspaceId) return null;

	const [version, workspace] = await Promise.all([
		ctx.db.get(submission.versionId),
		ctx.db.get(workspaceId)
	]);
	if (!version || !workspace || version.workspaceId !== workspaceId) return null;

	return {
		workspaceId,
		submissionId: submission._id,
		versionId: version._id,
		versionNumber: version.versionNumber ?? null,
		workspaceName: workspace.name,
		waiverTitle: version.title,
		introCopy: version.introCopy,
		fields: version.fields,
		answers: submission.answers,
		signerName: submission.signerName,
		signerEmail: submission.signerEmail,
		signerDateOfBirth: submission.signerDateOfBirth,
		minors: submission.minors.map((minor) => minor.fullName),
		booking: submission.bookingSnapshot
			? {
					providerBookingId: submission.bookingSnapshot.providerBookingId,
					activityName: submission.bookingSnapshot.activityName,
					startTime: submission.bookingSnapshot.startTime ?? null
				}
			: null,
		marketingConsent: submission.marketingConsent ?? false,
		marketingConsentLabel: submission.marketingConsentLabel ?? null,
		signatureDataUrl: submission.signatureDataUrl,
		submittedAt: submission.submittedAt
	};
}

async function buildSignedCopyPdf(data: SignedCopyData) {
	const fingerprint = await signedRecordFingerprint({
		submissionId: data.submissionId,
		versionId: data.versionId,
		signerName: data.signerName,
		signerEmail: data.signerEmail,
		signerDateOfBirth: data.signerDateOfBirth,
		answers: data.answers,
		minors: data.minors,
		signatureDataUrl: data.signatureDataUrl,
		submittedAt: data.submittedAt
	});
	const pdf = await renderSignedWaiverPdf({
		submissionId: data.submissionId,
		workspaceName: data.workspaceName,
		waiverTitle: data.waiverTitle,
		versionNumber: data.versionNumber,
		introText: richTextHtmlToPlainText(data.introCopy),
		fields: data.fields,
		answers: data.answers,
		signerName: data.signerName,
		signerEmail: data.signerEmail,
		signerDateOfBirth: data.signerDateOfBirth,
		minors: data.minors,
		booking: data.booking,
		marketingConsent: data.marketingConsent,
		marketingConsentLabel: data.marketingConsentLabel,
		signatureDataUrl: data.signatureDataUrl,
		submittedAt: data.submittedAt,
		fingerprint,
		generatedAt: Date.now()
	});
	return {
		pdf,
		fileName: signedWaiverPdfFileName({
			signerName: data.signerName,
			submittedAt: data.submittedAt
		})
	};
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function hasVerifiedReplyTo(settings: Doc<'workspace_email_settings'> | null) {
	return Boolean(configuredFromEmail() && settings?.replyToEmail && settings.replyToVerifiedAt);
}

async function getEmailSettings(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	return await ctx.db
		.query('workspace_email_settings')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.unique();
}

export function signedCopyRecipientKey(email: string) {
	return email.trim().toLowerCase();
}

/**
 * Automatic copies are triggered by the unauthenticated public submit, so cap
 * them per recipient and per workspace to keep the sending domain from being
 * used to spam an address. Manual resends count toward both caps too.
 */
async function automaticSendAllowed(
	ctx: MutationCtx,
	workspaceId: Id<'workspaces'>,
	recipientKey: string,
	now: number
) {
	const recipientSends = await ctx.db
		.query('signed_copy_emails')
		.withIndex('by_workspaceId_and_recipientKey_and_createdAt', (q) =>
			q
				.eq('workspaceId', workspaceId)
				.eq('recipientKey', recipientKey)
				.gte('createdAt', now - AUTO_RECIPIENT_WINDOW_MS)
		)
		.take(AUTO_RECIPIENT_LIMIT);
	if (recipientSends.length >= AUTO_RECIPIENT_LIMIT) return false;

	const workspaceSends = await ctx.db
		.query('signed_copy_emails')
		.withIndex('by_workspaceId_and_createdAt', (q) =>
			q.eq('workspaceId', workspaceId).gte('createdAt', now - AUTO_WORKSPACE_WINDOW_MS)
		)
		.take(AUTO_WORKSPACE_LIMIT);
	return workspaceSends.length < AUTO_WORKSPACE_LIMIT;
}

/**
 * Called from the signing mutation. Automatic copies are opt-in: they are only
 * queued when the plan includes PDF export, an Owner turned them on, the
 * workspace has a verified reply-to, and the send limits allow it.
 */
export async function queueSignedCopyForNewSubmission(
	ctx: MutationCtx,
	args: {
		workspaceId: Id<'workspaces'>;
		submissionId: Id<'waiver_submissions'>;
		signerEmail: string;
	}
) {
	const settings = await getEmailSettings(ctx, args.workspaceId);
	if (settings?.signedCopyEmailsEnabled !== true || !hasVerifiedReplyTo(settings)) return null;
	if (!(await workspaceHasBillingFeature(ctx, args.workspaceId, 'pdf_export'))) return null;

	const now = Date.now();
	const recipientKey = signedCopyRecipientKey(args.signerEmail);
	if (!(await automaticSendAllowed(ctx, args.workspaceId, recipientKey, now))) {
		console.warn('[EMAIL] Signed copy send limit reached; skipping automatic copy.', {
			workspaceId: args.workspaceId,
			submissionId: args.submissionId
		});
		return null;
	}

	const deliveryId = await ctx.db.insert('signed_copy_emails', {
		workspaceId: args.workspaceId,
		submissionId: args.submissionId,
		recipientEmail: args.signerEmail,
		recipientKey,
		trigger: 'submission',
		status: 'queued',
		createdAt: now,
		updatedAt: now
	});
	await ctx.scheduler.runAfter(0, internal.signedCopies.deliverSignedCopyEmail, { deliveryId });
	return deliveryId;
}

export async function latestSignedCopyEmail(
	ctx: FunctionCtx,
	submissionId: Id<'waiver_submissions'>
): Promise<Doc<'signed_copy_emails'> | null> {
	return await ctx.db
		.query('signed_copy_emails')
		.withIndex('by_submissionId', (q) => q.eq('submissionId', submissionId))
		.order('desc')
		.first();
}

export const getSignedCopyDataForOwner = internalQuery({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions')
	},
	returns: signedCopyDataValue,
	handler: async (ctx, args) => {
		// Exports of signed records are high-impact data movement, so they are Owner-only.
		await requireWorkspaceOwner(ctx, args.workspaceId, 'export signed waiver PDFs');
		await requireWorkspaceFeature(ctx, args.workspaceId, 'pdf_export');
		const data = await loadSignedCopyData(ctx, args.workspaceId, args.submissionId);
		if (!data) {
			throw new ConvexError({ code: 'not_found', message: 'Submission not found.' });
		}
		return data;
	}
});

/** Builds the signed waiver PDF for a workspace owner to download. */
export const exportSubmissionPdf = action({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions')
	},
	returns: v.object({
		fileName: v.string(),
		pdf: v.bytes()
	}),
	handler: async (ctx, args): Promise<{ fileName: string; pdf: ArrayBuffer }> => {
		const data: SignedCopyData = await ctx.runQuery(
			internal.signedCopies.getSignedCopyDataForOwner,
			args
		);
		const { pdf, fileName } = await buildSignedCopyPdf(data);
		return { fileName, pdf: toArrayBuffer(pdf) };
	}
});

/**
 * Lets any workspace member email the signed copy to the signer on record. The
 * recipient is always the signer, so this is not a data export.
 */
export const emailSignedCopy = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions')
	},
	returns: v.object({ deliveryId: v.id('signed_copy_emails') }),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceMember(ctx, args.workspaceId);
		await requireWorkspaceFeature(ctx, args.workspaceId, 'pdf_export');

		const submission = await ctx.db.get(args.submissionId);
		if (!submission || submission.workspaceId !== args.workspaceId) {
			throw new ConvexError({ code: 'not_found', message: 'Submission not found.' });
		}

		const now = Date.now();
		const recent = await ctx.db
			.query('signed_copy_emails')
			.withIndex('by_submissionId', (q) => q.eq('submissionId', submission._id))
			.order('desc')
			.take(MANUAL_RESEND_LIMIT_PER_SUBMISSION + 1);
		const latest = recent[0];
		if (latest && latest.status === 'queued') {
			throw new ConvexError({
				code: 'rate_limited',
				message: 'A signed copy is already on its way to this signer.'
			});
		}
		if (latest && now - latest.createdAt < MANUAL_RESEND_COOLDOWN_MS) {
			throw new ConvexError({
				code: 'rate_limited',
				message: 'A signed copy was just sent. Try again in a minute.'
			});
		}
		const manualCount = recent.filter((row) => row.trigger === 'manual').length;
		if (manualCount >= MANUAL_RESEND_LIMIT_PER_SUBMISSION) {
			throw new ConvexError({
				code: 'rate_limited',
				message: 'This signed copy has been emailed the maximum number of times.'
			});
		}

		const deliveryId = await ctx.db.insert('signed_copy_emails', {
			workspaceId: args.workspaceId,
			submissionId: submission._id,
			recipientEmail: submission.signerEmail,
			recipientKey: signedCopyRecipientKey(submission.signerEmail),
			trigger: 'manual',
			requestedByUserId: user._id,
			status: 'queued',
			createdAt: now,
			updatedAt: now
		});
		await ctx.scheduler.runAfter(0, internal.signedCopies.deliverSignedCopyEmail, { deliveryId });
		return { deliveryId };
	}
});

/** Owner setting: automatically email signers a PDF of their signed waiver. */
export const setSignedCopyEmailsEnabled = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		enabled: v.boolean()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change signed copy emails');
		const settings = await getEmailSettings(ctx, args.workspaceId);
		if (args.enabled) {
			await requireWorkspaceFeature(ctx, args.workspaceId, 'pdf_export');
			if (!hasVerifiedReplyTo(settings)) {
				throw new ConvexError({ code: 'reply_to_required', message: VERIFY_REPLY_TO_MESSAGE });
			}
		}
		const now = Date.now();
		if (settings) {
			await ctx.db.patch(settings._id, { signedCopyEmailsEnabled: args.enabled, updatedAt: now });
		} else {
			await ctx.db.insert('workspace_email_settings', {
				workspaceId: args.workspaceId,
				verificationAttempts: 0,
				signedCopyEmailsEnabled: args.enabled,
				updatedAt: now
			});
		}
		return null;
	}
});

export const getSignedCopyDelivery = internalQuery({
	args: { deliveryId: v.id('signed_copy_emails') },
	handler: async (ctx, args) => {
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery) return null;

		const [data, canExport, settings] = await Promise.all([
			loadSignedCopyData(ctx, delivery.workspaceId, delivery.submissionId),
			workspaceHasBillingFeature(ctx, delivery.workspaceId, 'pdf_export'),
			getEmailSettings(ctx, delivery.workspaceId)
		]);
		return {
			delivery,
			data,
			canExport,
			automaticCopiesAllowed:
				settings?.signedCopyEmailsEnabled === true && hasVerifiedReplyTo(settings),
			replyToEmail:
				settings?.replyToEmail && settings.replyToVerifiedAt ? settings.replyToEmail : null
		};
	}
});

export const markSignedCopyDelivery = internalMutation({
	args: {
		deliveryId: v.id('signed_copy_emails'),
		status: v.union(v.literal('sent'), v.literal('blocked'), v.literal('failed')),
		failureReason: v.optional(v.string()),
		resendMessageId: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery || delivery.status !== 'queued') return null;
		const now = Date.now();
		await ctx.db.patch(args.deliveryId, {
			status: args.status,
			updatedAt: now,
			...(args.status === 'sent' ? { sentAt: now } : {}),
			...(args.failureReason ? { failureReason: args.failureReason } : {}),
			...(args.resendMessageId ? { resendMessageId: args.resendMessageId } : {})
		});
		return null;
	}
});

function signedCopyEmailContent(data: SignedCopyData) {
	const signedOn = formatUtcTimestamp(data.submittedAt);
	const subject = `Your signed waiver from ${data.workspaceName}`;
	const text = [
		`Hi ${data.signerName},`,
		'',
		`Thanks for signing "${data.waiverTitle}" with ${data.workspaceName} on ${signedOn}.`,
		'A PDF copy of your signed waiver is attached for your records.',
		...(data.minors.length > 0 ? ['', `Minors covered: ${data.minors.join(', ')}`] : []),
		'',
		`- ${data.workspaceName}`
	].join('\n');
	const minorsHtml =
		data.minors.length > 0
			? `<p style="margin:0 0 16px 0;line-height:1.6;font-size:15px">Minors covered: ${escapeHtml(data.minors.join(', '))}</p>`
			: '';
	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px 40px 32px;max-width:600px;width:100%">
        <tr><td style="color:#1a1a1a;font-size:15px;line-height:1.6">
          <p style="margin:0 0 16px 0;line-height:1.6;font-size:15px">Hi ${escapeHtml(data.signerName)},</p>
          <p style="margin:0 0 16px 0;line-height:1.6;font-size:15px">Thanks for signing <strong>${escapeHtml(data.waiverTitle)}</strong> with ${escapeHtml(data.workspaceName)} on ${escapeHtml(signedOn)}.</p>
          <p style="margin:0 0 16px 0;line-height:1.6;font-size:15px">A PDF copy of your signed waiver is attached for your records.</p>
          ${minorsHtml}
          <p style="margin:0;line-height:1.6;font-size:15px;color:#6b7280">${escapeHtml(data.workspaceName)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
	return { subject, text, html };
}

export const deliverSignedCopyEmail = internalAction({
	args: { deliveryId: v.id('signed_copy_emails') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const loaded = await ctx.runQuery(internal.signedCopies.getSignedCopyDelivery, args);
		if (!loaded || loaded.delivery.status !== 'queued') return null;

		const mark = (
			status: 'sent' | 'blocked' | 'failed',
			extra: { failureReason?: string; resendMessageId?: string } = {}
		) =>
			ctx.runMutation(internal.signedCopies.markSignedCopyDelivery, {
				deliveryId: args.deliveryId,
				status,
				...extra
			});

		if (!loaded.data) {
			await mark('failed', { failureReason: 'Submission not found.' });
			return null;
		}
		if (!loaded.canExport) {
			await mark('blocked', { failureReason: PDF_EXPORT_UPGRADE_MESSAGE });
			return null;
		}
		if (loaded.delivery.trigger === 'submission' && !loaded.automaticCopiesAllowed) {
			await mark('blocked', { failureReason: 'Automatic signed copy emails are turned off.' });
			return null;
		}

		const apiKey = process.env.RESEND_API_KEY;
		const fromAddress = configuredFromEmail();
		if (!apiKey || !fromAddress) {
			const missing = !apiKey ? 'RESEND_API_KEY' : 'RESEND_FROM_EMAIL';
			console.warn(`[EMAIL] ${missing} is not set — skipping signed copy delivery.`);
			await mark('failed', { failureReason: `${missing} is not set.` });
			return null;
		}

		try {
			const { pdf, fileName } = await buildSignedCopyPdf(loaded.data);
			const { subject, text, html } = signedCopyEmailContent(loaded.data);
			const { data, error } = await new Resend(apiKey).emails.send({
				from: friendlyFromAddress(loaded.data.workspaceName, fromAddress),
				to: loaded.delivery.recipientEmail,
				...(loaded.replyToEmail ? { replyTo: loaded.replyToEmail } : {}),
				subject,
				html,
				text,
				attachments: [
					{ filename: fileName, content: bytesToBase64(pdf), contentType: 'application/pdf' }
				]
			});
			if (error) throw new Error(error.message);
			await mark('sent', data?.id ? { resendMessageId: data.id } : {});
		} catch (err) {
			console.error(`[EMAIL] Failed to deliver signed copy ${args.deliveryId}:`, err);
			await mark('failed', {
				failureReason: err instanceof Error ? err.message : 'Email delivery failed.'
			});
		}
		return null;
	}
});
