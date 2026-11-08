import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { nextFixedWindowUsage, type FixedWindowDecision } from './emailAIRateLimit';

export type AIQuotaLimits = {
	memberWindowMs: number;
	memberRequestLimit: number;
	workspaceWindowMs: number;
	workspaceRequestLimit: number;
};

async function getUsage(
	ctx: MutationCtx,
	workspaceId: Id<'workspaces'>,
	scopeKey: string
): Promise<Doc<'email_ai_rate_limits'> | null> {
	return await ctx.db
		.query('email_ai_rate_limits')
		.withIndex('by_workspaceId_and_scopeKey', (query) =>
			query.eq('workspaceId', workspaceId).eq('scopeKey', scopeKey)
		)
		.unique();
}

async function saveUsage(
	ctx: MutationCtx,
	workspaceId: Id<'workspaces'>,
	scopeKey: string,
	existing: Doc<'email_ai_rate_limits'> | null,
	decision: FixedWindowDecision,
	now: number
) {
	const value = {
		windowStartedAt: decision.windowStartedAt,
		requestCount: decision.requestCount,
		updatedAt: now
	};

	if (existing) {
		await ctx.db.patch(existing._id, value);
		return;
	}

	await ctx.db.insert('email_ai_rate_limits', {
		workspaceId,
		scopeKey,
		...value
	});
}

/**
 * Consumes one AI request from both a per-member and a per-workspace fixed
 * window. Nothing is recorded when either window is exhausted.
 */
export async function consumeAIQuota(
	ctx: MutationCtx,
	args: {
		workspaceId: Id<'workspaces'>;
		memberScopeKey: string;
		workspaceScopeKey: string;
		limits: AIQuotaLimits;
	}
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
	const now = Date.now();
	const memberUsage = await getUsage(ctx, args.workspaceId, args.memberScopeKey);
	const workspaceUsage = await getUsage(ctx, args.workspaceId, args.workspaceScopeKey);
	const memberDecision = nextFixedWindowUsage(
		memberUsage,
		now,
		args.limits.memberWindowMs,
		args.limits.memberRequestLimit
	);
	const workspaceDecision = nextFixedWindowUsage(
		workspaceUsage,
		now,
		args.limits.workspaceWindowMs,
		args.limits.workspaceRequestLimit
	);

	if (!memberDecision.allowed || !workspaceDecision.allowed) {
		return {
			allowed: false,
			retryAfterSeconds: Math.max(
				memberDecision.retryAfterSeconds,
				workspaceDecision.retryAfterSeconds
			)
		};
	}

	await saveUsage(ctx, args.workspaceId, args.memberScopeKey, memberUsage, memberDecision, now);
	await saveUsage(
		ctx,
		args.workspaceId,
		args.workspaceScopeKey,
		workspaceUsage,
		workspaceDecision,
		now
	);
	return { allowed: true, retryAfterSeconds: 0 };
}
