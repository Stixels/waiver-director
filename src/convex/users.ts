import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { getAuthenticatedIdentity, getCurrentAuthIdentity } from './lib/auth';

function getDisplayName(identity: {
	name?: string;
	givenName?: string;
	familyName?: string;
	nickname?: string;
	preferredUsername?: string;
}) {
	if (identity.name?.trim()) return identity.name.trim();

	const parts = [identity.givenName, identity.familyName].filter(
		(value): value is string => !!value?.trim()
	);
	if (parts.length > 0) return parts.join(' ');

	if (identity.nickname?.trim()) return identity.nickname.trim();
	if (identity.preferredUsername?.trim()) return identity.preferredUsername.trim();

	return undefined;
}

function buildUserFields(identity: {
	email?: string;
	pictureUrl?: string;
	name?: string;
	givenName?: string;
	familyName?: string;
	nickname?: string;
	preferredUsername?: string;
}) {
	const displayName = getDisplayName(identity);
	const primaryEmail = identity.email?.trim() || undefined;
	const imageUrl = identity.pictureUrl?.trim() || undefined;

	return {
		insertPayload: {
			...(displayName ? { displayName } : {}),
			...(primaryEmail ? { primaryEmail } : {}),
			...(imageUrl ? { imageUrl } : {})
		},
		updatePayload: {
			displayName: displayName ?? undefined,
			primaryEmail,
			imageUrl
		}
	};
}

function buildAuthIdentityFields(identity: {
	tokenIdentifier: string;
	email?: string;
	emailVerified?: boolean;
}) {
	const email = identity.email?.trim() || undefined;

	return {
		insertPayload: {
			tokenIdentifier: identity.tokenIdentifier,
			...(email ? { email } : {}),
			...(typeof identity.emailVerified === 'boolean'
				? { emailVerified: identity.emailVerified }
				: {})
		},
		updatePayload: {
			tokenIdentifier: identity.tokenIdentifier,
			email,
			emailVerified:
				typeof identity.emailVerified === 'boolean' ? identity.emailVerified : undefined
		}
	};
}

function reportDanglingAuthIdentity(authIdentity: { userId: string; provider: string }) {
	console.warn('[users.currentUser] Dangling auth identity: missing linked user record', {
		userId: authIdentity.userId,
		provider: authIdentity.provider
	});
	console.log('[metric] auth.dangling_identity', {
		userId: authIdentity.userId,
		provider: authIdentity.provider
	});
}

const currentUserValue = v.object({
	userId: v.id('users'),
	displayName: v.union(v.string(), v.null()),
	primaryEmail: v.union(v.string(), v.null()),
	authProvider: v.union(v.literal('clerk'), v.literal('better-auth')),
	tokenIdentifier: v.string()
});

function buildCurrentUserResult(args: {
	userId: Id<'users'>;
	displayName?: string;
	primaryEmail?: string;
	authProvider: 'clerk' | 'better-auth';
	tokenIdentifier: string;
}) {
	return {
		userId: args.userId,
		displayName: args.displayName ?? null,
		primaryEmail: args.primaryEmail ?? null,
		authProvider: args.authProvider,
		tokenIdentifier: args.tokenIdentifier
	};
}

export const currentUser = query({
	args: {},
	returns: v.union(v.null(), currentUserValue),
	handler: async (ctx) => {
		const authIdentity = await getCurrentAuthIdentity(ctx);
		if (!authIdentity) {
			return null;
		}

		const user = await ctx.db.get('users', authIdentity.userId);
		if (!user) {
			reportDanglingAuthIdentity({
				userId: authIdentity.userId,
				provider: authIdentity.provider
			});
			return null;
		}

		return buildCurrentUserResult({
			userId: user._id,
			displayName: user.displayName,
			primaryEmail: user.primaryEmail,
			authProvider: authIdentity.provider,
			tokenIdentifier: authIdentity.tokenIdentifier
		});
	}
});

export const ensureCurrentUser = mutation({
	args: {},
	returns: v.object({
		userId: v.id('users'),
		created: v.boolean(),
		currentUser: currentUserValue
	}),
	handler: async (ctx) => {
		const identity = await getAuthenticatedIdentity(ctx);
		if (!identity) {
			throw new Error('Not authenticated');
		}

		const existingAuthIdentity = await ctx.db
			.query('auth_identities')
			.withIndex('by_tokenIdentifier', (query) =>
				query.eq('tokenIdentifier', identity.tokenIdentifier)
			)
			.unique();

		const userFields = buildUserFields(identity);
		const authIdentityFields = buildAuthIdentityFields(identity);

		if (existingAuthIdentity) {
			const existingUser = await ctx.db.get('users', existingAuthIdentity.userId);
			const userId = existingUser
				? existingAuthIdentity.userId
				: await ctx.db.insert('users', userFields.insertPayload);

			await ctx.db.patch('auth_identities', existingAuthIdentity._id, {
				userId,
				...authIdentityFields.updatePayload
			});

			if (existingUser) {
				await ctx.db.patch('users', userId, userFields.updatePayload);
			}

			return {
				userId,
				created: false,
				currentUser: buildCurrentUserResult({
					userId,
					displayName: userFields.updatePayload.displayName,
					primaryEmail: userFields.updatePayload.primaryEmail,
					authProvider: existingAuthIdentity.provider,
					tokenIdentifier: identity.tokenIdentifier
				})
			};
		}

		const userId = await ctx.db.insert('users', userFields.insertPayload);

		await ctx.db.insert('auth_identities', {
			userId,
			provider: 'clerk',
			providerUserId: identity.subject,
			...authIdentityFields.insertPayload
		});

		return {
			userId,
			created: true,
			currentUser: buildCurrentUserResult({
				userId,
				displayName: userFields.updatePayload.displayName,
				primaryEmail: userFields.updatePayload.primaryEmail,
				authProvider: 'clerk',
				tokenIdentifier: identity.tokenIdentifier
			})
		};
	}
});
