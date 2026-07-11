import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { marketingIntegrationStatusValidator, marketingProviderValidator } from './lib/marketing';
import { requireWorkspaceMember, requireWorkspaceOwner } from './lib/waivers';

const CONNECTION_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CONTACT_SYNC_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CONTACT_SYNC_BATCH_SIZE = 100;
const DISCONNECTED_CONTACT_SYNC_ERROR = 'The marketing integration was disconnected.';

function providerName(provider: 'mailchimp' | 'constant_contact') {
	return provider === 'mailchimp' ? 'Mailchimp' : 'Constant Contact';
}

async function failQueuedContactSyncBatch(
	ctx: MutationCtx,
	integrationId: Id<'marketing_integrations'>,
	workspaceId: Id<'workspaces'>,
	disconnectedAt: number
) {
	const syncs = await ctx.db
		.query('marketing_contact_syncs')
		.withIndex('by_integrationId_and_status', (q) =>
			q.eq('integrationId', integrationId).eq('status', 'queued')
		)
		.take(CONTACT_SYNC_BATCH_SIZE);
	let failedCount = 0;
	for (const sync of syncs) {
		if (sync.workspaceId !== workspaceId || sync.createdAt > disconnectedAt) continue;
		await ctx.db.patch(sync._id, {
			status: 'failed',
			lastError: DISCONNECTED_CONTACT_SYNC_ERROR,
			updatedAt: disconnectedAt
		});
		failedCount += 1;
	}
	return failedCount;
}

const marketingIntegrationSummary = v.object({
	integrationId: v.id('marketing_integrations'),
	workspaceId: v.id('workspaces'),
	provider: marketingProviderValidator,
	status: marketingIntegrationStatusValidator,
	accountId: v.union(v.string(), v.null()),
	audienceId: v.union(v.string(), v.null()),
	audienceName: v.union(v.string(), v.null()),
	lastSyncError: v.union(v.string(), v.null()),
	connectedAt: v.union(v.number(), v.null()),
	canManage: v.boolean()
});

export const getWorkspaceMarketingIntegration = query({
	args: { workspaceId: v.id('workspaces'), provider: marketingProviderValidator },
	returns: v.union(v.null(), marketingIntegrationSummary),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceMember(ctx, args.workspaceId);
		const integration = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('provider', args.provider)
			)
			.unique();

		if (!integration) return null;
		return {
			integrationId: integration._id,
			workspaceId: integration.workspaceId,
			provider: integration.provider,
			status: integration.status,
			accountId: integration.accountId ?? null,
			audienceId: integration.audienceId ?? null,
			audienceName: integration.audienceName ?? null,
			lastSyncError: integration.lastSyncError ?? null,
			connectedAt: integration.connectedAt ?? null,
			canManage: membership.role === 'owner'
		};
	}
});

export const getOwnerAccessForAction = internalQuery({
	args: { workspaceId: v.id('workspaces'), provider: marketingProviderValidator },
	returns: v.object({
		userId: v.id('users'),
		workspaceSlug: v.string()
	}),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceOwner(
			ctx,
			args.workspaceId,
			`manage ${providerName(args.provider)}`
		);
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}
		return { userId: user._id, workspaceSlug: workspace.slug };
	}
});

export const createConnectionSession = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		provider: marketingProviderValidator,
		requestedByUserId: v.id('users'),
		state: v.string(),
		expiresAt: v.number()
	},
	returns: v.id('marketing_connection_sessions'),
	handler: async (ctx, args) => {
		return await ctx.db.insert('marketing_connection_sessions', {
			workspaceId: args.workspaceId,
			provider: args.provider,
			requestedByUserId: args.requestedByUserId,
			state: args.state,
			status: 'pending',
			createdAt: Date.now(),
			expiresAt: args.expiresAt
		});
	}
});

