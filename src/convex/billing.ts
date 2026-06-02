import { ConvexError, v } from 'convex/values';
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query
} from './_generated/server';
import { internal } from './_generated/api';
import {
	billingFeatureValidator,
	canCreateWorkspace,
	featuresForPlan,
	getBillingEntitlementForUser,
	getWorkspaceLimitStateForUser,
	isBillingStatusActive,
	normalizeBillingFeatureSlugs,
	workspaceHasBillingFeature
} from './lib/billing';
import { getCurrentUser } from './lib/auth';

type JsonRecord = Record<string, unknown>;
type ClerkWebhookResult = { status: 'accepted' | 'duplicate' | 'ignored' | 'rejected' };

const clerkWebhookResultValue = v.object({
	status: v.union(
		v.literal('accepted'),
		v.literal('duplicate'),
		v.literal('ignored'),
		v.literal('rejected')
	)
});

function requiredEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: `Missing Convex environment variable: ${name}.`
		});
	}
	return value;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let index = 0; index < a.length; index += 1) {
		diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}
	return diff === 0;
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value < 10_000_000_000 ? value * 1000 : value;
	}
	if (typeof value === 'string') {
		const numeric = Number(value);
		if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
		const parsed = Date.parse(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

function asBoolean(value: unknown): boolean | null {
	return typeof value === 'boolean' ? value : null;
}

function nestedRecord(record: JsonRecord, keys: string[]): JsonRecord | null {
	let current: unknown = record;
	for (const key of keys) {
		if (!isRecord(current)) return null;
		current = current[key];
	}
	return isRecord(current) ? current : null;
}

function nestedValue(record: JsonRecord, keys: string[]): unknown {
	let current: unknown = record;
	for (const key of keys) {
		if (!isRecord(current)) return null;
		current = current[key];
	}
	return current;
}

function firstString(record: JsonRecord, paths: string[][]): string | null {
	for (const path of paths) {
		const value = asString(nestedValue(record, path));
		if (value) return value;
	}
	return null;
}

function firstNumber(record: JsonRecord, paths: string[][]): number | null {
	for (const path of paths) {
		const value = asNumber(nestedValue(record, path));
		if (value !== null) return value;
	}
	return null;
}

function featureSlugsFromValue(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const slugs: string[] = [];
	for (const feature of value) {
		if (typeof feature === 'string') {
			slugs.push(feature);
			continue;
		}
		if (isRecord(feature)) {
			const slug =
				asString(feature.slug) ??
				asString(feature.key) ??
				asString(feature.name) ??
				asString(feature.id);
			if (slug) slugs.push(slug);
		}
	}
	return slugs;
}

function subscriptionItems(data: JsonRecord): JsonRecord[] {
	const values = [data.items, data.subscription_items, data.subscriptionItems];
	for (const value of values) {
		if (Array.isArray(value)) return value.filter(isRecord);
		if (isRecord(value) && Array.isArray(value.data)) return value.data.filter(isRecord);
	}
	return [];
}

function billableItemForEvent(data: JsonRecord): JsonRecord {
	const items = subscriptionItems(data);
	const paidActiveItem = items.find((item) => {
		const planSlug = extractPlanSlug(item);
		const status = extractStatus(item);
		return (
			planSlug !== 'free' && (status === 'active' || status === 'trialing' || status === 'canceled')
		);
	});
	return paidActiveItem ?? items[0] ?? data;
}

function extractProviderUserId(record: JsonRecord): string | null {
	const payer = nestedRecord(record, ['payer']);
	const candidate =
		firstString(record, [
			['payer', 'user_id'],
			['payer', 'userId'],
			['payer', 'id'],
			['user_id'],
			['userId'],
			['customer', 'external_id'],
			['customer', 'externalId'],
			['subscription', 'payer', 'user_id'],
			['subscription', 'payer', 'userId']
		]) ?? null;

	if (candidate?.startsWith('user_')) return candidate;
	if (payer) {
		const payerType = asString(payer.type) ?? asString(payer.object);
		const payerId = asString(payer.id);
		if (payerId?.startsWith('user_') || payerType === 'user') return payerId;
	}
	return candidate;
}

function extractPlanSlug(record: JsonRecord): string {
	return (
		firstString(record, [
			['plan', 'slug'],
			['plan', 'key'],
			['plan', 'id'],
			['plan_slug'],
			['planSlug'],
			['price', 'plan', 'slug'],
			['subscription_item', 'plan', 'slug'],
			['subscriptionItem', 'plan', 'slug']
		]) ?? 'free'
	);
}

function extractStatus(record: JsonRecord): string {
	return (
		firstString(record, [
			['status'],
			['subscription_item', 'status'],
			['subscriptionItem', 'status']
		]) ?? 'unknown'
	);
}

function extractFeatureSlugs(record: JsonRecord): string[] {
	const slugs = [
		...featureSlugsFromValue(record.features),
		...featureSlugsFromValue(nestedValue(record, ['plan', 'features'])),
		...featureSlugsFromValue(nestedValue(record, ['price', 'plan', 'features']))
	];
	return normalizeBillingFeatureSlugs(slugs);
}

function normalizeBillingPayload(eventType: string, data: JsonRecord) {
	const item = billableItemForEvent(data);
	const providerUserId = extractProviderUserId(item) ?? extractProviderUserId(data);
	const planSlug = extractPlanSlug(item);
	const rawStatus = extractStatus(item);
	const status =
		eventType === 'subscriptionItem.ended' || eventType === 'subscriptionItem.abandoned'
			? 'ended'
			: rawStatus;
	const currentPeriodEnd =
		firstNumber(item, [
			['period_end'],
			['periodEnd'],
			['current_period_end'],
			['currentPeriodEnd']
		]) ?? undefined;
	const trialEndsAt =
		firstNumber(item, [['trial_end'], ['trialEnd'], ['trial_ends_at'], ['trialEndsAt']]) ??
		undefined;
	const cancelAtPeriodEnd =
		asBoolean(nestedValue(item, ['cancel_at_period_end'])) ??
		asBoolean(nestedValue(item, ['cancelAtPeriodEnd'])) ??
		undefined;
	const featureSlugs = normalizeBillingFeatureSlugs([
		...featuresForPlan(planSlug),
		...extractFeatureSlugs(item),
		...extractFeatureSlugs(data)
	]);

	return {
		providerUserId,
		planSlug,
		status,
		featureSlugs,
		currentPeriodEnd,
		trialEndsAt,
		cancelAtPeriodEnd
	};
}

async function verifySvixSignature(input: {
	body: string;
	svixId: string;
	svixTimestamp: string;
	svixSignature: string;
}) {
	const timestamp = Number(input.svixTimestamp);
	if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) {
		return false;
	}

	const secret = requiredEnv('CLERK_WEBHOOK_SIGNING_SECRET').replace(/^whsec_/, '');
	const key = await crypto.subtle.importKey(
		'raw',
		base64ToBytes(secret) as unknown as BufferSource,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signedContent = `${input.svixId}.${input.svixTimestamp}.${input.body}`;
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
	const expected = bytesToBase64(new Uint8Array(signature));
	const received = input.svixSignature
		.split(/\s+/)
		.map((part) => part.split(','))
		.filter(([version, value]) => version === 'v1' && Boolean(value))
		.map(([, value]) => value);

	return received.some((value) => timingSafeEqual(expected, value));
}

export const getCurrentBilling = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const authIdentity = await ctx.db
			.query('auth_identities')
			.withIndex('by_tokenIdentifier', (query) =>
				query.eq('tokenIdentifier', identity.tokenIdentifier)
			)
			.unique();
		if (!authIdentity) return null;
		const entitlement = await getBillingEntitlementForUser(ctx, authIdentity.userId);
		return {
			...entitlement,
			workspaceLimit: await getWorkspaceLimitStateForUser(ctx, authIdentity.userId, entitlement),
			canCreateWorkspace: await canCreateWorkspace(ctx, authIdentity.userId)
		};
	}
});

