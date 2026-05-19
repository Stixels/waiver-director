import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import {
	billingFeatureValidator,
	canCreateWorkspace,
	entitlementHasFeature,
	getBillingEntitlementForUser,
	getWorkspaceLimitStateForUser,
	type BillingEntitlementSummary,
	type WorkspaceLimitState
} from './lib/billing';
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
	status: v.union(v.literal('active'), v.literal('invited'), v.literal('suspended')),
	billing: v.object({
		ownerUserId: v.union(v.id('users'), v.null()),
		planSlug: v.string(),
		status: v.string(),
		featureSlugs: v.array(billingFeatureValidator),
		isActive: v.boolean(),
		features: v.object({
			waiverPublishing: v.boolean(),
			bookingIntegrations: v.boolean(),
			emailFollowups: v.boolean(),
			analytics: v.boolean(),
			pdfExport: v.boolean(),
			teamAccess: v.boolean(),
			multiWorkspace: v.boolean()
		}),
		workspaceLimit: v.object({
			limit: v.union(v.number(), v.null()),
			ownedWorkspaceCount: v.number(),
			primaryWorkspaceId: v.union(v.id('workspaces'), v.null()),
			primaryWorkspaceSelectedAt: v.union(v.number(), v.null()),
			currentSwitchPeriod: v.union(v.string(), v.null()),
			switchUsedThisPeriod: v.boolean(),
			canSwitchPrimaryWorkspace: v.boolean(),
			hasMultiWorkspace: v.boolean(),
			isPrimary: v.boolean(),
			isPaused: v.boolean()
		})
	})
});

