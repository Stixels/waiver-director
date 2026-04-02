import { v } from 'convex/values';
import { query } from './_generated/server';
import { getAuthenticatedIdentity, getCurrentAuthIdentity, getCurrentUser } from './lib/auth';

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
		const [identity, authIdentity, user] = await Promise.all([
			getAuthenticatedIdentity(ctx),
			getCurrentAuthIdentity(ctx),
			getCurrentUser(ctx)
		]);

		if (!identity || !authIdentity || !user) {
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
