import { ConvexError, v } from 'convex/values';
import { action, internalAction, internalMutation, internalQuery } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
	convexSiteUrl,
	decryptSecret,
	encryptSecret,
	requiredEnv,
	timingSafeEqual,
	token
} from './lib/bookingCredentials';
import {
	fareHarborDateRanges,
	fareHarborWebhookBooking,
	fareHarborWebhookEventType,
	normalizeFareHarborBooking,
	normalizeFareHarborShortname,
	orderFareHarborSyncSlots,
	fareHarborSyncSlot,
	type FareHarborAvailabilityContext,
	type FareHarborSyncSlot
} from './lib/fareharbor';
import { requireWorkspaceOwner } from './lib/waivers';

// FareHarbor External API v1. Every request carries the platform app key plus the
// per-company user key that FareHarbor issues to the operator.
const FAREHARBOR_DEFAULT_API_BASE_URL = 'https://fareharbor.com/api/external/v1';
const FAREHARBOR_FETCH_TIMEOUT_MS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;
// FareHarbor has no "list bookings" endpoint: sync walks items -> availabilities -> bookings,
// so cap the requests a single run may make and walk the window in date order so the
// nearest bookings always land first.
const FAREHARBOR_SYNC_MAX_REQUESTS = 1_000;
const FAREHARBOR_SYNC_MAX_RUNTIME_MS = 6 * 60 * 1000;
// A run that dies (for example at the action time limit) leaves the row in "syncing";
// the cron treats a "syncing" row this old as stuck and runs it again.
const FAREHARBOR_STALE_SYNC_MS = 30 * 60 * 1000;
const FAREHARBOR_SYNC_WINDOWS = {
	initial: { pastDays: 7, futureDays: 120 },
	scheduled: { pastDays: 1, futureDays: 30 }
} as const;
const FAREHARBOR_WEBHOOK_MAX_BODY_BYTES = 512 * 1024;

const integrationStatusValidator = v.union(
	v.literal('connected'),
	v.literal('syncing'),
	v.literal('error'),
	v.literal('disconnected')
);

type FareHarborRequestBudget = { remaining: number; truncated: boolean };

function fareHarborApiBaseUrl(): string {
	const configured = process.env.FAREHARBOR_API_BASE_URL?.trim();
	return (configured || FAREHARBOR_DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

function fareHarborWebhookUrl(integrationId: Id<'booking_integrations'>, webhookToken: string) {
	const siteUrl = convexSiteUrl();
	if (!siteUrl) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'Missing Convex site URL required to build the FareHarbor webhook URL.'
		});
	}
	const url = new URL('/fareharbor/webhook', siteUrl);
	url.searchParams.set('integrationId', integrationId);
	url.searchParams.set('token', webhookToken);
	return url.toString();
}

async function fareHarborFetch(
	userApiKey: string,
	path: string,
	budget?: FareHarborRequestBudget
): Promise<Record<string, unknown>> {
	if (budget) {
		if (budget.remaining <= 0) {
			budget.truncated = true;
			throw new FareHarborBudgetExhausted();
		}
		budget.remaining -= 1;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FAREHARBOR_FETCH_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(`${fareHarborApiBaseUrl()}${path}`, {
			signal: controller.signal,
			headers: {
				Accept: 'application/json',
				'X-FareHarbor-API-App': requiredEnv('FAREHARBOR_APP_KEY'),
				'X-FareHarbor-API-User': userApiKey
			}
		});
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ConvexError({ code: 'provider_error', message: 'FareHarbor request timed out.' });
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		let message = `FareHarbor request failed with ${response.status}.`;
		if (response.status === 401 || response.status === 403) {
			message = 'FareHarbor rejected the API key. Check the user key and company shortname.';
		} else if (response.status === 404) {
			message = 'FareHarbor company not found. Check the company shortname.';
		} else {
			try {
				const body = (await response.json()) as { error?: string; message?: string };
				message = body.error || body.message || message;
			} catch {
				// Keep the status fallback.
			}
		}
		throw new ConvexError({
			code: response.status === 429 ? 'rate_limited' : 'provider_error',
			message
		});
	}

	const body = (await response.json()) as unknown;
	return body && typeof body === 'object' && !Array.isArray(body)
		? (body as Record<string, unknown>)
		: {};
}

