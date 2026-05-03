import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id, TableNames } from './_generated/dataModel';
import { getCurrentUser } from './lib/auth';
import {
	createDefaultPublicWaiverSlug,
	createDefaultWaiverDefinition,
	requireWorkspaceMember,
	requireWorkspaceOwner
} from './lib/waivers';
import { getWorkspaceMembership, listWorkspaceMembershipsForUser } from './lib/workspaces';

const WORKSPACE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])$/;
const RESERVED_SLUGS = ['workspaces'];

type WorkspaceScopedTableName = {
	[TableName in TableNames]: Doc<TableName> extends { workspaceId: Id<'workspaces'> }
		? TableName
		: never;
}[TableNames];

const WORKSPACE_SCOPED_TABLES = {
	workspace_memberships: true,
	workspace_waivers: true,
	waiver_versions: true,
	customers: true,
	waiver_submissions: true,
	email_editor_content: true,
	email_templates: true,
	workspace_email_settings: true,
	email_follow_ups: true,
	booking_integrations: true,
	booking_connection_sessions: true,
	bookings: true,
	booking_webhook_events: true
} as const satisfies Record<WorkspaceScopedTableName, true>;
type WorkspaceCleanupTableName = keyof typeof WORKSPACE_SCOPED_TABLES;
const WORKSPACE_CLEANUP_TABLE_NAMES = Object.keys(
	WORKSPACE_SCOPED_TABLES
) as WorkspaceCleanupTableName[];
const CLEANUP_BATCH_PER_TABLE = 50;

export const createWorkspace = mutation({
	args: {
		name: v.string(),
		slug: v.string()
	},
	returns: v.object({
		workspaceId: v.id('workspaces'),
		slug: v.string()
	}),
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!user) {
			throw new ConvexError({
				code: 'unauthenticated',
				message: 'Not authenticated'
			});
		}

		const name = args.name.trim();
		const slug = args.slug.trim().toLowerCase();

		if (name.length < 2 || name.length > 80) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Workspace name must be between 2 and 80 characters.'
			});
		}
		if (!WORKSPACE_SLUG_REGEX.test(slug)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message:
					'Workspace slug must be 2-48 characters: lowercase letters, numbers, and hyphens only. It must start and end with a letter or number.'
			});
		}
		if (RESERVED_SLUGS.includes(slug)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `Workspace slug "${slug}" is reserved and cannot be used.`
			});
		}

		const existing = await ctx.db
			.query('workspaces')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		if (existing) {
			throw new ConvexError({
				code: 'already_exists',
				message: 'Workspace slug already in use'
			});
		}

		const workspaceId = await ctx.db.insert('workspaces', {
			name,
			slug,
			status: 'active',
			createdByUserId: user._id,
			customerCount: 0
		});

		await ctx.db.insert('workspace_memberships', {
			workspaceId,
			userId: user._id,
			role: 'owner',
			status: 'active'
		});

		const waiverDefinition = createDefaultWaiverDefinition(name);
		await ctx.db.insert('workspace_waivers', {
			workspaceId,
			publicSlug: createDefaultPublicWaiverSlug(slug),
			title: waiverDefinition.title,
			introCopy: waiverDefinition.introCopy,
			fields: waiverDefinition.fields
		});

		if (!user.defaultWorkspaceId) {
			await ctx.db.patch('users', user._id, {
				defaultWorkspaceId: workspaceId
			});
		}

		return { workspaceId, slug };
	}
});

