import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { marketingIntegrationStatusValidator, marketingProviderValidator } from './lib/marketing';
import { requireWorkspaceMember, requireWorkspaceOwner } from './lib/waivers';

const CONNECTION_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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
	args: { workspaceId: v.id('workspaces') },
	returns: v.union(v.null(), marketingIntegrationSummary),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceMember(ctx, args.workspaceId);
		const integration = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('provider', 'mailchimp')
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
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({
		userId: v.id('users'),
		workspaceSlug: v.string()
	}),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceOwner(ctx, args.workspaceId, 'manage Mailchimp');
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
		requestedByUserId: v.id('users'),
		state: v.string(),
		expiresAt: v.number()
	},
	returns: v.id('marketing_connection_sessions'),
	handler: async (ctx, args) => {
		return await ctx.db.insert('marketing_connection_sessions', {
			workspaceId: args.workspaceId,
			provider: 'mailchimp',
			requestedByUserId: args.requestedByUserId,
			state: args.state,
			status: 'pending',
			createdAt: Date.now(),
			expiresAt: args.expiresAt
		});
	}
});

export const getPendingConnectionSession = internalQuery({
	args: { state: v.string() },
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
		if (!session || session.provider !== 'mailchimp' || session.status !== 'pending') return null;

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

export const saveOAuthConnection = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		encryptedAccessToken: v.string(),
		serverPrefix: v.string(),
		accountId: v.optional(v.string())
	},
	returns: v.id('marketing_integrations'),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('provider', 'mailchimp')
			)
			.unique();
		const now = Date.now();
		const value = {
			workspaceId: args.workspaceId,
			provider: 'mailchimp' as const,
			status: 'pending_configuration' as const,
			encryptedAccessToken: args.encryptedAccessToken,
			serverPrefix: args.serverPrefix,
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
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({
		integrationId: v.id('marketing_integrations'),
		encryptedAccessToken: v.string(),
		serverPrefix: v.string()
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'manage Mailchimp');
		const integration = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('provider', 'mailchimp')
			)
			.unique();
		if (
			!integration ||
			integration.status === 'disconnected' ||
			!integration.encryptedAccessToken ||
			!integration.serverPrefix
		) {
			throw new ConvexError({ code: 'not_found', message: 'Mailchimp is not connected.' });
		}
		return {
			integrationId: integration._id,
			encryptedAccessToken: integration.encryptedAccessToken,
			serverPrefix: integration.serverPrefix
		};
	}
});

export const selectAudience = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		integrationId: v.id('marketing_integrations'),
		audienceId: v.string(),
		audienceName: v.string()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'configure Mailchimp');
		const integration = await ctx.db.get(args.integrationId);
		if (
			!integration ||
			integration.workspaceId !== args.workspaceId ||
			integration.provider !== 'mailchimp' ||
			!integration.encryptedAccessToken ||
			!integration.serverPrefix
		) {
			throw new ConvexError({ code: 'not_found', message: 'Mailchimp is not connected.' });
		}
		const now = Date.now();
		await ctx.db.replace(integration._id, {
			workspaceId: integration.workspaceId,
			provider: 'mailchimp',
			status: 'connected',
			encryptedAccessToken: integration.encryptedAccessToken,
			serverPrefix: integration.serverPrefix,
			...(integration.accountId ? { accountId: integration.accountId } : {}),
			audienceId: args.audienceId,
			audienceName: args.audienceName,
			connectedAt: integration.connectedAt ?? now,
			updatedAt: now
		});
		return null;
	}
});

export const disconnectMailchimp = mutation({
	args: { workspaceId: v.id('workspaces') },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'disconnect Mailchimp');
		const integration = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('provider', 'mailchimp')
			)
			.unique();
		if (!integration) return null;
		const now = Date.now();
		await ctx.db.replace(integration._id, {
			workspaceId: integration.workspaceId,
			provider: 'mailchimp',
			status: 'disconnected',
			disconnectedAt: now,
			updatedAt: now
		});
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
			audienceId: v.string(),
			signerEmail: v.string(),
			encryptedAccessToken: v.string(),
			serverPrefix: v.string(),
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
			!integration.serverPrefix ||
			!submission.marketingConsent
		) {
			return null;
		}
		return {
			syncId: sync._id,
			integrationId: integration._id,
			audienceId: sync.audienceId,
			signerEmail: submission.signerEmail,
			encryptedAccessToken: integration.encryptedAccessToken,
			serverPrefix: integration.serverPrefix,
			attempts: sync.attempts
		};
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