class FareHarborBudgetExhausted extends Error {
	constructor() {
		super(
			'FareHarbor has too many tours to list in one sync. Contact support to raise the sync limit.'
		);
		this.name = 'FareHarborBudgetExhausted';
	}
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
	return Array.isArray(value)
		? value.filter(
				(entry): entry is Record<string, unknown> =>
					Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
			)
		: [];
}

function pkSegment(value: unknown): string | null {
	if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
	if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim();
	return null;
}

function companyPath(shortname: string) {
	return `/companies/${encodeURIComponent(shortname)}`;
}

async function getFareHarborCompany(userApiKey: string, shortname: string) {
	const result = await fareHarborFetch(userApiKey, `${companyPath(shortname)}/`);
	const company =
		result.company && typeof result.company === 'object'
			? (result.company as Record<string, unknown>)
			: {};
	return {
		name: typeof company.name === 'string' ? company.name : undefined
	};
}

type FareHarborSyncResult = {
	bookingCount: number;
	/** start_at of the first slot this run did not reach, or null when it covered every slot. */
	nextCursor: string | null;
	/** Date of the last slot synced, for the truncation message. */
	syncedThrough: string | null;
};

async function syncFareHarborBookings(
	ctx: ActionCtx,
	args: {
		integrationId: Id<'booking_integrations'>;
		userApiKey: string;
		shortname: string;
		start: Date;
		end: Date;
		resumeAfter?: string;
	}
): Promise<FareHarborSyncResult> {
	const budget: FareHarborRequestBudget = {
		remaining: FAREHARBOR_SYNC_MAX_REQUESTS,
		truncated: false
	};
	// Stop well inside Convex's action time limit so the run always records its result.
	const deadline = Date.now() + FAREHARBOR_SYNC_MAX_RUNTIME_MS;
	const base = companyPath(args.shortname);

	// 1. List every item's availabilities in the window. This costs items x 31-day ranges
	//    requests and gives the full slot list before any booking requests are spent.
	const itemsResult = await fareHarborFetch(args.userApiKey, `${base}/items/`, budget);
	const slots: FareHarborSyncSlot[] = [];
	for (const range of fareHarborDateRanges(args.start, args.end)) {
		for (const item of recordArray(itemsResult.items)) {
			const itemPk = pkSegment(item.pk);
			if (!itemPk) continue;
			const availabilityResult = await fareHarborFetch(
				args.userApiKey,
				`${base}/items/${itemPk}/minimal/availabilities/date-range/${range.start}/${range.end}/`,
				budget
			);
			for (const availability of recordArray(availabilityResult.availabilities)) {
				const slot = fareHarborSyncSlot(
					availability,
					typeof item.name === 'string' ? item.name : undefined
				);
				if (slot) slots.push(slot);
			}
		}
	}

	// 2. Fetch bookings slot by slot in date order across all items, starting where the
	//    previous run stopped and wrapping around, so truncated runs still cover everything.
	const ordered = orderFareHarborSyncSlots(slots, args.resumeAfter);
	let bookingCount = 0;
	let syncedThrough: string | null = null;
	for (const [index, slot] of ordered.entries()) {
		if (budget.remaining <= 0 || Date.now() > deadline) {
			console.warn('[fareharbor/sync] run truncated; resuming from cursor next run', {
				integrationId: args.integrationId,
				slotsSynced: index,
				slotsTotal: ordered.length,
				bookingCount
			});
			return {
				bookingCount,
				nextCursor: slot.startAt ?? null,
				syncedThrough
			};
		}
		const context: FareHarborAvailabilityContext = {
			startAt: slot.startAt,
			endAt: slot.endAt,
			itemName: slot.itemName
		};
		const bookingsResult = await fareHarborFetch(
			args.userApiKey,
			`${base}/availabilities/${slot.availabilityPk}/bookings/`,
			budget
		);
		for (const booking of recordArray(bookingsResult.bookings)) {
			const normalized = normalizeFareHarborBooking(booking, context);
			if (!normalized) continue;
			await ctx.runMutation(internal.integrations.upsertProviderBooking, {
				integrationId: args.integrationId,
				lookupToken: token(),
				booking: normalized
			});
			bookingCount += 1;
		}
		syncedThrough = slot.startAt?.slice(0, 10) ?? syncedThrough;
	}

	return { bookingCount, nextCursor: null, syncedThrough };
}