export const selectPrimaryWorkspace = mutation({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.object({
		primaryWorkspaceId: v.id('workspaces'),
		primaryWorkspaceSelectedAt: v.number(),
		currentSwitchPeriod: v.string(),
		switchUsedThisPeriod: v.boolean(),
		canSwitchPrimaryWorkspace: v.boolean()
	}),
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!user) {
			throw new ConvexError({
				code: 'unauthenticated',
				message: 'Not authenticated'
			});
		}

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace || workspace.createdByUserId !== user._id || workspace.status !== 'active') {
			throw new ConvexError({
				code: 'forbidden',
				message: 'Only the workspace owner can choose this primary workspace.'
			});
		}

		const entitlement = await getBillingEntitlementForUser(ctx, user._id);
		const currentState = await getWorkspaceLimitStateForUser(ctx, user._id, entitlement);
		const selectedAt = Date.now();
		const currentSwitchPeriod = currentState.currentSwitchPeriod;

		if (currentState.primaryWorkspaceId === args.workspaceId) {
			return {
				primaryWorkspaceId: args.workspaceId,
				primaryWorkspaceSelectedAt: entitlement.primaryWorkspaceSelectedAt ?? selectedAt,
				currentSwitchPeriod,
				switchUsedThisPeriod: currentState.switchUsedThisPeriod,
				canSwitchPrimaryWorkspace: currentState.canSwitchPrimaryWorkspace
			};
		}

		if (currentState.hasMultiWorkspace) {
			const existing = await ctx.db
				.query('user_billing_entitlements')
				.withIndex('by_userId', (query) => query.eq('userId', user._id))
				.unique();

			if (existing) {
				await ctx.db.patch(existing._id, {
					primaryWorkspaceId: args.workspaceId,
					primaryWorkspaceSelectedAt: selectedAt
				});
			}

			const nextState = await getWorkspaceLimitStateForUser(ctx, user._id, {
				...entitlement,
				primaryWorkspaceId: args.workspaceId,
				primaryWorkspaceSelectedAt: selectedAt
			});

			return {
				primaryWorkspaceId: args.workspaceId,
				primaryWorkspaceSelectedAt: selectedAt,
				currentSwitchPeriod,
				switchUsedThisPeriod: nextState.switchUsedThisPeriod,
				canSwitchPrimaryWorkspace: nextState.canSwitchPrimaryWorkspace
			};
		}

		if (!currentState.canSwitchPrimaryWorkspace) {
			throw new ConvexError({
				code: 'billing_limit_reached',
				feature: 'multi_workspace',
				message: currentState.switchUsedThisPeriod
					? 'You can switch your Pro primary workspace once per billing period.'
					: 'Upgrade to Business to manage multiple live workspaces.'
			});
		}

		const existing = await ctx.db
			.query('user_billing_entitlements')
			.withIndex('by_userId', (query) => query.eq('userId', user._id))
			.unique();
		if (!existing) {
			throw new ConvexError({
				code: 'billing_required',
				feature: 'multi_workspace',
				message: 'Upgrade to Business to manage multiple live workspaces.'
			});
		}

		await ctx.db.patch(existing._id, {
			primaryWorkspaceId: args.workspaceId,
			primaryWorkspaceSelectedAt: selectedAt,
			primaryWorkspaceSwitchPeriod: currentSwitchPeriod
		});

		const nextState = await getWorkspaceLimitStateForUser(ctx, user._id, {
			...entitlement,
			primaryWorkspaceId: args.workspaceId,
			primaryWorkspaceSelectedAt: selectedAt,
			primaryWorkspaceSwitchPeriod: currentSwitchPeriod
		});

		return {
			primaryWorkspaceId: args.workspaceId,
			primaryWorkspaceSelectedAt: selectedAt,
			currentSwitchPeriod,
			switchUsedThisPeriod: nextState.switchUsedThisPeriod,
			canSwitchPrimaryWorkspace: nextState.canSwitchPrimaryWorkspace
		};
	}
});

