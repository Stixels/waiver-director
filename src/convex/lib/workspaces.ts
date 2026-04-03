import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type FunctionCtx = QueryCtx | MutationCtx;

export async function listWorkspaceMembershipsForUser(ctx: FunctionCtx, userId: Id<'users'>) {
	return await ctx.db
		.query('workspace_memberships')
		.withIndex('by_userId', (query) => query.eq('userId', userId))
		.take(50);
}

export async function getWorkspaceMembership(
	ctx: FunctionCtx,
	workspaceId: Id<'workspaces'>,
	userId: Id<'users'>
) {
	return await ctx.db
		.query('workspace_memberships')
		.withIndex('by_workspaceId_and_userId', (query) =>
			query.eq('workspaceId', workspaceId).eq('userId', userId)
		)
		.unique();
}
