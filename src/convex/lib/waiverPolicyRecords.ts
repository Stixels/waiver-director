import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import {
	reuseCoveredCount,
	reuseExpiredForStart,
	DEFAULT_GUEST_REMINDER_POLICY,
	DEFAULT_WAIVER_REUSE_POLICY,
	type GuestReminderPolicy,
	type WaiverReusePolicy
} from './waiverPolicies';

type FunctionCtx = QueryCtx | MutationCtx;

export type WorkspaceWaiverPolicy = WaiverReusePolicy & { guestReminders: GuestReminderPolicy };

export async function getWorkspacePolicyRecord(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	return await ctx.db
		.query('workspace_waiver_policies')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.unique();
}

export function policyFromRecord(
	record: Doc<'workspace_waiver_policies'> | null
): WorkspaceWaiverPolicy {
	if (!record) {
		return { ...DEFAULT_WAIVER_REUSE_POLICY, guestReminders: { ...DEFAULT_GUEST_REMINDER_POLICY } };
	}
	return {
		reuseEnabled: record.reuseEnabled,
		validityDays: record.validityDays ?? null,
		resignOnNewVersion: record.resignOnNewVersion,
		guestReminders: {
			enabled: record.guestRemindersEnabled,
			leadHours: record.guestReminderLeadHours
		}
	};
}

const MAX_REUSES_CHECKED_ON_RESCHEDULE = 200;

/**
 * When a booking moves later, drops waiver reuses that would expire before the new start
 * and takes them back out of the signed count, so those guests are asked to sign again.
 */
export async function releaseReusesExpiredBeforeStart(ctx: MutationCtx, bookingId: Id<'bookings'>) {
	const booking = await ctx.db.get(bookingId);
	if (!booking) return;
	const reuses = await ctx.db
		.query('booking_waiver_reuses')
		.withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
		.take(MAX_REUSES_CHECKED_ON_RESCHEDULE);
	let released = 0;
	for (const reuse of reuses) {
		if (!reuseExpiredForStart(reuse, booking.startAt)) continue;
		released += reuseCoveredCount(reuse);
		await ctx.db.delete(reuse._id);
	}
	if (released > 0) {
		await ctx.db.patch(bookingId, { signedCount: Math.max(0, booking.signedCount - released) });
	}
}