export const getWorkspaceFeatureAccess = internalQuery({
	args: {
		workspaceId: v.id('workspaces'),
		feature: billingFeatureValidator
	},
	returns: v.boolean(),
	handler: async (ctx, args): Promise<boolean> => {
		return await workspaceHasBillingFeature(ctx, args.workspaceId, args.feature);
	}
});

export const applyClerkBillingEvent = internalMutation({
	args: {
		eventId: v.string(),
		eventType: v.string(),
		providerUserId: v.string(),
		planSlug: v.string(),
		status: v.string(),
		featureSlugs: v.array(billingFeatureValidator),
		currentPeriodEnd: v.optional(v.number()),
		trialEndsAt: v.optional(v.number()),
		cancelAtPeriodEnd: v.optional(v.boolean()),
		receivedAt: v.number()
	},
	returns: clerkWebhookResultValue,
	handler: async (ctx, args): Promise<ClerkWebhookResult> => {
		const existingEvent = await ctx.db
			.query('user_billing_entitlements')
			.withIndex('by_lastEventId', (query) => query.eq('lastEventId', args.eventId))
			.unique();
		if (existingEvent) return { status: 'duplicate' };

		const authIdentity = await ctx.db
			.query('auth_identities')
			.withIndex('by_provider_and_providerUserId', (query) =>
				query.eq('provider', 'clerk').eq('providerUserId', args.providerUserId)
			)
			.unique();
		if (!authIdentity) return { status: 'ignored' };

		const existing = await ctx.db
			.query('user_billing_entitlements')
			.withIndex('by_provider_and_providerUserId', (query) =>
				query.eq('provider', 'clerk').eq('providerUserId', args.providerUserId)
			)
			.unique();

		if (existing && existing.planSlug !== args.planSlug) {
			const existingActive =
				isBillingStatusActive(existing.status) ||
				(existing.status === 'canceled' &&
					typeof existing.currentPeriodEnd === 'number' &&
					existing.currentPeriodEnd > Date.now());

			const incomingActive =
				isBillingStatusActive(args.status) ||
				(args.status === 'canceled' &&
					typeof args.currentPeriodEnd === 'number' &&
					args.currentPeriodEnd > Date.now());

			if (existingActive && !incomingActive) {
				return { status: 'ignored' };
			}
		}

		const patch = {
			userId: authIdentity.userId,
			provider: 'clerk' as const,
			providerUserId: args.providerUserId,
			planSlug: args.planSlug,
			status: args.status,
			featureSlugs: args.featureSlugs,
			...(args.currentPeriodEnd !== undefined ? { currentPeriodEnd: args.currentPeriodEnd } : {}),
			...(args.trialEndsAt !== undefined ? { trialEndsAt: args.trialEndsAt } : {}),
			...(args.cancelAtPeriodEnd !== undefined
				? { cancelAtPeriodEnd: args.cancelAtPeriodEnd }
				: {}),
			lastEventId: args.eventId,
			lastEventType: args.eventType,
			updatedAt: args.receivedAt
		};

		if (existing) {
			await ctx.db.patch(existing._id, patch);
		} else {
			await ctx.db.insert('user_billing_entitlements', patch);
		}

		return { status: 'accepted' };
	}
});

