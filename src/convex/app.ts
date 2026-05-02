import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { getCurrentAuthIdentity } from './lib/auth';
import { listWorkspaceMembershipsForUser } from './lib/workspaces';

const currentUserValue = v.object({
	userId: v.id('users'),
	displayName: v.union(v.string(), v.null()),
	primaryEmail: v.union(v.string(), v.null()),
	authProvider: v.union(v.literal('clerk'), v.literal('better-auth')),
	tokenIdentifier: v.string()
});

const workspaceSummaryValue = v.object({
	workspaceId: v.id('workspaces'),
	name: v.string(),
	slug: v.string(),
	role: v.union(v.literal('owner'), v.literal('staff')),
	status: v.union(v.literal('active'), v.literal('invited'), v.literal('suspended'))
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

async function loadCurrentUser(ctx: QueryCtx) {
	const authIdentity = await getCurrentAuthIdentity(ctx);
	if (!authIdentity) {
		return null;
	}

	const user = await ctx.db.get('users', authIdentity.userId);
	if (!user) {
		console.warn('[app.current] Dangling auth identity: missing linked user record', {
			userId: authIdentity.userId,
			provider: authIdentity.provider
		});
		console.log('[metric] auth.dangling_identity', {
			userId: authIdentity.userId,
			provider: authIdentity.provider
		});
		return null;
	}

	return {
		user,
		currentUser: buildCurrentUserResult({
			userId: user._id,
			displayName: user.displayName,
			primaryEmail: user.primaryEmail,
			authProvider: authIdentity.provider,
			tokenIdentifier: authIdentity.tokenIdentifier
		})
	};
}

export const current = query({
	args: {},
	returns: v.object({
		currentUser: v.union(v.null(), currentUserValue),
		workspaces: v.array(workspaceSummaryValue)
	}),
	handler: async (ctx) => {
		const currentUserState = await loadCurrentUser(ctx);
		if (!currentUserState) {
			return {
				currentUser: null,
				workspaces: []
			};
		}

		const memberships = await listWorkspaceMembershipsForUser(ctx, currentUserState.user._id);
		const workspaceDocs = await Promise.all(
			memberships.map((membership) => ctx.db.get(membership.workspaceId))
		);

		const workspaces = memberships.map((membership, index) => {
			const workspace = workspaceDocs[index];
			if (!workspace) {
				console.warn('[app.current] Missing workspace for membership', {
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

		return {
			currentUser: currentUserState.currentUser,
			workspaces: workspaces.filter((workspace) => workspace !== null)
		};
	}
});
