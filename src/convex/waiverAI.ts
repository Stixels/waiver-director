import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';
import { consumeAIQuota } from './lib/aiUsage';
import { requireWorkspaceFeature } from './lib/billing';
import { requireWorkspaceMember } from './lib/waivers';

// Waiver drafts are longer generations than email reviews, so the windows are
// tighter. Keys are prefixed so they never share a window with email review.
const MEMBER_WINDOW_MS = 10 * 60 * 1000;
const MEMBER_REQUEST_LIMIT = 5;
const WORKSPACE_WINDOW_MS = 60 * 60 * 1000;
const WORKSPACE_REQUEST_LIMIT = 20;

export const consumeDraftQuota = mutation({
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({
		allowed: v.boolean(),
		retryAfterSeconds: v.number(),
		workspaceName: v.string()
	}),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceMember(ctx, args.workspaceId);
		await requireWorkspaceFeature(ctx, args.workspaceId, 'waiver_publishing');
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		const quota = await consumeAIQuota(ctx, {
			workspaceId: args.workspaceId,
			memberScopeKey: `waiver-draft:member:${membership._id}`,
			workspaceScopeKey: 'waiver-draft:workspace',
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