export const getPendingConnectionSession = internalQuery({
	args: { state: v.string(), provider: marketingProviderValidator },
	returns: v.union(
		v.null(),
		v.object({
			sessionId: v.id('marketing_connection_sessions'),
			workspaceId: v.id('workspaces'),
			workspaceSlug: v.string(),
			expiresAt: v.number()
		})
	),
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query('marketing_connection_sessions')
			.withIndex('by_state', (q) => q.eq('state', args.state))
			.unique();
		if (!session || session.provider !== args.provider || session.status !== 'pending') return null;

		const workspace = await ctx.db.get(session.workspaceId);
		if (!workspace) return null;
		return {
			sessionId: session._id,
			workspaceId: session.workspaceId,
			workspaceSlug: workspace.slug,
			expiresAt: session.expiresAt
		};
	}
});

export const markConnectionSession = internalMutation({
	args: {
		sessionId: v.id('marketing_connection_sessions'),
		status: v.union(v.literal('completed'), v.literal('failed'), v.literal('expired'))
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (session) await ctx.db.patch(session._id, { status: args.status });
		return null;
	}
});

export const pruneOldConnectionSessionsCron = internalMutation({
	args: {},
	returns: v.object({ deletedCount: v.number() }),
	handler: async (ctx) => {
		const cutoff = Date.now() - CONNECTION_SESSION_RETENTION_MS;
		const statuses = ['pending', 'expired', 'completed', 'failed'] as const;
		let deletedCount = 0;
		for (const status of statuses) {
			const sessions = await ctx.db
				.query('marketing_connection_sessions')
				.withIndex('by_status_and_createdAt', (q) => q.eq('status', status).lt('createdAt', cutoff))
				.take(100);
			for (const session of sessions) {
				await ctx.db.delete(session._id);
				deletedCount += 1;
			}
		}
		return { deletedCount };
	}
});

export const pruneOldContactSyncsCron = internalMutation({
	args: {},
	returns: v.object({ deletedCount: v.number() }),
	handler: async (ctx) => {
		const cutoff = Date.now() - CONTACT_SYNC_RETENTION_MS;
		const statuses = ['synced', 'failed'] as const;
		let deletedCount = 0;
		let hasMore = false;
		for (const status of statuses) {
			const syncs = await ctx.db
				.query('marketing_contact_syncs')
				.withIndex('by_status_and_updatedAt', (q) => q.eq('status', status).lt('updatedAt', cutoff))
				.take(CONTACT_SYNC_BATCH_SIZE);
			for (const sync of syncs) {
				await ctx.db.delete(sync._id);
				deletedCount += 1;
			}
			hasMore ||= syncs.length === CONTACT_SYNC_BATCH_SIZE;
		}
		if (hasMore) {
			await ctx.scheduler.runAfter(0, internal.marketingIntegrations.pruneOldContactSyncsCron, {});
		}
		return { deletedCount };
	}
});

export const saveOAuthConnection = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		provider: marketingProviderValidator,
		encryptedAccessToken: v.string(),
		encryptedRefreshToken: v.optional(v.string()),
		accessTokenExpiresAt: v.optional(v.number()),
		serverPrefix: v.optional(v.string()),
		accountId: v.optional(v.string())
	},
	returns: v.id('marketing_integrations'),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('provider', args.provider)
			)
			.unique();
		const now = Date.now();
		const value = {
			workspaceId: args.workspaceId,
			provider: args.provider,
			status: 'pending_configuration' as const,
			encryptedAccessToken: args.encryptedAccessToken,
			...(args.encryptedRefreshToken ? { encryptedRefreshToken: args.encryptedRefreshToken } : {}),
			...(args.accessTokenExpiresAt ? { accessTokenExpiresAt: args.accessTokenExpiresAt } : {}),
			...(args.serverPrefix ? { serverPrefix: args.serverPrefix } : {}),
			...(args.accountId ? { accountId: args.accountId } : {}),
			connectedAt: now,
			updatedAt: now
		};

		if (!existing) return await ctx.db.insert('marketing_integrations', value);
		await ctx.db.replace(existing._id, value);
		return existing._id;
	}
});

