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
import {
	getOwnedWorkspaceLogoUrl,
	getWorkspaceMembership,
	listWorkspaceMembershipsForUser
} from './lib/workspaces';

const WORKSPACE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])$/;
const RESERVED_SLUGS = ['workspaces'];
const WORKSPACE_LOGO_ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const WORKSPACE_LOGO_MAX_BYTES = 2 * 1024 * 1024;
const WORKSPACE_LOGO_UPLOAD_TTL_MS = 30 * 60 * 1000;

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
	workspace_logo_uploads: true,
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
const WORKSPACE_PRIMARY_CLEANUP_TABLE_NAMES = WORKSPACE_CLEANUP_TABLE_NAMES.filter(
	(tableName) => tableName !== 'workspace_logo_uploads'
);
const CLEANUP_BATCH_PER_TABLE = 50;
const USER_DEFAULT_WORKSPACE_CLEANUP_BATCH = 50;

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
	returns: v.object({
		uploadUrl: v.string(),
		uploadToken: v.string()
	}),
	handler: async (ctx, args) => {
		const access = await requireWorkspaceOwner(ctx, args.workspaceId, 'change workspace branding');
		const issuedAt = Date.now();
		const uploadToken = crypto.randomUUID();
		const uploadUrl = await ctx.storage.generateUploadUrl();

		await ctx.db.insert('workspace_logo_uploads', {
			workspaceId: args.workspaceId,
			requestedByUserId: access.user._id,
			uploadToken,
			status: 'issued',
			createdAt: issuedAt,
			expiresAt: issuedAt + WORKSPACE_LOGO_UPLOAD_TTL_MS
		});

		return { uploadUrl, uploadToken };
	}
});

