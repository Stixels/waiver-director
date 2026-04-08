import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getCurrentUser } from './lib/auth';
import { getWorkspaceMembership, listWorkspaceMembershipsForUser } from './lib/workspaces';

const WORKSPACE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])$/;

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
		if (!user) throw new Error('Not authenticated');

		const name = args.name.trim();
		const slug = args.slug.trim().toLowerCase();

		if (name.length < 2 || name.length > 80) {
			throw new Error('Workspace name must be between 2 and 80 characters.');
		}
		if (!WORKSPACE_SLUG_REGEX.test(slug)) {
			throw new Error(
				'Workspace slug must be 2-48 characters: lowercase letters, numbers, and hyphens only. It must start and end with a letter or number.'
			);
		}

		const existing = await ctx.db
			.query('workspaces')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		if (existing) throw new Error('This workspace slug is already taken. Please choose another.');

		const workspaceId = await ctx.db.insert('workspaces', {
			name,
			slug,
			status: 'active',
			createdByUserId: user._id
		});

		await ctx.db.insert('workspace_memberships', {
			workspaceId,
			userId: user._id,
			role: 'owner',
			status: 'active'
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