export const getConnectionForOwnerAction = internalQuery({
	args: { workspaceId: v.id('workspaces'), provider: marketingProviderValidator },
	returns: v.object({
		integrationId: v.id('marketing_integrations'),
		encryptedAccessToken: v.string(),
		encryptedRefreshToken: v.union(v.string(), v.null()),
		accessTokenExpiresAt: v.union(v.number(), v.null()),
		serverPrefix: v.union(v.string(), v.null())
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, `manage ${providerName(args.provider)}`);
		const integration = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('provider', args.provider)
			)
			.unique();
		if (
			!integration ||
			integration.status === 'disconnected' ||
			!integration.encryptedAccessToken
		) {
			throw new ConvexError({
				code: 'not_found',
				message: `${providerName(args.provider)} is not connected.`
			});
		}
		return {
			integrationId: integration._id,
			encryptedAccessToken: integration.encryptedAccessToken,
			encryptedRefreshToken: integration.encryptedRefreshToken ?? null,
			accessTokenExpiresAt: integration.accessTokenExpiresAt ?? null,
			serverPrefix: integration.serverPrefix ?? null
		};
	}
});

export const selectAudience = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		provider: marketingProviderValidator,
		integrationId: v.id('marketing_integrations'),
		audienceId: v.string(),
		audienceName: v.string()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, `configure ${providerName(args.provider)}`);
		const integration = await ctx.db.get(args.integrationId);
		if (
			!integration ||
			integration.workspaceId !== args.workspaceId ||
			integration.provider !== args.provider ||
			!integration.encryptedAccessToken
		) {
			throw new ConvexError({
				code: 'not_found',
				message: `${providerName(args.provider)} is not connected.`
			});
		}
		const now = Date.now();
		await ctx.db.patch(integration._id, {
			status: 'connected',
			audienceId: args.audienceId,
			audienceName: args.audienceName,
			connectedAt: integration.connectedAt ?? now,
			disconnectedAt: undefined,
			updatedAt: now
		});
		return null;
	}
});

export const disconnectMarketingIntegration = mutation({
	args: { workspaceId: v.id('workspaces'), provider: marketingProviderValidator },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, `disconnect ${providerName(args.provider)}`);
		const integration = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('provider', args.provider)
			)
			.unique();
		if (!integration) return null;
		const now = Date.now();
		await ctx.db.patch(integration._id, {
			status: 'disconnected',
			encryptedAccessToken: undefined,
			encryptedRefreshToken: undefined,
			accessTokenExpiresAt: undefined,
			serverPrefix: undefined,
			audienceId: undefined,
			audienceName: undefined,
			lastSyncError: undefined,
			disconnectedAt: now,
			updatedAt: now
		});
		const failedCount = await failQueuedContactSyncBatch(
			ctx,
			integration._id,
			args.workspaceId,
			now
		);
		if (failedCount === CONTACT_SYNC_BATCH_SIZE) {
			await ctx.scheduler.runAfter(
				0,
				internal.marketingIntegrations.failQueuedContactSyncsForDisconnectedIntegration,
				{ integrationId: integration._id, workspaceId: args.workspaceId, disconnectedAt: now }
			);
		}
		return null;
	}
});

export const failQueuedContactSyncsForDisconnectedIntegration = internalMutation({
	args: {
		integrationId: v.id('marketing_integrations'),
		workspaceId: v.id('workspaces'),
		disconnectedAt: v.number()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const failedCount = await failQueuedContactSyncBatch(
			ctx,
			args.integrationId,
			args.workspaceId,
			args.disconnectedAt
		);
		if (failedCount === CONTACT_SYNC_BATCH_SIZE) {
			await ctx.scheduler.runAfter(
				0,
				internal.marketingIntegrations.failQueuedContactSyncsForDisconnectedIntegration,
				args
			);
		}
		return null;
	}
});