function syncWindow(syncType: keyof typeof FAREHARBOR_SYNC_WINDOWS) {
	const window = FAREHARBOR_SYNC_WINDOWS[syncType];
	const now = Date.now();
	return {
		start: new Date(now - window.pastDays * DAY_MS),
		end: new Date(now + window.futureDays * DAY_MS)
	};
}

function errorMessage(error: unknown, fallback: string) {
	if (error instanceof ConvexError) {
		const data = error.data as { message?: unknown } | string;
		if (typeof data === 'string') return data;
		if (typeof data?.message === 'string') return data.message;
	}
	return error instanceof Error ? error.message : fallback;
}

export const connectFareHarbor = action({
	args: {
		workspaceId: v.id('workspaces'),
		companyShortname: v.string(),
		userApiKey: v.string()
	},
	returns: v.object({
		integrationId: v.id('booking_integrations'),
		webhookUrl: v.string()
	}),
	handler: async (
		ctx,
		args
	): Promise<{ integrationId: Id<'booking_integrations'>; webhookUrl: string }> => {
		await ctx.runQuery(internal.integrations.getOwnerAccessForAction, {
			workspaceId: args.workspaceId
		});

		const shortname = normalizeFareHarborShortname(args.companyShortname);
		if (!shortname) {
			throw new ConvexError({
				code: 'invalid_argument',
				message:
					'Enter your FareHarbor company shortname (the part after fareharbor.com/ in your dashboard URL).'
			});
		}
		const userApiKey = args.userApiKey.trim();
		if (userApiKey.length < 8) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter the API user key FareHarbor issued for your company.'
			});
		}

		// Confirms both keys work and that this user key can read the company.
		await getFareHarborCompany(userApiKey, shortname);

		const webhookToken = token();
		const integrationId: Id<'booking_integrations'> = await ctx.runMutation(
			internal.fareharbor.saveFareHarborConnection,
			{
				workspaceId: args.workspaceId,
				accountId: shortname,
				encryptedApiKey: await encryptSecret(userApiKey),
				encryptedWebhookToken: await encryptSecret(webhookToken)
			}
		);

		await ctx.scheduler.runAfter(0, internal.fareharbor.syncFareHarborIntegration, {
			integrationId,
			syncType: 'initial'
		});

		return { integrationId, webhookUrl: fareHarborWebhookUrl(integrationId, webhookToken) };
	}
});

export const getFareHarborWebhookUrl = action({
	args: {
		workspaceId: v.id('workspaces'),
		integrationId: v.id('booking_integrations')
	},
	returns: v.object({ webhookUrl: v.string() }),
	handler: async (ctx, args): Promise<{ webhookUrl: string }> => {
		const integration: { encryptedWebhookToken: string | null } = await ctx.runQuery(
			internal.fareharbor.getFareHarborIntegrationForOwner,
			args
		);
		if (!integration.encryptedWebhookToken) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Reconnect FareHarbor to generate a webhook URL.'
			});
		}
		return {
			webhookUrl: fareHarborWebhookUrl(
				args.integrationId,
				await decryptSecret(integration.encryptedWebhookToken)
			)
		};
	}
});

