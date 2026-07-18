import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, type MutationCtx } from './_generated/server';
import { nextFixedWindowUsage, type FixedWindowDecision } from './lib/emailAIRateLimit';
import { requireWorkspaceOwner } from './lib/waivers';

const MEMBER_WINDOW_MS = 10 * 60 * 1000;
const MEMBER_REQUEST_LIMIT = 10;
const WORKSPACE_WINDOW_MS = 60 * 60 * 1000;
const WORKSPACE_REQUEST_LIMIT = 50;
const WORKSPACE_SCOPE_KEY = 'workspace';

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

export const consumeReviewQuota = mutation({
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({
		allowed: v.boolean(),
		retryAfterSeconds: v.number(),
		workspaceName: v.string()
	}),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceOwner(
			ctx,
			args.workspaceId,
			'review and replace follow-up content with AI'
		);
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		const now = Date.now();
		const memberScopeKey = `member:${membership._id}`;
		const memberUsage = await getUsage(ctx, args.workspaceId, memberScopeKey);
		const workspaceUsage = await getUsage(ctx, args.workspaceId, WORKSPACE_SCOPE_KEY);
		const memberDecision = nextFixedWindowUsage(
			memberUsage,
			now,
			MEMBER_WINDOW_MS,
			MEMBER_REQUEST_LIMIT
		);
		const workspaceDecision = nextFixedWindowUsage(
			workspaceUsage,
			now,
			WORKSPACE_WINDOW_MS,
			WORKSPACE_REQUEST_LIMIT
		);

		if (!memberDecision.allowed || !workspaceDecision.allowed) {
			return {
				allowed: false,
				retryAfterSeconds: Math.max(
					memberDecision.retryAfterSeconds,
					workspaceDecision.retryAfterSeconds
				),
				workspaceName: workspace.name
			};
		}

		await saveUsage(ctx, args.workspaceId, memberScopeKey, memberUsage, memberDecision, now);
		await saveUsage(
			ctx,
			args.workspaceId,
			WORKSPACE_SCOPE_KEY,
			workspaceUsage,
			workspaceDecision,
			now
		);

		return { allowed: true, retryAfterSeconds: 0, workspaceName: workspace.name };
	}
});
