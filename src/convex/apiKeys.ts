import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireWorkspaceMember, requireWorkspaceOwner } from './lib/waivers';
import { API_KEY_NAME_MAX_LENGTH, API_KEY_PREFIX, randomToken, sha256Hex } from './lib/webhooks';

const MAX_API_KEYS_PER_WORKSPACE = 10;
// Avoid a write on every API request: refresh "last used" at most this often.
const LAST_USED_REFRESH_MS = 5 * 60 * 1000;
const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 4;

const apiKeySummary = v.object({
	apiKeyId: v.id('api_keys'),
	name: v.string(),
	keyPrefix: v.string(),
	createdAt: v.number(),
	lastUsedAt: v.union(v.number(), v.null())
});

function normalizeKeyName(raw: string): string {
	const name = raw.trim();
	if (!name) {
		throw new ConvexError({ code: 'invalid_argument', message: 'Give the API key a name.' });
	}
	if (name.length > API_KEY_NAME_MAX_LENGTH) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `API key names must be ${API_KEY_NAME_MAX_LENGTH} characters or fewer.`
		});
	}
	return name;
}

export const listApiKeys = query({
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({ canManage: v.boolean(), keys: v.array(apiKeySummary) }),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceMember(ctx, args.workspaceId);
		if (membership.role !== 'owner') return { canManage: false, keys: [] };

		const keys = await ctx.db
			.query('api_keys')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(MAX_API_KEYS_PER_WORKSPACE);
		return {
			canManage: true,
			keys: keys.map((key) => ({
				apiKeyId: key._id,
				name: key.name,
				keyPrefix: key.keyPrefix,
				createdAt: key.createdAt,
				lastUsedAt: key.lastUsedAt ?? null
			}))
		};
	}
});

// The plaintext key is generated in an action (unseeded randomness), returned once, and only its
// SHA-256 hash is stored.
export const createApiKey = action({
	args: { workspaceId: v.id('workspaces'), name: v.string() },
	returns: v.object({ apiKeyId: v.id('api_keys'), key: v.string() }),
	handler: async (ctx, args): Promise<{ apiKeyId: Id<'api_keys'>; key: string }> => {
		const name = normalizeKeyName(args.name);
		const key = randomToken(API_KEY_PREFIX);
		const apiKeyId: Id<'api_keys'> = await ctx.runMutation(internal.apiKeys.insertApiKey, {
			workspaceId: args.workspaceId,
			name,
			keyHash: await sha256Hex(key),
			keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH)
		});
		return { apiKeyId, key };
	}
});

export const insertApiKey = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		name: v.string(),
		keyHash: v.string(),
		keyPrefix: v.string()
	},
	returns: v.id('api_keys'),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceOwner(ctx, args.workspaceId, 'manage API keys');
		const existing = await ctx.db
			.query('api_keys')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(MAX_API_KEYS_PER_WORKSPACE);
		if (existing.length >= MAX_API_KEYS_PER_WORKSPACE) {
			throw new ConvexError({
				code: 'limit_reached',
				message: `A workspace can have up to ${MAX_API_KEYS_PER_WORKSPACE} API keys. Revoke one first.`
			});
		}
		return await ctx.db.insert('api_keys', {
			workspaceId: args.workspaceId,
			name: normalizeKeyName(args.name),
			keyHash: args.keyHash,
			keyPrefix: args.keyPrefix,
			createdByUserId: user._id,
			createdAt: Date.now()
		});
	}
});

export const revokeApiKey = mutation({
	args: { workspaceId: v.id('workspaces'), apiKeyId: v.id('api_keys') },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'manage API keys');
		const key = await ctx.db.get(args.apiKeyId);
		if (!key || key.workspaceId !== args.workspaceId) {
			throw new ConvexError({ code: 'not_found', message: 'API key not found.' });
		}
		await ctx.db.delete(args.apiKeyId);
		return null;
	}
});

export const authenticateApiKey = internalQuery({
	args: { keyHash: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			apiKeyId: v.id('api_keys'),
			workspaceId: v.id('workspaces'),
			needsLastUsedRefresh: v.boolean()
		})
	),
	handler: async (ctx, args) => {
		const key = await ctx.db
			.query('api_keys')
			.withIndex('by_keyHash', (q) => q.eq('keyHash', args.keyHash))
			.unique();
		if (!key) return null;

		const workspace = await ctx.db.get(key.workspaceId);
		if (!workspace || workspace.status !== 'active') return null;

		return {
			apiKeyId: key._id,
			workspaceId: key.workspaceId,
			needsLastUsedRefresh: !key.lastUsedAt || Date.now() - key.lastUsedAt > LAST_USED_REFRESH_MS
		};
	}
});

export const markApiKeyUsed = internalMutation({
	args: { apiKeyId: v.id('api_keys') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const key = await ctx.db.get(args.apiKeyId);
		if (!key) return null;
		await ctx.db.patch(args.apiKeyId, { lastUsedAt: Date.now() });
		return null;
	}
});
