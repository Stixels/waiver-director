import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type FunctionCtx = QueryCtx | MutationCtx;

export const BILLING_FEATURES = [
	'waiver_publishing',
	'booking_integrations',
	'email_followups',
	'analytics',
	'pdf_export',
	'team_access',
	'multi_workspace'
] as const;

export type BillingFeature = (typeof BILLING_FEATURES)[number];

export const billingFeatureValidator = v.union(
	v.literal('waiver_publishing'),
	v.literal('booking_integrations'),
	v.literal('email_followups'),
	v.literal('analytics'),
	v.literal('pdf_export'),
	v.literal('team_access'),
	v.literal('multi_workspace')
);

export const PRO_FEATURES: BillingFeature[] = [
	'waiver_publishing',
	'booking_integrations',
	'email_followups',
	'analytics',
	'pdf_export',
	'team_access'
];

export const BUSINESS_FEATURES: BillingFeature[] = [...PRO_FEATURES, 'multi_workspace'];

const ACTIVE_BILLING_STATUSES = new Set(['active', 'trialing']);

const FEATURE_MESSAGES: Record<BillingFeature, string> = {
	waiver_publishing: 'Upgrade to Pro to publish waivers and accept signed submissions.',
	booking_integrations: 'Upgrade to Pro to connect and sync booking integrations.',
	email_followups: 'Upgrade to Pro to send waiver follow-up emails.',
	analytics: 'Upgrade to Pro to view analytics.',
	pdf_export: 'Upgrade to Pro to export signed waiver PDFs.',
	team_access: 'Upgrade to Pro to invite and manage staff.',
	multi_workspace: 'Upgrade to Business to create multiple workspaces.'
};

export type BillingEntitlementSummary = {
	userId: Id<'users'>;
	providerUserId: string | null;
	planSlug: string;
	status: string;
	featureSlugs: BillingFeature[];
	isActive: boolean;
	currentPeriodEnd: number | null;
	trialEndsAt: number | null;
	cancelAtPeriodEnd: boolean;
	updatedAt: number | null;
};

export function billingFeatureValue(feature: BillingFeature) {
	return feature;
}

export function isBillingStatusActive(status: string) {
	return ACTIVE_BILLING_STATUSES.has(status);
}

function isEntitlementCurrentlyActive(status: string, currentPeriodEnd: number | undefined) {
	if (isBillingStatusActive(status)) return true;
	return (
		status === 'canceled' && typeof currentPeriodEnd === 'number' && currentPeriodEnd > Date.now()
	);
}

export function normalizeBillingFeatureSlugs(values: string[]): BillingFeature[] {
	const allowed = new Set<string>(BILLING_FEATURES);
	const normalized = new Set<BillingFeature>();
	for (const value of values) {
		const slug = value.trim();
		if (allowed.has(slug)) {
			normalized.add(slug as BillingFeature);
		}
	}
	return [...normalized];
}

export function featuresForPlan(planSlug: string): BillingFeature[] {
	if (planSlug === 'business') return BUSINESS_FEATURES;
	if (planSlug === 'pro') return PRO_FEATURES;
	return [];
}

function summarizeEntitlement(
	userId: Id<'users'>,
	entitlement: Doc<'user_billing_entitlements'> | null
): BillingEntitlementSummary {
	const planSlug = entitlement?.planSlug ?? 'free';
	const status = entitlement?.status ?? 'free';
	const isActive = isEntitlementCurrentlyActive(status, entitlement?.currentPeriodEnd);
	const storedFeatureSlugs = normalizeBillingFeatureSlugs(entitlement?.featureSlugs ?? []);
	const featureSlugs = isActive
		? normalizeBillingFeatureSlugs([...featuresForPlan(planSlug), ...storedFeatureSlugs])
		: [];

	return {
		userId,
		providerUserId: entitlement?.providerUserId ?? null,
		planSlug,
		status,
		featureSlugs,
		isActive,
		currentPeriodEnd: entitlement?.currentPeriodEnd ?? null,
		trialEndsAt: entitlement?.trialEndsAt ?? null,
		cancelAtPeriodEnd: entitlement?.cancelAtPeriodEnd ?? false,
		updatedAt: entitlement?.updatedAt ?? null
	};
}

export async function getBillingEntitlementForUser(
	ctx: FunctionCtx,
	userId: Id<'users'>
): Promise<BillingEntitlementSummary> {
	const entitlement = await ctx.db
		.query('user_billing_entitlements')
		.withIndex('by_userId', (query) => query.eq('userId', userId))
		.unique();

	return summarizeEntitlement(userId, entitlement);
}

export function entitlementHasFeature(
	entitlement: BillingEntitlementSummary,
	feature: BillingFeature
) {
	return entitlement.featureSlugs.includes(feature);
}

export async function userHasBillingFeature(
	ctx: FunctionCtx,
	userId: Id<'users'>,
	feature: BillingFeature
) {
	return entitlementHasFeature(await getBillingEntitlementForUser(ctx, userId), feature);
}

export async function getWorkspaceBillingAccess(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	const workspace = await ctx.db.get(workspaceId);
	if (!workspace?.createdByUserId) {
		return null;
	}

	const entitlement = await getBillingEntitlementForUser(ctx, workspace.createdByUserId);
	return {
		workspaceId,
		ownerUserId: workspace.createdByUserId,
		entitlement
	};
}

export async function workspaceHasBillingFeature(
	ctx: FunctionCtx,
	workspaceId: Id<'workspaces'>,
	feature: BillingFeature
) {
	const access = await getWorkspaceBillingAccess(ctx, workspaceId);
	return access ? entitlementHasFeature(access.entitlement, feature) : false;
}

export async function requireWorkspaceFeature(
	ctx: FunctionCtx,
	workspaceId: Id<'workspaces'>,
	feature: BillingFeature
) {
	if (await workspaceHasBillingFeature(ctx, workspaceId, feature)) {
		return;
	}

	throw new ConvexError({
		code: 'billing_required',
		feature,
		message: FEATURE_MESSAGES[feature]
	});
}

export async function canCreateWorkspace(ctx: FunctionCtx, userId: Id<'users'>) {
	const ownedWorkspace = await ctx.db
		.query('workspaces')
		.withIndex('by_createdByUserId', (query) => query.eq('createdByUserId', userId))
		.first();

	if (!ownedWorkspace) return true;
	return await userHasBillingFeature(ctx, userId, 'multi_workspace');
}

export async function requireCanCreateWorkspace(ctx: FunctionCtx, userId: Id<'users'>) {
	if (await canCreateWorkspace(ctx, userId)) return;

	throw new ConvexError({
		code: 'billing_required',
		feature: 'multi_workspace',
		message: FEATURE_MESSAGES.multi_workspace
	});
}
