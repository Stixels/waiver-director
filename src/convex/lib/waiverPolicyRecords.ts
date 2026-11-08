import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import {
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