export const listCurrentUserWorkspaces = query({
	args: {},
	returns: v.array(
		v.object({
			workspaceId: v.id('workspaces'),
			name: v.string(),
			slug: v.string(),
			role: v.union(v.literal('owner'), v.literal('staff')),
			status: v.union(v.literal('active'), v.literal('invited'), v.literal('suspended'))
		})
	),
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		if (!user) {
			return [];
		}

		const memberships = await listWorkspaceMembershipsForUser(ctx, user._id);
		const workspaceIds = memberships.map((membership) => membership.workspaceId);
		const workspaceDocs = await Promise.all(
			workspaceIds.map((workspaceId) => ctx.db.get(workspaceId))
		);

		const workspaces = memberships.map((membership, index) => {
			const workspace = workspaceDocs[index];
			if (!workspace) {
				console.warn('[workspaces.listCurrentUserWorkspaces] Missing workspace for membership', {
					membershipId: membership._id,
					workspaceId: membership.workspaceId
				});
				console.log('[metric] membership_missing_workspace', {
					membershipId: membership._id,
					workspaceId: membership.workspaceId
				});
				return null;
			}

			if (workspace.status === 'archived') {
				return null;
			}

			return {
				workspaceId: workspace._id,
				name: workspace.name,
				slug: workspace.slug,
				role: membership.role,
				status: membership.status
			};
		});

		return workspaces.filter((workspace) => workspace !== null);
	}
});

export const updateWorkspace = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		name: v.optional(v.string()),
		slug: v.optional(v.string())
	},
	returns: v.object({
		workspaceId: v.id('workspaces'),
		name: v.string(),
		slug: v.string(),
		slugChanged: v.boolean()
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change workspace settings');

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		const patch: { name?: string; slug?: string } = {};
		let slugChanged = false;

		if (args.name !== undefined) {
			const name = args.name.trim();
			if (name.length < 2 || name.length > 80) {
				throw new ConvexError({
					code: 'invalid_argument',
					message: 'Workspace name must be between 2 and 80 characters.'
				});
			}
			if (name !== workspace.name) patch.name = name;
		}

		if (args.slug !== undefined) {
			const slug = args.slug.trim().toLowerCase();
			if (!WORKSPACE_SLUG_REGEX.test(slug)) {
				throw new ConvexError({
					code: 'invalid_argument',
					message:
						'Workspace slug must be 2-48 characters: lowercase letters, numbers, and hyphens only. It must start and end with a letter or number.'
				});
			}
			if (RESERVED_SLUGS.includes(slug)) {
				throw new ConvexError({
					code: 'invalid_argument',
					message: `Workspace slug "${slug}" is reserved and cannot be used.`
				});
			}
			if (slug !== workspace.slug) {
				const existing = await ctx.db
					.query('workspaces')
					.withIndex('by_slug', (q) => q.eq('slug', slug))
					.unique();
				if (existing && existing._id !== args.workspaceId) {
					throw new ConvexError({
						code: 'already_exists',
						message: 'Workspace slug already in use'
					});
				}
				patch.slug = slug;
				slugChanged = true;
			}
		}

		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(args.workspaceId, patch);
		}

		const next = await ctx.db.get(args.workspaceId);
		if (!next) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found after update.' });
		}

		return {
			workspaceId: next._id,
			name: next.name,
			slug: next.slug,
			slugChanged
		};
	}
});

export const generateLogoUploadUrl = mutation({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change workspace branding');
		return await ctx.storage.generateUploadUrl();
	}
});

export const setWorkspaceLogo = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		storageId: v.id('_storage')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change workspace branding');

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		const previousLogo = workspace.logoStorageId;
		await ctx.db.patch(args.workspaceId, { logoStorageId: args.storageId });

		if (previousLogo && previousLogo !== args.storageId) {
			await ctx.storage.delete(previousLogo);
		}

		return null;
	}
});

export const removeWorkspaceLogo = mutation({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change workspace branding');

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		if (!workspace.logoStorageId) {
			return null;
		}

		const previousLogo = workspace.logoStorageId;
		await ctx.db.patch(args.workspaceId, { logoStorageId: undefined });
		await ctx.storage.delete(previousLogo);
		return null;
	}
});

