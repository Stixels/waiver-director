import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type FunctionCtx = QueryCtx | MutationCtx;
const WORKSPACE_MEMBERSHIPS_PER_USER_LIMIT = 25;

export async function listWorkspaceMembershipsForUser(ctx: FunctionCtx, userId: Id<'users'>) {
	return await ctx.db
		.query('workspace_memberships')
		.withIndex('by_userId', (query) => query.eq('userId', userId))
		.take(WORKSPACE_MEMBERSHIPS_PER_USER_LIMIT);
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

export async function getWorkspaceBySlug(ctx: FunctionCtx, slug: string) {
	return await ctx.db
		.query('workspaces')
		.withIndex('by_slug', (query) => query.eq('slug', slug))
		.unique();
}
