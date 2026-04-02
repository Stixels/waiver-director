import { v } from 'convex/values';
import { query } from './_generated/server';
import { getCurrentUser } from './lib/auth';
import { getWorkspaceMembership, listWorkspaceMembershipsForUser } from './lib/workspaces';

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
		const workspaces = await Promise.all(
			memberships.map(async (membership) => {
				const workspace = await ctx.db.get(membership.workspaceId);
				if (!workspace) {
					return null;
				}

				return {
					workspaceId: workspace._id,
					name: workspace.name,
					slug: workspace.slug,
					role: membership.role,
					status: membership.status
				};
			})
		);

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