export const archiveWorkspace = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		confirmSlug: v.string()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'delete the workspace');

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		if (args.confirmSlug.trim() !== workspace.slug) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Confirmation text does not match the workspace slug.'
			});
		}

		if (workspace.status !== 'archived') {
			await ctx.db.patch(args.workspaceId, {
				status: 'archived',
				archivedAt: Date.now()
			});
		}

		await ctx.scheduler.runAfter(0, internal.workspaces.cleanupArchivedWorkspace, {
			workspaceId: args.workspaceId
		});

		return null;
	}
});

async function deleteWorkspaceTableBatch(
	ctx: MutationCtx,
	tableName: WorkspaceCleanupTableName,
	workspaceId: Id<'workspaces'>
): Promise<{ deleted: number; hasMore: boolean }> {
	const rows = await ctx.db
		.query(tableName)
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.take(CLEANUP_BATCH_PER_TABLE);

	for (const row of rows) {
		if (tableName === 'email_follow_ups') {
			const followUp = row as { scheduledFunctionId?: Id<'_scheduled_functions'> };
			if (followUp.scheduledFunctionId) {
				try {
					await ctx.scheduler.cancel(followUp.scheduledFunctionId);
				} catch (error) {
					console.warn('[cleanupArchivedWorkspace] failed to cancel scheduled follow-up', {
						scheduledFunctionId: followUp.scheduledFunctionId,
						error
					});
				}
			}
		}
		await ctx.db.delete(row._id);
	}

	return {
		deleted: rows.length,
		hasMore: rows.length === CLEANUP_BATCH_PER_TABLE
	};
}

export const cleanupArchivedWorkspace = internalMutation({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			return null;
		}

		if (workspace.status !== 'archived') {
			console.warn('[cleanupArchivedWorkspace] workspace is not archived, aborting cleanup', {
				workspaceId: args.workspaceId,
				status: workspace.status
			});
			return null;
		}

		let hasMore = false;
		for (const tableName of WORKSPACE_CLEANUP_TABLE_NAMES) {
			const result = await deleteWorkspaceTableBatch(ctx, tableName, args.workspaceId);
			if (result.hasMore) {
				hasMore = true;
			}
		}

		if (hasMore) {
			await ctx.scheduler.runAfter(0, internal.workspaces.cleanupArchivedWorkspace, {
				workspaceId: args.workspaceId
			});
			return null;
		}

		if (workspace.logoStorageId) {
			try {
				await ctx.storage.delete(workspace.logoStorageId);
			} catch (error) {
				console.warn('[cleanupArchivedWorkspace] failed to delete logo storage', {
					workspaceId: args.workspaceId,
					storageId: workspace.logoStorageId,
					error
				});
			}
		}

		await ctx.db.delete(args.workspaceId);
		return null;
	}
});

export const getWorkspaceBranding = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.union(
		v.null(),
		v.object({
			workspaceId: v.id('workspaces'),
			name: v.string(),
			slug: v.string(),
			logoUrl: v.union(v.string(), v.null()),
			logoStorageId: v.union(v.id('_storage'), v.null())
		})
	),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			return null;
		}

		const logoUrl = workspace.logoStorageId
			? await ctx.storage.getUrl(workspace.logoStorageId)
			: null;

		return {
			workspaceId: workspace._id,
			name: workspace.name,
			slug: workspace.slug,
			logoUrl: logoUrl ?? null,
			logoStorageId: workspace.logoStorageId ?? null
		};
	}
});

export const currentWorkspaceMembership = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.union(
		v.null(),
		v.object({
			workspaceId: v.id('workspaces'),
			role: v.union(v.literal('owner'), v.literal('staff')),
			status: v.union(v.literal('active'), v.literal('invited'), v.literal('suspended'))
		})
	),
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!user) {
			return null;
		}

		const membership = await getWorkspaceMembership(ctx, args.workspaceId, user._id);
		if (!membership) {
			return null;
		}

		return {
			workspaceId: membership.workspaceId,
			role: membership.role,
			status: membership.status
		};
	}
});
