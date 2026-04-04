import { v } from 'convex/values';
import { query } from './_generated/server';
import { getCurrentAuthIdentity } from './lib/auth';

function reportDanglingAuthIdentity(authIdentity: { userId: string; tokenIdentifier: string; provider: string }) {
	console.warn('[users.currentUser] Dangling auth identity: missing linked user record', {
		userId: authIdentity.userId,
		tokenIdentifier: authIdentity.tokenIdentifier,
		provider: authIdentity.provider
	});
	console.log('[metric] auth.dangling_identity', {
		userId: authIdentity.userId,
		tokenIdentifier: authIdentity.tokenIdentifier,
		provider: authIdentity.provider
	});
}

export const currentUser = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			userId: v.id('users'),
			displayName: v.union(v.string(), v.null()),
			primaryEmail: v.union(v.string(), v.null()),
			authProvider: v.union(v.literal('clerk'), v.literal('better-auth')),
			tokenIdentifier: v.string()
		})
	),
	handler: async (ctx) => {
		const authIdentity = await getCurrentAuthIdentity(ctx);
		if (!authIdentity) {
			return null;
		}

		const user = await ctx.db.get(authIdentity.userId);
		if (!user) {
			reportDanglingAuthIdentity({
				userId: authIdentity.userId,
				tokenIdentifier: authIdentity.tokenIdentifier,
				provider: authIdentity.provider
			});
			return null;
		}

		return {
			userId: user._id,
			displayName: user.displayName ?? null,
			primaryEmail: user.primaryEmail ?? null,
			authProvider: authIdentity.provider,
			tokenIdentifier: authIdentity.tokenIdentifier
		};
	}
});