export const getFareHarborIntegrationForOwner = internalQuery({
	args: {
		workspaceId: v.id('workspaces'),
		integrationId: v.id('booking_integrations')
	},
	returns: v.object({ encryptedWebhookToken: v.union(v.string(), v.null()) }),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId);
		const integration = await ctx.db.get(args.integrationId);
		if (
			!integration ||
			integration.workspaceId !== args.workspaceId ||
			integration.provider !== 'fareharbor' ||
			integration.status === 'disconnected'
		) {
			throw new ConvexError({ code: 'not_found', message: 'Integration not found.' });
		}
		return { encryptedWebhookToken: integration.encryptedWebhookToken ?? null };
	}
});

export const saveFareHarborConnection = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		accountId: v.string(),
		encryptedApiKey: v.string(),
		encryptedWebhookToken: v.string()
	},
	returns: v.id('booking_integrations'),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('booking_integrations')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(10);

		// One booking provider per workspace: public booking lookup matches providerBookingId
		// within the workspace. Unlike Bookeo, refuse rather than silently disconnecting another
		// provider, so its remote webhooks get cleaned up through the normal disconnect flow.
		const otherActive = existing.find(
			(candidate) => candidate.provider !== 'fareharbor' && candidate.status !== 'disconnected'
		);
		if (otherActive) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Disconnect the current booking provider before connecting FareHarbor.'
			});
		}

		const now = Date.now();
		const fields = {
			status: 'syncing' as const,
			accountId: args.accountId,
			encryptedApiKey: args.encryptedApiKey,
			encryptedWebhookToken: args.encryptedWebhookToken,
			syncCursor: undefined,
			permissions: [],
			lastSyncError: undefined,
			disconnectedAt: undefined,
			connectedAt: now,
			updatedAt: now
		};
		const integration = existing.find((candidate) => candidate.provider === 'fareharbor');
		if (integration) {
			await ctx.db.patch(integration._id, fields);
			return integration._id;
		}
		return await ctx.db.insert('booking_integrations', {
			workspaceId: args.workspaceId,
			provider: 'fareharbor',
			...fields
		});
	}
});

export const getFareHarborIntegrationForSync = internalQuery({
	args: { integrationId: v.id('booking_integrations') },
	returns: v.union(
		v.null(),
		v.object({
			workspaceId: v.id('workspaces'),
			status: integrationStatusValidator,
			accountId: v.union(v.string(), v.null()),
			encryptedApiKey: v.union(v.string(), v.null()),
			syncCursor: v.union(v.string(), v.null())
		})
	),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.provider !== 'fareharbor') return null;
		return {
			workspaceId: integration.workspaceId,
			status: integration.status,
			accountId: integration.accountId ?? null,
			encryptedApiKey: integration.encryptedApiKey ?? null,
			syncCursor: integration.syncCursor ?? null
		};
	}
});

export const finishFareHarborSync = internalMutation({
	args: {
		integrationId: v.id('booking_integrations'),
		syncCursor: v.union(v.string(), v.null()),
		notice: v.union(v.string(), v.null())
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.status === 'disconnected') return null;
		await ctx.db.patch(args.integrationId, {
			status: 'connected',
			syncCursor: args.syncCursor ?? undefined,
			lastSyncError: args.notice ?? undefined,
			updatedAt: Date.now()
		});
		return null;
	}
});

