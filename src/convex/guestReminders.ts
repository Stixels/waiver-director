import { v } from 'convex/values';
import { Resend } from 'resend';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { workspaceHasBillingFeature } from './lib/billing';
import { configuredFromEmail, friendlyFromAddress } from './lib/emailAddress';
import { buildGuestReminderEmail } from './lib/guestReminderEmail';
import { getWorkspacePolicyRecord, policyFromRecord } from './lib/waiverPolicyRecords';
import {
	bookingNeedsGuestReminder,
	formatBookingWallClock,
	HOUR_MS,
	isRetryableEmailError,
	MAX_REMINDER_DELIVERY_ATTEMPTS,
	REMINDER_SEND_SPACING_MS,
	REMINDER_WORKSPACE_SPACING_MS,
	reminderRetryDelayMs
} from './lib/waiverPolicies';

const WORKSPACES_PER_SWEEP_PAGE = 100;
const MAX_BOOKINGS_PER_WORKSPACE_SWEEP = 200;
const MAX_REMINDERS_PER_WORKSPACE_SWEEP = 50;

function appOrigin(): string | null {
	const configuredUrl =
		process.env.APP_URL?.trim() ||
		process.env.PUBLIC_APP_URL?.trim() ||
		process.env.SITE_URL?.trim();
	if (!configuredUrl) return null;
	try {
		const url = new URL(configuredUrl);
		return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url.origin : null;
	} catch {
		return null;
	}
}

/**
 * Cron entry point: fans out one sweep per workspace that has guest reminders turned on.
 * Walks the policy index a page at a time and reschedules itself with the cursor, so every
 * workspace is reached no matter how many have reminders enabled.
 */
export const sweepGuestRemindersCron = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('workspace_waiver_policies')
			.withIndex('by_guestRemindersEnabled', (q) => q.eq('guestRemindersEnabled', true))
			.paginate({ cursor: args.cursor ?? null, numItems: WORKSPACES_PER_SWEEP_PAGE });
		for (const [index, policy] of page.page.entries()) {
			await ctx.scheduler.runAfter(
				index * REMINDER_WORKSPACE_SPACING_MS,
				internal.guestReminders.queueWorkspaceGuestReminders,
				{ workspaceId: policy.workspaceId }
			);
		}
		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				page.page.length * REMINDER_WORKSPACE_SPACING_MS,
				internal.guestReminders.sweepGuestRemindersCron,
				{ cursor: page.continueCursor }
			);
		}
		return null;
	}
});

export const queueWorkspaceGuestReminders = internalMutation({
	args: { workspaceId: v.id('workspaces') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace || workspace.status === 'archived') return null;

		const policy = policyFromRecord(await getWorkspacePolicyRecord(ctx, args.workspaceId));
		if (!policy.guestReminders.enabled) return null;

		// Only queue when delivery can actually happen, so reminders are not burned while
		// the workspace is still setting up email.
		if (!configuredFromEmail()) return null;
		if (!(await workspaceHasBillingFeature(ctx, args.workspaceId, 'email_followups'))) return null;
		const emailSettings = await ctx.db
			.query('workspace_email_settings')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.unique();
		if (!emailSettings?.replyToEmail || !emailSettings.replyToVerifiedAt) return null;

		const now = Date.now();
		const bookings = await ctx.db
			.query('bookings')
			.withIndex('by_workspaceId_and_startAt', (q) =>
				q
					.eq('workspaceId', args.workspaceId)
					.gt('startAt', now)
					.lte('startAt', now + policy.guestReminders.leadHours * HOUR_MS)
			)
			.take(MAX_BOOKINGS_PER_WORKSPACE_SWEEP);

		let queued = 0;
		for (const booking of bookings) {
			if (queued >= MAX_REMINDERS_PER_WORKSPACE_SWEEP) break;
			if (
				!bookingNeedsGuestReminder({
					booking,
					leadHours: policy.guestReminders.leadHours,
					now
				})
			) {
				continue;
			}
			const existing = await ctx.db
				.query('booking_guest_reminders')
				.withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
				.first();
			if (existing) continue;

			const reminderId = await ctx.db.insert('booking_guest_reminders', {
				workspaceId: args.workspaceId,
				bookingId: booking._id,
				recipientEmail: booking.leadCustomerEmail!,
				status: 'queued',
				signedCountAtQueue: booking.signedCount,
				participantCount: booking.participantCount,
				createdAt: now,
				deliveryAttempts: 0
			});
			await ctx.scheduler.runAfter(
				queued * REMINDER_SEND_SPACING_MS,
				internal.guestReminders.deliverGuestReminder,
				{ reminderId }
			);
			queued++;
		}
		return null;
	}
});

