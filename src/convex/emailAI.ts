import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';
import { consumeAIQuota } from './lib/aiUsage';
import { requireWorkspaceFeature } from './lib/billing';
import { requireWorkspaceOwner } from './lib/waivers';

const MEMBER_WINDOW_MS = 10 * 60 * 1000;
const MEMBER_REQUEST_LIMIT = 10;
const WORKSPACE_WINDOW_MS = 60 * 60 * 1000;
const WORKSPACE_REQUEST_LIMIT = 50;
const WORKSPACE_SCOPE_KEY = 'workspace';

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
		await requireWorkspaceFeature(ctx, args.workspaceId, 'email_followups');
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		const quota = await consumeAIQuota(ctx, {
			workspaceId: args.workspaceId,
			memberScopeKey: `member:${membership._id}`,
			workspaceScopeKey: WORKSPACE_SCOPE_KEY,
			limits: {
				memberWindowMs: MEMBER_WINDOW_MS,
				memberRequestLimit: MEMBER_REQUEST_LIMIT,
				workspaceWindowMs: WORKSPACE_WINDOW_MS,
				workspaceRequestLimit: WORKSPACE_REQUEST_LIMIT
			}
		});

		return { ...quota, workspaceName: workspace.name };
	}
});