export const syncFareHarborIntegration = internalAction({
	args: {
		integrationId: v.id('booking_integrations'),
		syncType: v.union(v.literal('initial'), v.literal('scheduled'))
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const integration: {
			workspaceId: Id<'workspaces'>;
			status: 'connected' | 'syncing' | 'error' | 'disconnected';
			accountId: string | null;
			encryptedApiKey: string | null;
			syncCursor: string | null;
		} | null = await ctx.runQuery(internal.fareharbor.getFareHarborIntegrationForSync, {
			integrationId: args.integrationId
		});
		if (
			!integration ||
			integration.status === 'disconnected' ||
			!integration.encryptedApiKey ||
			!integration.accountId
		) {
			return null;
		}
		const canSync: boolean = await ctx.runQuery(internal.billing.getWorkspaceFeatureAccess, {
			workspaceId: integration.workspaceId,
			feature: 'booking_integrations'
		});
		if (!canSync) return null;

		const syncStarted: boolean = await ctx.runMutation(
			internal.integrations.markBookeoSyncStarted,
			{ integrationId: args.integrationId }
		);
		if (!syncStarted) return null;

		try {
			const window = syncWindow(args.syncType);
			const result = await syncFareHarborBookings(ctx, {
				integrationId: args.integrationId,
				userApiKey: await decryptSecret(integration.encryptedApiKey),
				shortname: integration.accountId,
				start: window.start,
				end: window.end,
				...(integration.syncCursor ? { resumeAfter: integration.syncCursor } : {})
			});
			await ctx.runMutation(internal.fareharbor.finishFareHarborSync, {
				integrationId: args.integrationId,
				syncCursor: result.nextCursor,
				notice: result.nextCursor
					? `FareHarbor has more bookings than one sync can fetch${
							result.syncedThrough ? ` (this run reached ${result.syncedThrough})` : ''
						}. The next sync continues from there, so some bookings can be up to 12 hours behind.`
					: null
			});
		} catch (error) {
			await ctx.runMutation(internal.integrations.markBookeoSyncFinished, {
				integrationId: args.integrationId,
				status: 'failed',
				errorMessage: errorMessage(error, 'Unable to sync FareHarbor bookings.')
			});
		}
		return null;
	}
});

export const scheduleFareHarborSyncsCron = internalMutation({
	args: {},
	returns: v.object({ scheduledCount: v.number() }),
	handler: async (ctx) => {
		let scheduledCount = 0;
		const staleBefore = Date.now() - FAREHARBOR_STALE_SYNC_MS;
		for (const status of ['connected', 'error', 'syncing'] as const) {
			const integrations = await ctx.db
				.query('booking_integrations')
				.withIndex('by_provider_and_status', (q) =>
					q.eq('provider', 'fareharbor').eq('status', status)
				)
				.take(200);
			for (const integration of integrations) {
				// A "syncing" row that hasn't moved in a while belongs to a run that died before
				// recording its result; run it again instead of leaving it stuck.
				if (status === 'syncing' && integration.updatedAt > staleBefore) continue;
				// Spread runs out so many workspaces don't hit FareHarbor at the same instant.
				await ctx.scheduler.runAfter(
					scheduledCount * 5_000,
					internal.fareharbor.syncFareHarborIntegration,
					{ integrationId: integration._id, syncType: 'scheduled' }
				);
				scheduledCount += 1;
			}
		}
		return { scheduledCount };
	}
});