export const getGuestReminderForDelivery = internalQuery({
	args: { reminderId: v.id('booking_guest_reminders') },
	handler: async (ctx, args) => {
		const reminder = await ctx.db.get(args.reminderId);
		if (!reminder) return null;
		const [booking, workspace, waiver, policyRecord, emailSettings, hasEmailFeature] =
			await Promise.all([
				ctx.db.get(reminder.bookingId),
				ctx.db.get(reminder.workspaceId),
				ctx.db
					.query('workspace_waivers')
					.withIndex('by_workspaceId', (q) => q.eq('workspaceId', reminder.workspaceId))
					.unique(),
				getWorkspacePolicyRecord(ctx, reminder.workspaceId),
				ctx.db
					.query('workspace_email_settings')
					.withIndex('by_workspaceId', (q) => q.eq('workspaceId', reminder.workspaceId))
					.unique(),
				workspaceHasBillingFeature(ctx, reminder.workspaceId, 'email_followups')
			]);
		if (!booking || booking.workspaceId !== reminder.workspaceId)
			return { reminder, booking: null };
		return {
			reminder,
			booking,
			workspaceName: workspace?.name ?? '',
			workspaceArchived: !workspace || workspace.status === 'archived',
			publicSlug: waiver?.publishedVersionId ? waiver.publicSlug : null,
			policy: policyFromRecord(policyRecord),
			replyToEmail:
				emailSettings?.replyToEmail && emailSettings.replyToVerifiedAt
					? emailSettings.replyToEmail
					: null,
			hasEmailFeature
		};
	}
});

export const finishGuestReminder = internalMutation({
	args: {
		reminderId: v.id('booking_guest_reminders'),
		status: v.union(v.literal('sent'), v.literal('skipped'), v.literal('failed')),
		reason: v.optional(v.string()),
		resendMessageId: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const reminder = await ctx.db.get(args.reminderId);
		if (!reminder || reminder.status !== 'queued') return null;
		await ctx.db.patch(args.reminderId, {
			status: args.status,
			...(args.status === 'sent' ? { sentAt: Date.now() } : {}),
			...(args.reason ? { failureReason: args.reason } : {}),
			...(args.resendMessageId ? { resendMessageId: args.resendMessageId } : {})
		});
		return null;
	}
});

/** Records a retryable send failure and schedules another attempt, or gives up after the limit. */
export const retryGuestReminderLater = internalMutation({
	args: { reminderId: v.id('booking_guest_reminders'), reason: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const reminder = await ctx.db.get(args.reminderId);
		if (!reminder || reminder.status !== 'queued') return null;
		const attempts = (reminder.deliveryAttempts ?? 0) + 1;
		if (attempts >= MAX_REMINDER_DELIVERY_ATTEMPTS) {
			await ctx.db.patch(args.reminderId, {
				status: 'failed',
				deliveryAttempts: attempts,
				failureReason: `${args.reason} (gave up after ${attempts} attempts)`
			});
			return null;
		}
		await ctx.db.patch(args.reminderId, {
			deliveryAttempts: attempts,
			failureReason: args.reason
		});
		await ctx.scheduler.runAfter(
			reminderRetryDelayMs(attempts),
			internal.guestReminders.deliverGuestReminder,
			{ reminderId: args.reminderId }
		);
		return null;
	}
});