export const getContactSyncContext = internalQuery({
	args: { syncId: v.id('marketing_contact_syncs') },
	returns: v.union(
		v.null(),
		v.object({
			syncId: v.id('marketing_contact_syncs'),
			integrationId: v.id('marketing_integrations'),
			provider: marketingProviderValidator,
			audienceId: v.string(),
			signerEmail: v.string(),
			encryptedAccessToken: v.string(),
			encryptedRefreshToken: v.union(v.string(), v.null()),
			accessTokenExpiresAt: v.union(v.number(), v.null()),
			serverPrefix: v.union(v.string(), v.null()),
			attempts: v.number()
		})
	),
	handler: async (ctx, args) => {
		const sync = await ctx.db.get(args.syncId);
		if (!sync || sync.status === 'synced') return null;
		const [integration, submission] = await Promise.all([
			ctx.db.get(sync.integrationId),
			ctx.db.get(sync.submissionId)
		]);
		if (
			!integration ||
			!submission ||
			integration.workspaceId !== sync.workspaceId ||
			submission.workspaceId !== sync.workspaceId ||
			integration.status !== 'connected' ||
			!integration.encryptedAccessToken ||
			!submission.marketingConsent
		) {
			return null;
		}
		return {
			syncId: sync._id,
			integrationId: integration._id,
			provider: integration.provider,
			audienceId: sync.audienceId,
			signerEmail: submission.signerEmail,
			encryptedAccessToken: integration.encryptedAccessToken,
			encryptedRefreshToken: integration.encryptedRefreshToken ?? null,
			accessTokenExpiresAt: integration.accessTokenExpiresAt ?? null,
			serverPrefix: integration.serverPrefix ?? null,
			attempts: sync.attempts
		};
	}
});

export const saveRefreshedAccessToken = internalMutation({
	args: {
		integrationId: v.id('marketing_integrations'),
		provider: v.literal('constant_contact'),
		encryptedAccessToken: v.string(),
		encryptedRefreshToken: v.string(),
		accessTokenExpiresAt: v.number()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (
			!integration ||
			integration.provider !== args.provider ||
			integration.status === 'disconnected'
		) {
			throw new ConvexError({ code: 'not_found', message: 'Constant Contact is not connected.' });
		}
		await ctx.db.patch(integration._id, {
			encryptedAccessToken: args.encryptedAccessToken,
			encryptedRefreshToken: args.encryptedRefreshToken,
			accessTokenExpiresAt: args.accessTokenExpiresAt,
			updatedAt: Date.now()
		});
		return null;
	}
});

export const markContactSyncSucceeded = internalMutation({
	args: {
		syncId: v.id('marketing_contact_syncs'),
		integrationId: v.id('marketing_integrations')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const sync = await ctx.db.get(args.syncId);
		if (sync) {
			await ctx.db.patch(sync._id, {
				status: 'synced',
				attempts: sync.attempts + 1,
				syncedAt: now,
				updatedAt: now
			});
		}
		const integration = await ctx.db.get(args.integrationId);
		if (integration) {
			await ctx.db.patch(integration._id, { lastSyncError: undefined, updatedAt: now });
		}
		return null;
	}
});

export const markContactSyncFailed = internalMutation({
	args: {
		syncId: v.id('marketing_contact_syncs'),
		integrationId: v.id('marketing_integrations'),
		error: v.string()
	},
	returns: v.object({ attempts: v.number() }),
	handler: async (ctx, args) => {
		const now = Date.now();
		const sync = await ctx.db.get(args.syncId);
		const attempts = (sync?.attempts ?? 0) + 1;
		if (sync) {
			await ctx.db.patch(sync._id, {
				status: 'failed',
				attempts,
				lastError: args.error,
				updatedAt: now
			});
		}
		const integration = await ctx.db.get(args.integrationId);
		if (integration) {
			await ctx.db.patch(integration._id, { lastSyncError: args.error, updatedAt: now });
		}
		return { attempts };
	}
});
