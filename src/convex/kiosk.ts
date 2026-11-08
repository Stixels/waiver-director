import { v } from 'convex/values';
import { internalMutation, mutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { workspaceHasBillingFeature } from './lib/billing';
import { nextFixedWindowUsage } from './lib/emailAIRateLimit';
import {
	KIOSK_IDENTIFIER_LOOKUP_LIMIT,
	KIOSK_IDENTIFIER_LOOKUP_WINDOW_MS,
	KIOSK_MAX_RESULTS,
	KIOSK_WORKSPACE_LOOKUP_LIMIT,
	KIOSK_WORKSPACE_LOOKUP_WINDOW_MS,
	isWithinKioskLookupWindow,
	kioskLeadFirstName,
	kioskServiceDateRange,
	parseKioskLookupQuery
} from '../lib/domain/kiosk';

const WORKSPACE_SCOPE_KEY = 'workspace';
const MAX_CANDIDATE_BOOKINGS = 25;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_PRUNE_BATCH_SIZE = 200;

const kioskLookupResultValue = v.object({
	lookupToken: v.string(),
	activityName: v.string(),
	startTime: v.union(v.string(), v.null()),
	leadFirstName: v.union(v.string(), v.null())
});

const kioskLookupValue = v.union(
	v.object({ status: v.literal('ok'), results: v.array(kioskLookupResultValue) }),
	v.object({ status: v.literal('invalid'), message: v.string() }),
	v.object({ status: v.literal('rate_limited'), retryAfterSeconds: v.number() }),
	v.object({ status: v.literal('unavailable') })
);

async function sha256Hex(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

async function consumeLookupQuota(
	ctx: MutationCtx,
	workspaceId: Id<'workspaces'>,
	scopeKey: string,
	windowMs: number,
	limit: number,
	now: number
) {
	const existing = await ctx.db
		.query('kiosk_lookup_rate_limits')
		.withIndex('by_workspaceId_and_scopeKey', (q) =>
			q.eq('workspaceId', workspaceId).eq('scopeKey', scopeKey)
		)
		.unique();
	const decision = nextFixedWindowUsage(existing, now, windowMs, limit);
	if (!decision.allowed) return decision;

	const value = {
		windowStartedAt: decision.windowStartedAt,
		requestCount: decision.requestCount,
		updatedAt: now
	};
	if (existing) {
		await ctx.db.patch(existing._id, value);
	} else {
		await ctx.db.insert('kiosk_lookup_rate_limits', { workspaceId, scopeKey, ...value });
	}
	return decision;
}

/**
 * Public kiosk booking lookup (ADR 0001). This is a mutation so every attempt, including
 * misses, counts against the rate limit. It never throws after quota is consumed, because a
 * thrown error would roll the counters back.
 *
 * Results are limited to active bookings inside the kiosk lookup window and expose only the
 * activity, start time, the lead's first name, and the booking waiver token that is already
 * shareable among people on that booking. No roster, email, or customer history is returned.
 */
export const lookupBookings = mutation({
	args: {
		slug: v.string(),
		query: v.string()
	},
	returns: kioskLookupValue,
	handler: async (ctx, args) => {
		const waiver = await ctx.db
			.query('workspace_waivers')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', args.slug))
			.unique();
		if (!waiver || !waiver.publishedVersionId) return { status: 'unavailable' as const };

		const workspace = await ctx.db.get(waiver.workspaceId);
		if (!workspace || workspace.status === 'archived') return { status: 'unavailable' as const };
		if (!(await workspaceHasBillingFeature(ctx, workspace._id, 'waiver_publishing'))) {
			return { status: 'unavailable' as const };
		}

		const parsed = parseKioskLookupQuery(args.query);
		if (parsed.kind === 'invalid') {
			return { status: 'invalid' as const, message: parsed.message };
		}

		const now = Date.now();
		const workspaceDecision = await consumeLookupQuota(
			ctx,
			workspace._id,
			WORKSPACE_SCOPE_KEY,
			KIOSK_WORKSPACE_LOOKUP_WINDOW_MS,
			KIOSK_WORKSPACE_LOOKUP_LIMIT,
			now
		);
		if (!workspaceDecision.allowed) {
			return {
				status: 'rate_limited' as const,
				retryAfterSeconds: workspaceDecision.retryAfterSeconds
			};
		}

		const identifierScope = `id:${await sha256Hex(`${parsed.kind}:${parsed.value.toLowerCase()}`)}`;
		const identifierDecision = await consumeLookupQuota(
			ctx,
			workspace._id,
			identifierScope,
			KIOSK_IDENTIFIER_LOOKUP_WINDOW_MS,
			KIOSK_IDENTIFIER_LOOKUP_LIMIT,
			now
		);
		if (!identifierDecision.allowed) {
			return {
				status: 'rate_limited' as const,
				retryAfterSeconds: identifierDecision.retryAfterSeconds
			};
		}

		let candidates: Doc<'bookings'>[];
		if (parsed.kind === 'bookingNumber') {
			candidates = await ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_providerBookingId', (q) =>
					q.eq('workspaceId', workspace._id).eq('providerBookingId', parsed.value)
				)
				.take(MAX_CANDIDATE_BOOKINGS);
		} else {
			const { from, to } = kioskServiceDateRange(now);
			candidates = await ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_leadCustomerEmail_and_serviceDate', (q) =>
					q
						.eq('workspaceId', workspace._id)
						.eq('leadCustomerEmail', parsed.value)
						.gte('serviceDate', from)
						.lte('serviceDate', to)
				)
				.take(MAX_CANDIDATE_BOOKINGS);
		}

		const results = candidates
			.filter((booking) => booking.status === 'active')
			.filter((booking) => isWithinKioskLookupWindow(booking.startAt, now))
			.sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0))
			.slice(0, KIOSK_MAX_RESULTS)
			.map((booking) => ({
				lookupToken: booking.lookupToken,
				activityName: booking.activityName,
				startTime: booking.startTime ?? null,
				leadFirstName: kioskLeadFirstName(booking.leadCustomerName)
			}));

		return { status: 'ok' as const, results };
	}
});

export const pruneOldLookupRateLimitsCron = internalMutation({
	args: {},
	returns: v.object({ deletedCount: v.number() }),
	handler: async (ctx) => {
		const cutoff = Date.now() - RATE_LIMIT_RETENTION_MS;
		const stale = await ctx.db
			.query('kiosk_lookup_rate_limits')
			.withIndex('by_updatedAt', (q) => q.lt('updatedAt', cutoff))
			.take(RATE_LIMIT_PRUNE_BATCH_SIZE);
		for (const row of stale) {
			await ctx.db.delete(row._id);
		}
		if (stale.length === RATE_LIMIT_PRUNE_BATCH_SIZE) {
			await ctx.scheduler.runAfter(0, internal.kiosk.pruneOldLookupRateLimitsCron, {});
		}
		return { deletedCount: stale.length };
	}
});
