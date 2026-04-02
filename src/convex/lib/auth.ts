import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type FunctionCtx = QueryCtx | MutationCtx;

export async function getAuthenticatedIdentity(ctx: FunctionCtx) {
	return await ctx.auth.getUserIdentity();
}

export async function getCurrentAuthIdentity(
	ctx: FunctionCtx
): Promise<Doc<'auth_identities'> | null> {
	const identity = await getAuthenticatedIdentity(ctx);
	if (!identity) {
		return null;
	}

	return await ctx.db
		.query('auth_identities')
		.withIndex('by_tokenIdentifier', (query) =>
			query.eq('tokenIdentifier', identity.tokenIdentifier)
		)
		.unique();
}

export async function getCurrentUser(ctx: FunctionCtx): Promise<Doc<'users'> | null> {
	const authIdentity = await getCurrentAuthIdentity(ctx);
	if (!authIdentity) {
		return null;
	}

	return await ctx.db.get(authIdentity.userId);
}