const billingSummaryValue = v.object({
	planSlug: v.string(),
	status: v.string(),
	featureSlugs: v.array(billingFeatureValidator),
	isActive: v.boolean(),
	currentPeriodEnd: v.union(v.number(), v.null()),
	trialEndsAt: v.union(v.number(), v.null()),
	cancelAtPeriodEnd: v.boolean(),
	canCreateWorkspace: v.boolean(),
	workspaceLimit: v.object({
		limit: v.union(v.number(), v.null()),
		ownedWorkspaceCount: v.number(),
		primaryWorkspaceId: v.union(v.id('workspaces'), v.null()),
		primaryWorkspaceSelectedAt: v.union(v.number(), v.null()),
		currentSwitchPeriod: v.union(v.string(), v.null()),
		switchUsedThisPeriod: v.boolean(),
		canSwitchPrimaryWorkspace: v.boolean(),
		hasMultiWorkspace: v.boolean()
	})
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

function workspaceBillingFeatures(args: {
	entitlement: BillingEntitlementSummary | null;
	limitState: WorkspaceLimitState | null;
	workspaceId: Id<'workspaces'>;
}) {
	const entitlement = args.entitlement;
	if (!entitlement) {
		return {
			waiverPublishing: false,
			bookingIntegrations: false,
			emailFollowups: false,
			analytics: false,
			pdfExport: false,
			teamAccess: false,
			multiWorkspace: false
		};
	}

	const hasMultiWorkspace = entitlementHasFeature(entitlement, 'multi_workspace');
	const isPlanLimited = !hasMultiWorkspace && (args.limitState?.ownedWorkspaceCount ?? 0) > 1;
	const isPrimary = !isPlanLimited || args.limitState?.primaryWorkspaceId === args.workspaceId;
	const canUseProFeatures = !isPlanLimited || isPrimary;

	return {
		waiverPublishing: canUseProFeatures && entitlementHasFeature(entitlement, 'waiver_publishing'),
		bookingIntegrations:
			canUseProFeatures && entitlementHasFeature(entitlement, 'booking_integrations'),
		emailFollowups: canUseProFeatures && entitlementHasFeature(entitlement, 'email_followups'),
		analytics: canUseProFeatures && entitlementHasFeature(entitlement, 'analytics'),
		pdfExport: canUseProFeatures && entitlementHasFeature(entitlement, 'pdf_export'),
		teamAccess: canUseProFeatures && entitlementHasFeature(entitlement, 'team_access'),
		multiWorkspace: hasMultiWorkspace
	};
}

function workspaceLimitForWorkspace(args: {
	limitState: WorkspaceLimitState | null;
	workspaceId: Id<'workspaces'>;
}) {
	const limitState = args.limitState;
	if (!limitState) {
		return {
			limit: null,
			ownedWorkspaceCount: 0,
			primaryWorkspaceId: null,
			primaryWorkspaceSelectedAt: null,
			currentSwitchPeriod: null,
			switchUsedThisPeriod: false,
			canSwitchPrimaryWorkspace: false,
			hasMultiWorkspace: false,
			isPrimary: false,
			isPaused: false
		};
	}

	const isPrimary =
		limitState.hasMultiWorkspace ||
		limitState.ownedWorkspaceCount <= 1 ||
		limitState.primaryWorkspaceId === args.workspaceId;

	return {
		limit: limitState.limit,
		ownedWorkspaceCount: limitState.ownedWorkspaceCount,
		primaryWorkspaceId: limitState.primaryWorkspaceId,
		primaryWorkspaceSelectedAt: limitState.primaryWorkspaceSelectedAt,
		currentSwitchPeriod: limitState.currentSwitchPeriod,
		switchUsedThisPeriod: limitState.switchUsedThisPeriod,
		canSwitchPrimaryWorkspace: limitState.canSwitchPrimaryWorkspace,
		hasMultiWorkspace: limitState.hasMultiWorkspace,
		isPrimary,
		isPaused: !limitState.hasMultiWorkspace && limitState.ownedWorkspaceCount > 1 && !isPrimary
	};
}

export const current = query({
	args: {},
	returns: v.object({
		currentUser: v.union(v.null(), currentUserValue),
		billing: v.union(v.null(), billingSummaryValue),
		workspaces: v.array(workspaceSummaryValue)
	}),
	handler: async (ctx) => {
		const currentUserState = await loadCurrentUser(ctx);
		if (!currentUserState) {
			return {
				currentUser: null,
				billing: null,
				workspaces: []
			};
		}

		const currentBilling = await getBillingEntitlementForUser(ctx, currentUserState.user._id);
		const currentWorkspaceLimit = await getWorkspaceLimitStateForUser(
			ctx,
			currentUserState.user._id,
			currentBilling
		);
		const memberships = await listWorkspaceMembershipsForUser(ctx, currentUserState.user._id);
		const workspaceDocs = await Promise.all(
			memberships.map((membership) => ctx.db.get(membership.workspaceId))
		);
		const ownerBilling = new Map<Id<'users'>, BillingEntitlementSummary>();
		const ownerLimitStates = new Map<Id<'users'>, WorkspaceLimitState>();
		for (const workspace of workspaceDocs) {
			if (!workspace?.createdByUserId || ownerBilling.has(workspace.createdByUserId)) continue;
			const entitlement =
				workspace.createdByUserId === currentUserState.user._id
					? currentBilling
					: await getBillingEntitlementForUser(ctx, workspace.createdByUserId);
			ownerBilling.set(workspace.createdByUserId, entitlement);
			ownerLimitStates.set(
				workspace.createdByUserId,
				workspace.createdByUserId === currentUserState.user._id
					? currentWorkspaceLimit
					: await getWorkspaceLimitStateForUser(ctx, workspace.createdByUserId, entitlement)
			);
		}

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
			const workspaceBilling = workspace.createdByUserId
				? (ownerBilling.get(workspace.createdByUserId) ?? null)
				: null;
			const workspaceLimit = workspace.createdByUserId
				? (ownerLimitStates.get(workspace.createdByUserId) ?? null)
				: null;

			return {
				workspaceId: workspace._id,
				name: workspace.name,
				slug: workspace.slug,
				role: membership.role,
				status: membership.status,
				billing: {
					ownerUserId: workspace.createdByUserId ?? null,
					planSlug: workspaceBilling?.planSlug ?? 'free',
					status: workspaceBilling?.status ?? 'free',
					featureSlugs: workspaceBilling?.featureSlugs ?? [],
					isActive: workspaceBilling?.isActive ?? false,
					features: workspaceBillingFeatures({
						entitlement: workspaceBilling,
						limitState: workspaceLimit,
						workspaceId: workspace._id
					}),
					workspaceLimit: workspaceLimitForWorkspace({
						limitState: workspaceLimit,
						workspaceId: workspace._id
					})
				}
			};
		});

		return {
			currentUser: currentUserState.currentUser,
			billing: {
				planSlug: currentBilling.planSlug,
				status: currentBilling.status,
				featureSlugs: currentBilling.featureSlugs,
				isActive: currentBilling.isActive,
				currentPeriodEnd: currentBilling.currentPeriodEnd,
				trialEndsAt: currentBilling.trialEndsAt,
				cancelAtPeriodEnd: currentBilling.cancelAtPeriodEnd,
				canCreateWorkspace: await canCreateWorkspace(ctx, currentUserState.user._id),
				workspaceLimit: currentWorkspaceLimit
			},
			workspaces: workspaces.filter((workspace) => workspace !== null)
		};
	}
});