export const deliverGuestReminder = internalAction({
	args: { reminderId: v.id('booking_guest_reminders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const context = await ctx.runQuery(internal.guestReminders.getGuestReminderForDelivery, {
			reminderId: args.reminderId
		});
		if (!context || context.reminder.status !== 'queued') return null;

		const finish = async (
			status: 'sent' | 'skipped' | 'failed',
			reason?: string,
			resendMessageId?: string
		) => {
			await ctx.runMutation(internal.guestReminders.finishGuestReminder, {
				reminderId: args.reminderId,
				status,
				...(reason ? { reason } : {}),
				...(resendMessageId ? { resendMessageId } : {})
			});
		};

		const { booking } = context;
		if (!booking) {
			await finish('skipped', 'Booking no longer exists.');
			return null;
		}
		if (context.workspaceArchived) {
			await finish('skipped', 'Workspace is archived.');
			return null;
		}
		if (!context.policy.guestReminders.enabled) {
			await finish('skipped', 'Guest reminders were turned off.');
			return null;
		}
		if (booking.status !== 'active') {
			await finish('skipped', 'Booking was canceled.');
			return null;
		}
		if (booking.signedCount >= booking.participantCount) {
			await finish('skipped', 'All guests signed before the reminder was sent.');
			return null;
		}
		if (!booking.leadCustomerEmail) {
			await finish('skipped', 'Booking has no lead customer email.');
			return null;
		}
		if (!context.publicSlug) {
			await finish('skipped', 'No published waiver to link to.');
			return null;
		}
		if (!context.hasEmailFeature) {
			await finish('skipped', 'Upgrade to Pro to send guest reminder emails.');
			return null;
		}
		if (!context.replyToEmail) {
			await finish('skipped', 'Verify a reply-to email before sending reminders.');
			return null;
		}

		const apiKey = process.env.RESEND_API_KEY;
		const fromAddress = configuredFromEmail();
		const origin = appOrigin();
		if (!apiKey || !fromAddress || !origin) {
			await finish(
				'failed',
				!apiKey
					? 'RESEND_API_KEY is not set.'
					: !fromAddress
						? 'RESEND_FROM_EMAIL is not set.'
						: 'APP_URL is not set to an absolute URL.'
			);
			return null;
		}

		const signingUrl = new URL(
			`/w/${encodeURIComponent(context.publicSlug)}/b/${encodeURIComponent(booking.lookupToken)}`,
			origin
		).toString();
		const email = buildGuestReminderEmail({
			workspaceName: context.workspaceName,
			leadCustomerName: booking.leadCustomerName ?? null,
			activityName: booking.activityName,
			when: formatBookingWallClock(booking.startTime),
			signedCount: booking.signedCount,
			participantCount: booking.participantCount,
			signingUrl,
			returningGuestsCanSkip: context.policy.reuseEnabled
		});

		let result: Awaited<ReturnType<Resend['emails']['send']>>;
		try {
			const resend = new Resend(apiKey);
			result = await resend.emails.send(
				{
					from: friendlyFromAddress(context.workspaceName, fromAddress),
					to: booking.leadCustomerEmail,
					replyTo: context.replyToEmail,
					subject: email.subject,
					html: email.html,
					text: email.text
				},
				// A retry after an ambiguous failure must not send a second email.
				{ idempotencyKey: `guest-reminder/${args.reminderId}` }
			);
		} catch (err) {
			// Network-level failure: no response from the provider, so try again later.
			console.error(`[EMAIL] Guest reminder ${args.reminderId} send threw:`, err);
			await ctx.runMutation(internal.guestReminders.retryGuestReminderLater, {
				reminderId: args.reminderId,
				reason: err instanceof Error ? err.message : 'Email delivery failed.'
			});
			return null;
		}

		if (result.error) {
			console.error(`[EMAIL] Guest reminder ${args.reminderId} failed:`, result.error);
			if (isRetryableEmailError(result.error)) {
				await ctx.runMutation(internal.guestReminders.retryGuestReminderLater, {
					reminderId: args.reminderId,
					reason: result.error.message
				});
			} else {
				await finish('failed', result.error.message);
			}
			return null;
		}

		await finish('sent', undefined, result.data?.id);
		return null;
	}
});