export const verifyAndApplyClerkBillingWebhook = internalAction({
	args: {
		body: v.string(),
		svixId: v.string(),
		svixTimestamp: v.string(),
		svixSignature: v.string()
	},
	returns: clerkWebhookResultValue,
	handler: async (ctx, args): Promise<ClerkWebhookResult> => {
		const verified = await verifySvixSignature(args);
		if (!verified) return { status: 'rejected' };

		let payload: unknown;
		try {
			payload = JSON.parse(args.body);
		} catch {
			return { status: 'rejected' };
		}
		if (!isRecord(payload) || !isRecord(payload.data)) return { status: 'ignored' };

		const eventType = asString(payload.type) ?? 'unknown';
		if (!eventType.startsWith('subscription')) return { status: 'ignored' };

		const normalized = normalizeBillingPayload(eventType, payload.data);
		if (!normalized.providerUserId || normalized.status === 'upcoming')
			return { status: 'ignored' };

		const result: ClerkWebhookResult = await ctx.runMutation(
			internal.billing.applyClerkBillingEvent,
			{
				eventId: args.svixId,
				eventType,
				providerUserId: normalized.providerUserId,
				planSlug: normalized.planSlug,
				status: normalized.status,
				featureSlugs: normalized.featureSlugs,
				...(normalized.currentPeriodEnd !== undefined
					? { currentPeriodEnd: normalized.currentPeriodEnd }
					: {}),
				...(normalized.trialEndsAt !== undefined ? { trialEndsAt: normalized.trialEndsAt } : {}),
				...(normalized.cancelAtPeriodEnd !== undefined
					? { cancelAtPeriodEnd: normalized.cancelAtPeriodEnd }
					: {}),
				receivedAt: Date.now()
			}
		);
		return result;
	}
});