export const setWorkspaceLogo = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		storageId: v.id('_storage'),
		uploadToken: v.string()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const access = await requireWorkspaceOwner(ctx, args.workspaceId, 'change workspace branding');

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		const issuedUpload = await ctx.db
			.query('workspace_logo_uploads')
			.withIndex('by_uploadToken', (query) => query.eq('uploadToken', args.uploadToken.trim()))
			.unique();
		if (
			!issuedUpload ||
			issuedUpload.workspaceId !== args.workspaceId ||
			issuedUpload.requestedByUserId !== access.user._id ||
			issuedUpload.status !== 'issued'
		) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Logo upload was not issued for this workspace.'
			});
		}
		const now = Date.now();
		if (issuedUpload.expiresAt < now) {
			await ctx.db.patch(issuedUpload._id, { status: 'expired' });
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Logo upload expired. Please upload the file again.'
			});
		}

		const metadata = await ctx.db.system.get(args.storageId);
		if (!metadata) {
			throw new ConvexError({ code: 'not_found', message: 'Uploaded logo file not found.' });
		}
		if (!metadata.contentType || !WORKSPACE_LOGO_ALLOWED_CONTENT_TYPES.has(metadata.contentType)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Logo must be a PNG, JPEG, or WebP image.'
			});
		}
		if (metadata.size > WORKSPACE_LOGO_MAX_BYTES) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Logo must be 2MB or smaller.'
			});
		}

		const existingUpload = await ctx.db
			.query('workspace_logo_uploads')
			.withIndex('by_storageId', (query) => query.eq('storageId', args.storageId))
			.first();
		if (existingUpload && existingUpload._id !== issuedUpload._id) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Logo file is already assigned.'
			});
		}

		const previousLogo = workspace.logoStorageId;
		let previousLogoOwned = false;
		if (previousLogo && previousLogo !== args.storageId) {
			const previousUpload = await ctx.db
				.query('workspace_logo_uploads')
				.withIndex('by_workspaceId_and_storageId', (query) =>
					query.eq('workspaceId', args.workspaceId).eq('storageId', previousLogo)
				)
				.first();
			if (previousUpload?.status === 'consumed') {
				previousLogoOwned = true;
				await ctx.db.patch(previousUpload._id, {
					status: 'removed',
					removedAt: now
				});
			}
		}

		await ctx.db.patch(issuedUpload._id, {
			status: 'consumed',
			storageId: args.storageId,
			consumedAt: now
		});
		await ctx.db.patch(args.workspaceId, { logoStorageId: args.storageId });

		if (previousLogo && previousLogo !== args.storageId && previousLogoOwned) {
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
		const logoUpload = await ctx.db
			.query('workspace_logo_uploads')
			.withIndex('by_workspaceId_and_storageId', (query) =>
				query.eq('workspaceId', args.workspaceId).eq('storageId', previousLogo)
			)
			.first();

		await ctx.db.patch(args.workspaceId, { logoStorageId: undefined });
		if (logoUpload?.status === 'consumed') {
			await ctx.db.patch(logoUpload._id, {
				status: 'removed',
				removedAt: Date.now()
			});
			await ctx.storage.delete(previousLogo);
		}
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

async function findFallbackDefaultWorkspaceId(
	ctx: MutationCtx,
	userId: Id<'users'>,
	deletedWorkspaceId: Id<'workspaces'>
): Promise<Id<'workspaces'> | undefined> {
	const memberships = await listWorkspaceMembershipsForUser(ctx, userId);

	for (const membership of memberships) {
		if (membership.workspaceId === deletedWorkspaceId || membership.status !== 'active') {
			continue;
		}

		const workspace = await ctx.db.get(membership.workspaceId);
		if (workspace?.status === 'active') {
			return workspace._id;
		}
	}

	return undefined;
}

async function clearDeletedDefaultWorkspaceReferences(
	ctx: MutationCtx,
	workspaceId: Id<'workspaces'>
): Promise<{ updated: number; hasMore: boolean }> {
	const users = await ctx.db
		.query('users')
		.withIndex('by_defaultWorkspaceId', (query) => query.eq('defaultWorkspaceId', workspaceId))
		.take(USER_DEFAULT_WORKSPACE_CLEANUP_BATCH);

	for (const user of users) {
		const fallbackWorkspaceId = await findFallbackDefaultWorkspaceId(ctx, user._id, workspaceId);
		await ctx.db.patch(user._id, { defaultWorkspaceId: fallbackWorkspaceId });
	}

	return {
		updated: users.length,
		hasMore: users.length === USER_DEFAULT_WORKSPACE_CLEANUP_BATCH
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

		const defaultWorkspaceCleanup = await clearDeletedDefaultWorkspaceReferences(
			ctx,
			args.workspaceId
		);
		if (defaultWorkspaceCleanup.hasMore) {
			await ctx.scheduler.runAfter(0, internal.workspaces.cleanupArchivedWorkspace, {
				workspaceId: args.workspaceId
			});
			return null;
		}

		let ownedLogoStorageId: Id<'_storage'> | null = null;
		if (workspace.logoStorageId) {
			const logoUpload = await ctx.db
				.query('workspace_logo_uploads')
				.withIndex('by_workspaceId_and_storageId', (query) =>
					query.eq('workspaceId', args.workspaceId).eq('storageId', workspace.logoStorageId)
				)
				.first();
			if (logoUpload?.status === 'consumed') {
				ownedLogoStorageId = workspace.logoStorageId;
			}
		}

		let hasMore = false;
		for (const tableName of WORKSPACE_PRIMARY_CLEANUP_TABLE_NAMES) {
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

		if (ownedLogoStorageId) {
			try {
				await ctx.storage.delete(ownedLogoStorageId);
			} catch (error) {
				console.warn('[cleanupArchivedWorkspace] failed to delete logo storage', {
					workspaceId: args.workspaceId,
					storageId: ownedLogoStorageId,
					error
				});
			}
		}

		const logoUploadCleanup = await deleteWorkspaceTableBatch(
			ctx,
			'workspace_logo_uploads',
			args.workspaceId
		);
		if (logoUploadCleanup.hasMore) {
			await ctx.scheduler.runAfter(0, internal.workspaces.cleanupArchivedWorkspace, {
				workspaceId: args.workspaceId
			});
			return null;
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

		const logoUrl = await getOwnedWorkspaceLogoUrl(ctx, workspace);

		return {
			workspaceId: workspace._id,
			name: workspace.name,
			slug: workspace.slug,
			logoUrl: logoUrl ?? null,
			logoStorageId: logoUrl ? (workspace.logoStorageId ?? null) : null
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