export const getFareHarborWebhookSecret = internalQuery({
	args: { integrationId: v.id('booking_integrations') },
	returns: v.union(v.null(), v.object({ encryptedWebhookToken: v.string() })),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (
			!integration ||
			integration.provider !== 'fareharbor' ||
			integration.status === 'disconnected' ||
			!integration.encryptedWebhookToken
		) {
			return null;
		}
		return { encryptedWebhookToken: integration.encryptedWebhookToken };
	}
});

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const verifyAndRecordFareHarborWebhook = internalAction({
	args: {
		integrationId: v.id('booking_integrations'),
		token: v.string(),
		body: v.string()
	},
	returns: v.object({
		status: v.union(
			v.literal('accepted'),
			v.literal('duplicate'),
			v.literal('rejected'),
			v.literal('invalid')
		)
	}),
	handler: async (
		ctx,
		args
	): Promise<{ status: 'accepted' | 'duplicate' | 'rejected' | 'invalid' }> => {
		const secret: { encryptedWebhookToken: string } | null = await ctx.runQuery(
			internal.fareharbor.getFareHarborWebhookSecret,
			{ integrationId: args.integrationId }
		);
		if (!secret) return { status: 'rejected' };
		const expected = await decryptSecret(secret.encryptedWebhookToken);
		if (!timingSafeEqual(expected, args.token)) return { status: 'rejected' };

		if (new TextEncoder().encode(args.body).byteLength > FAREHARBOR_WEBHOOK_MAX_BODY_BYTES) {
			return { status: 'invalid' };
		}
		let booking: Record<string, unknown>;
		try {
			booking = fareHarborWebhookBooking(JSON.parse(args.body));
		} catch {
			return { status: 'invalid' };
		}

		// FareHarbor sends no message id; identical payloads are idempotent, so dedupe on a hash.
		const result: { duplicate: boolean } = await ctx.runMutation(
			internal.fareharbor.recordFareHarborWebhook,
			{
				integrationId: args.integrationId,
				messageId: await sha256Hex(args.body),
				eventType: fareHarborWebhookEventType(booking),
				itemId: normalizeFareHarborBooking(booking)?.providerBookingId ?? 'unknown',
				rawBody: args.body
			}
		);
		return { status: result.duplicate ? 'duplicate' : 'accepted' };
	}
});

export const recordFareHarborWebhook = internalMutation({
	args: {
		integrationId: v.id('booking_integrations'),
		messageId: v.string(),
		eventType: v.string(),
		itemId: v.string(),
		rawBody: v.string()
	},
	returns: v.object({ duplicate: v.boolean() }),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.provider !== 'fareharbor') {
			throw new ConvexError({ code: 'not_found', message: 'Integration not found.' });
		}

		const existing = await ctx.db
			.query('booking_webhook_events')
			.withIndex('by_integrationId_and_messageId', (q) =>
				q.eq('integrationId', args.integrationId).eq('messageId', args.messageId)
			)
			.unique();
		if (existing) return { duplicate: true };

		const eventId = await ctx.db.insert('booking_webhook_events', {
			workspaceId: integration.workspaceId,
			integrationId: args.integrationId,
			provider: 'fareharbor',
			messageId: args.messageId,
			eventType: args.eventType,
			itemId: args.itemId,
			rawBody: args.rawBody,
			status: 'received',
			receivedAt: Date.now()
		});
		await ctx.scheduler.runAfter(0, internal.fareharbor.processFareHarborWebhookEvent, {
			eventId
		});
		return { duplicate: false };
	}
});

export const processFareHarborWebhookEvent = internalAction({
	args: { eventId: v.id('booking_webhook_events') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const event: {
			eventId: Id<'booking_webhook_events'>;
			integrationId: Id<'booking_integrations'>;
			eventType: string;
			rawBody: string;
		} | null = await ctx.runQuery(internal.integrations.getWebhookEvent, args);
		if (!event) return null;

		try {
			const normalized = normalizeFareHarborBooking(
				fareHarborWebhookBooking(JSON.parse(event.rawBody))
			);
			if (!normalized) {
				await ctx.runMutation(internal.integrations.markWebhookEvent, {
					eventId: args.eventId,
					status: 'ignored'
				});
				return null;
			}
			await ctx.runMutation(internal.integrations.upsertProviderBooking, {
				integrationId: event.integrationId,
				lookupToken: token(),
				booking: normalized
			});
			await ctx.runMutation(internal.integrations.markWebhookEvent, {
				eventId: args.eventId,
				status: 'processed'
			});
		} catch (error) {
			await ctx.runMutation(internal.integrations.markWebhookEvent, {
				eventId: args.eventId,
				status: 'failed',
				errorMessage: errorMessage(error, 'Unable to process FareHarbor webhook.')
			});
		}
		return null;
	}
});
