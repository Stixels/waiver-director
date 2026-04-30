import { ConvexError, v } from 'convex/values';
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	query
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import {
	assertValidSyncHorizon,
	bookingProviderValidator,
	bookingSearchText,
	missingBookeoRequiredPermissions,
	normalizeEmail,
	normalizeNullableString,
	parseDateTime,
	serviceDateFromDateTime,
	syncHorizonMonthsValidator,
	UNKNOWN_ACTIVITY_NAME
} from './lib/bookings';
import { requireWorkspaceMember, requireWorkspaceOwner } from './lib/waivers';

const BOOKEO_API_BASE_URL = 'https://api.bookeo.com/v2';
const BOOKEO_WEBHOOK_TYPES = ['created', 'updated', 'deleted'] as const;
const CONNECT_STATE_TTL_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BOOKEO_WINDOW_MS = 31 * DAY_MS;
const BOOKEO_FETCH_TIMEOUT_MS = 20_000;
const BOOKEO_SYNC_MAX_PAGES = 200;
const CONNECTION_SESSION_RETENTION_MS = 7 * DAY_MS;
const BOOKEO_WEBHOOK_SUCCESS_RETENTION_MS = 7 * DAY_MS;
const BOOKEO_WEBHOOK_FAILED_RETENTION_MS = 30 * DAY_MS;

type BookeoBooking = Record<string, unknown>;

type BookeoWebhook = {
	id?: string;
	url?: string;
	domain?: string;
	type?: string;
};

type NormalizedBooking = {
	providerBookingId: string;
	status: 'active' | 'canceled';
	activityName: string;
	startTime?: string;
	endTime?: string;
	startAt?: number;
	endAt?: number;
	serviceDate?: string;
	leadCustomerName?: string;
	leadCustomerEmail?: string;
	participantCount: number;
};

const integrationSummaryValue = v.object({
	integrationId: v.id('booking_integrations'),
	workspaceId: v.id('workspaces'),
	provider: bookingProviderValidator,
	status: v.union(
		v.literal('connected'),
		v.literal('syncing'),
		v.literal('error'),
		v.literal('disconnected')
	),
	accountId: v.union(v.string(), v.null()),
	permissions: v.array(v.string()),
	missingRequiredPermissions: v.array(v.string()),
	syncHorizonMonths: v.number(),
	apiKeyLast4: v.union(v.string(), v.null()),
	lastSyncError: v.union(v.string(), v.null()),
	connectedAt: v.union(v.number(), v.null()),
	canManage: v.boolean()
});

const webhookEventSummaryValue = v.object({
	eventId: v.id('booking_webhook_events'),
	integrationId: v.id('booking_integrations'),
	eventType: v.string(),
	itemId: v.string(),
	status: v.union(
		v.literal('received'),
		v.literal('processed'),
		v.literal('ignored'),
		v.literal('failed')
	),
	receivedAt: v.number(),
	processedAt: v.union(v.number(), v.null()),
	errorMessage: v.union(v.string(), v.null())
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

function appUrl(): string {
	const configuredUrl =
		process.env.APP_URL?.trim() ||
		process.env.PUBLIC_APP_URL?.trim() ||
		process.env.SITE_URL?.trim() ||
		'http://localhost:5173';

	let url: URL;
	try {
		url = new URL(configuredUrl);
	} catch {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'APP_URL, PUBLIC_APP_URL, or SITE_URL must be an absolute URL.'
		});
	}

	if (!url.protocol || !url.hostname || !['http:', 'https:'].includes(url.protocol)) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'Application URL must include an http(s) scheme and hostname.'
		});
	}

	return url.origin;
}

function convexSiteUrl(): string {
	return process.env.CONVEX_SITE_URL?.trim() || process.env.PUBLIC_CONVEX_SITE_URL?.trim() || '';
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

function bytesToHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptionKey(): Promise<CryptoKey> {
	const secret = requiredEnv('BOOKING_CREDENTIALS_ENCRYPTION_KEY');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
	return await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptSecret(value: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		await encryptionKey(),
		new TextEncoder().encode(value)
	);

	return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

async function decryptSecret(value: string): Promise<string> {
	const [ivBase64, ciphertextBase64] = value.split('.');
	if (!ivBase64 || !ciphertextBase64) {
		throw new ConvexError({
			code: 'invalid_state',
			message: 'Stored booking credential is invalid.'
		});
	}

	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: base64ToBytes(ivBase64) as unknown as BufferSource },
		await encryptionKey(),
		base64ToBytes(ciphertextBase64) as unknown as BufferSource
	);
	return new TextDecoder().decode(decrypted);
}

function token(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function bookeoSignature(input: {
	timestamp: string;
	messageId: string;
	url: string;
	body: string;
}): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(requiredEnv('BOOKEO_SECRET_KEY')),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		new TextEncoder().encode(`${input.timestamp}${input.messageId}${input.url}${input.body}`)
	);
	return bytesToHex(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let index = 0; index < a.length; index += 1) {
		diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}
	return diff === 0;
}

async function bookeoFetch(apiKey: string, path: string, init: RequestInit = {}) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), BOOKEO_FETCH_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(`${BOOKEO_API_BASE_URL}${path}`, {
			...init,
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/json',
				'X-Bookeo-apiKey': apiKey,
				'X-Bookeo-secretKey': requiredEnv('BOOKEO_SECRET_KEY'),
				...init.headers
			}
		});
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ConvexError({
				code: 'provider_error',
				message: 'Bookeo request timed out.'
			});
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		let message = `Bookeo request failed with ${response.status}.`;
		try {
			const body = (await response.json()) as { message?: string };
			if (body.message) message = body.message;
		} catch {
			// Keep the status fallback.
		}
		throw new ConvexError({
			code: response.status === 429 ? 'rate_limited' : 'provider_error',
			message
		});
	}

	if (response.status === 204) return null;
	return (await response.json()) as unknown;
}

async function getBookeoApiKeyInfo(apiKey: string) {
	const result = (await bookeoFetch(apiKey, '/settings/apikeyinfo')) as {
		accountId?: string;
		permissions?: string[];
	};

	return {
		accountId: normalizeNullableString(result.accountId),
		permissions: Array.isArray(result.permissions) ? result.permissions : []
	};
}

async function registerBookeoWebhooks(apiKey: string, integrationId: Id<'booking_integrations'>) {
	const siteUrl = convexSiteUrl();
	if (!siteUrl) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'Missing Convex site URL required to register Bookeo webhooks.'
		});
	}
	try {
		for (const type of BOOKEO_WEBHOOK_TYPES) {
			const url = `${siteUrl}/bookeo/webhook?integrationId=${integrationId}&type=${type}`;
			await bookeoFetch(apiKey, '/webhooks', {
				method: 'POST',
				body: JSON.stringify({
					domain: 'bookings',
					type,
					url
				})
			});
		}
	} catch (error) {
		try {
			await unregisterBookeoWebhooks(apiKey, integrationId);
		} catch {
			// Best-effort cleanup only; preserve the original registration error.
		}
		throw error;
	}
}

async function unregisterBookeoWebhooks(apiKey: string, integrationId: Id<'booking_integrations'>) {
	const result = (await bookeoFetch(apiKey, '/webhooks')) as {
		data?: BookeoWebhook[];
	};
	const webhooks = Array.isArray(result.data) ? result.data : [];
	const matchingWebhooks = webhooks.filter((webhook) =>
		isRegisteredBookeoWebhook(webhook, integrationId)
	);

	for (const webhook of matchingWebhooks) {
		await bookeoFetch(apiKey, `/webhooks/${encodeURIComponent(webhook.id)}`, {
			method: 'DELETE'
		});
	}
}

function isRegisteredBookeoWebhook(
	webhook: BookeoWebhook,
	integrationId: Id<'booking_integrations'>
): webhook is BookeoWebhook & {
	id: string;
	url: string;
	type: (typeof BOOKEO_WEBHOOK_TYPES)[number];
} {
	if (
		!webhook.id ||
		!webhook.url ||
		webhook.domain !== 'bookings' ||
		!BOOKEO_WEBHOOK_TYPES.includes(webhook.type as (typeof BOOKEO_WEBHOOK_TYPES)[number])
	) {
		return false;
	}

	try {
		const url = new URL(webhook.url);
		return (
			url.pathname === '/bookeo/webhook' &&
			url.searchParams.get('integrationId') === integrationId &&
			url.searchParams.get('type') === webhook.type
		);
	} catch {
		return false;
	}
}

function buildBookeoAuthorizationUrl(state: string): string {
	const configuredUrl = requiredEnv('BOOKEO_AUTHORIZATION_URL');
	const url = new URL(configuredUrl);
	url.searchParams.set('permissions', 'bookings_r_all,customers_r_all');
	url.searchParams.set('state', state);
	return url.toString();
}

function toRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
	return normalizeNullableString(record[key]);
}

function customerName(customer: Record<string, unknown>): string | undefined {
	const name = [optionalString(customer, 'firstName'), optionalString(customer, 'lastName')]
		.filter(Boolean)
		.join(' ')
		.trim();
	return name || optionalString(customer, 'name') || optionalString(customer, 'fullName');
}

function positiveNumber(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
	if (typeof value !== 'string') return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function participantDetailsCount(value: unknown): number {
	const participantRecord = toRecord(value);
	const participantDetails = Array.isArray(participantRecord.details)
		? participantRecord.details
		: Array.isArray(value)
			? value
			: [];
	return participantDetails.length;
}

function participantNumbersCount(value: unknown): number {
	const participantRecord = toRecord(value);
	const numbers = Array.isArray(participantRecord.numbers) ? participantRecord.numbers : [];

	return numbers.reduce((total, entry) => {
		const count = positiveNumber(toRecord(entry).number);
		return count ? total + count : total;
	}, 0);
}

function participantCount(booking: BookeoBooking): number {
	const numberCount = participantNumbersCount(booking.participants);
	if (numberCount > 0) return numberCount;

	const detailsCount = participantDetailsCount(booking.participants);
	if (detailsCount > 0) return detailsCount;

	const participantRecord = toRecord(booking.participants);
	for (const key of ['numParticipants', 'numberParticipants', 'totalParticipants', 'numPeople']) {
		const value = participantRecord[key] ?? booking[key];
		const count = positiveNumber(value);
		if (count) return count;
	}

	return 1;
}

function normalizeBookeoBooking(booking: BookeoBooking): NormalizedBooking | null {
	const providerBookingId = optionalString(booking, 'bookingNumber');
	if (!providerBookingId) return null;

	const customer = toRecord(booking.customer);
	const startTime = optionalString(booking, 'startTime');
	const endTime = optionalString(booking, 'endTime');
	const startAt = parseDateTime(startTime);
	const endAt = parseDateTime(endTime);
	const serviceDate = serviceDateFromDateTime(startTime);
	const productName = optionalString(booking, 'productName');
	const activityName = productName || UNKNOWN_ACTIVITY_NAME;
	const leadCustomerName = customerName(customer);
	const leadCustomerEmail = normalizeEmail(
		optionalString(customer, 'emailAddress') || optionalString(customer, 'email')
	);

	return {
		providerBookingId,
		status: booking.canceled === true ? 'canceled' : 'active',
		activityName,
		...(startTime ? { startTime } : {}),
		...(endTime ? { endTime } : {}),
		...(startAt !== undefined ? { startAt } : {}),
		...(endAt !== undefined ? { endAt } : {}),
		...(serviceDate ? { serviceDate } : {}),
		...(leadCustomerName ? { leadCustomerName } : {}),
		...(leadCustomerEmail ? { leadCustomerEmail } : {}),
		participantCount: participantCount(booking)
	};
}

function bookeoListBookingsPath(args: {
	start: string;
	end: string;
	pageNavigationToken?: string;
	pageNumber?: number;
}) {
	const params = new URLSearchParams();
	if (args.pageNavigationToken) {
		params.set('pageNavigationToken', args.pageNavigationToken);
		params.set('pageNumber', String(args.pageNumber ?? 1));
	} else {
		params.set('startTime', args.start);
		params.set('endTime', args.end);
		params.set('includeCanceled', 'true');
		params.set('expandCustomer', 'true');
		params.set('expandParticipants', 'true');
		params.set('itemsPerPage', '100');
	}
	return `/bookings?${params.toString()}`;
}

async function syncBookeoWindow(
	ctx: ActionCtx,
	args: {
		integrationId: Id<'booking_integrations'>;
		apiKey: string;
		start: Date;
		end: Date;
	}
) {
	let pageNumber = 1;
	let pageNavigationToken: string | undefined;
	let totalPages: number;

	do {
		const response = (await bookeoFetch(
			args.apiKey,
			bookeoListBookingsPath({
				start: args.start.toISOString(),
				end: args.end.toISOString(),
				pageNavigationToken,
				pageNumber
			})
		)) as {
			data?: BookeoBooking[];
			info?: {
				totalPages?: number;
				pageNavigationToken?: string;
			};
		};

		for (const booking of response.data ?? []) {
			const normalized = normalizeBookeoBooking(booking);
			if (!normalized) continue;
			await ctx.runMutation(internal.integrations.upsertProviderBooking, {
				integrationId: args.integrationId,
				lookupToken: token(),
				booking: normalized
			});
		}

		pageNavigationToken = response.info?.pageNavigationToken;
		totalPages = response.info?.totalPages ?? 1;
		pageNumber += 1;
		if (pageNavigationToken && pageNumber > BOOKEO_SYNC_MAX_PAGES) {
			console.warn('[bookeo/sync] reached page cap; sync window may be truncated', {
				integrationId: args.integrationId,
				pageNumber,
				pageNavigationToken,
				totalPages,
				maxPages: BOOKEO_SYNC_MAX_PAGES
			});
			break;
		}
	} while (pageNavigationToken && pageNumber <= totalPages && pageNumber <= BOOKEO_SYNC_MAX_PAGES);
}

function initialSyncRange(syncHorizonMonths: number) {
	const start = new Date(Date.now() - 30 * DAY_MS);
	const end = new Date();
	end.setMonth(end.getMonth() + syncHorizonMonths);
	return { start, end };
}

function chunkRanges(start: Date, end: Date): Array<{ start: Date; end: Date }> {
	const chunks: Array<{ start: Date; end: Date }> = [];
	let cursor = start.getTime();
	while (cursor < end.getTime()) {
		const next = Math.min(cursor + BOOKEO_WINDOW_MS, end.getTime());
		chunks.push({ start: new Date(cursor), end: new Date(next) });
		cursor = next;
	}
	return chunks;
}

export const listWorkspaceIntegrations = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.array(integrationSummaryValue),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceMember(ctx, args.workspaceId);
		const integrations = await ctx.db
			.query('booking_integrations')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(10);

		return integrations.map((integration) => ({
			integrationId: integration._id,
			workspaceId: integration.workspaceId,
			provider: integration.provider,
			status: integration.status,
			accountId: integration.accountId ?? null,
			permissions: integration.permissions,
			missingRequiredPermissions:
				integration.provider === 'bookeo'
					? missingBookeoRequiredPermissions(integration.permissions)
					: [],
			syncHorizonMonths: integration.syncHorizonMonths,
			apiKeyLast4: integration.apiKeyLast4 ?? null,
			lastSyncError: integration.lastSyncError ?? null,
			connectedAt: integration.connectedAt ?? null,
			canManage: membership.role === 'owner'
		}));
	}
});

export const listRecentWebhookEvents = query({
	args: {
		workspaceId: v.id('workspaces'),
		integrationId: v.id('booking_integrations')
	},
	returns: v.array(webhookEventSummaryValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.workspaceId !== args.workspaceId) return [];

		const events = await ctx.db
			.query('booking_webhook_events')
			.withIndex('by_integrationId', (q) => q.eq('integrationId', args.integrationId))
			.order('desc')
			.take(5);

		return events.map((event) => ({
			eventId: event._id,
			integrationId: event.integrationId,
			eventType: event.eventType,
			itemId: event.itemId,
			status: event.status,
			receivedAt: event.receivedAt,
			processedAt: event.processedAt ?? null,
			errorMessage: event.errorMessage ?? null
		}));
	}
});

export const disconnectBookingIntegration = action({
	args: {
		workspaceId: v.id('workspaces'),
		integrationId: v.id('booking_integrations')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const integration: {
			integrationId: Id<'booking_integrations'>;
			provider: 'bookeo' | 'resova' | 'xola';
			status: 'connected' | 'syncing' | 'error' | 'disconnected';
			encryptedApiKey: string | null;
		} = await ctx.runQuery(internal.integrations.getIntegrationForDisconnect, {
			workspaceId: args.workspaceId,
			integrationId: args.integrationId
		});

		let remoteCleanupError: string | undefined;
		if (
			integration.provider === 'bookeo' &&
			integration.status !== 'disconnected' &&
			integration.encryptedApiKey
		) {
			try {
				await unregisterBookeoWebhooks(
					await decryptSecret(integration.encryptedApiKey),
					integration.integrationId
				);
			} catch (error) {
				remoteCleanupError =
					error instanceof Error ? error.message : 'Unable to unregister Bookeo webhooks.';
			}
		}

		await ctx.runMutation(internal.integrations.markBookingIntegrationDisconnected, {
			workspaceId: args.workspaceId,
			integrationId: args.integrationId,
			...(remoteCleanupError ? { remoteCleanupError } : {})
		});

		return null;
	}
});

export const startBookeoConnect = action({
	args: {
		workspaceId: v.id('workspaces'),
		syncHorizonMonths: syncHorizonMonthsValidator
	},
	returns: v.object({
		authorizationUrl: v.string()
	}),
	handler: async (ctx, args) => {
		const syncHorizonMonths = assertValidSyncHorizon(args.syncHorizonMonths);
		const access: { userId: Id<'users'> } = await ctx.runQuery(
			internal.integrations.getOwnerAccessForAction,
			{
				workspaceId: args.workspaceId
			}
		);
		const state = token();
		await ctx.runMutation(internal.integrations.createConnectionSession, {
			workspaceId: args.workspaceId,
			provider: 'bookeo',
			requestedByUserId: access.userId,
			state,
			syncHorizonMonths
		});

		return {
			authorizationUrl: buildBookeoAuthorizationUrl(state)
		};
	}
});

export const connectBookeoManually = action({
	args: {
		workspaceId: v.id('workspaces'),
		apiKey: v.string(),
		syncHorizonMonths: syncHorizonMonthsValidator
	},
	returns: v.object({
		integrationId: v.id('booking_integrations')
	}),
	handler: async (ctx, args): Promise<{ integrationId: Id<'booking_integrations'> }> => {
		const syncHorizonMonths = assertValidSyncHorizon(args.syncHorizonMonths);
		await ctx.runQuery(internal.integrations.getOwnerAccessForAction, {
			workspaceId: args.workspaceId
		});

		const apiKey = args.apiKey.trim();
		if (apiKey.length < 6) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter a valid Bookeo API key.'
			});
		}

		const apiKeyInfo = await getBookeoApiKeyInfo(apiKey);
		const missing = missingBookeoRequiredPermissions(apiKeyInfo.permissions);
		if (missing.length > 0) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `Bookeo API key is missing required permissions: ${missing.join(', ')}.`
			});
		}

		let integrationId: Id<'booking_integrations'> | null = null;
		try {
			const savedIntegrationId: Id<'booking_integrations'> = await ctx.runMutation(
				internal.integrations.saveBookeoConnection,
				{
					workspaceId: args.workspaceId,
					encryptedApiKey: await encryptSecret(apiKey),
					apiKeyLast4: apiKey.slice(-4),
					accountId: apiKeyInfo.accountId,
					permissions: apiKeyInfo.permissions,
					syncHorizonMonths
				}
			);
			integrationId = savedIntegrationId;
			await registerBookeoWebhooks(apiKey, savedIntegrationId);
			await ctx.runMutation(internal.integrations.markBookeoConnectionReady, {
				integrationId: savedIntegrationId
			});
		} catch (error) {
			if (integrationId) {
				await ctx.runMutation(internal.integrations.markBookeoConnectionSetupFailed, {
					integrationId,
					errorMessage:
						error instanceof Error ? error.message : 'Unable to finish Bookeo connection setup.'
				});
			}
			throw error;
		}
		if (!integrationId) {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Bookeo connection was not saved.'
			});
		}

		await ctx.scheduler.runAfter(0, internal.integrations.syncBookeoIntegration, {
			integrationId,
			syncType: 'initial'
		});

		return { integrationId };
	}
});

export const getOwnerAccessForAction = internalQuery({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.object({
		userId: v.id('users')
	}),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceOwner(ctx, args.workspaceId);
		return { userId: user._id };
	}
});

export const getIntegrationForDisconnect = internalQuery({
	args: {
		workspaceId: v.id('workspaces'),
		integrationId: v.id('booking_integrations')
	},
	returns: v.object({
		integrationId: v.id('booking_integrations'),
		provider: bookingProviderValidator,
		status: v.union(
			v.literal('connected'),
			v.literal('syncing'),
			v.literal('error'),
			v.literal('disconnected')
		),
		encryptedApiKey: v.union(v.string(), v.null())
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId);
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.workspaceId !== args.workspaceId) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Integration not found.'
			});
		}

		return {
			integrationId: integration._id,
			provider: integration.provider,
			status: integration.status,
			encryptedApiKey: integration.encryptedApiKey ?? null
		};
	}
});

export const markBookingIntegrationDisconnected = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		integrationId: v.id('booking_integrations'),
		remoteCleanupError: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.workspaceId !== args.workspaceId) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Integration not found.'
			});
		}

		const now = Date.now();
		await ctx.db.patch(integration._id, {
			status: 'disconnected',
			encryptedApiKey: undefined,
			...(args.remoteCleanupError ? { lastSyncError: args.remoteCleanupError } : {}),
			disconnectedAt: now,
			updatedAt: now
		});

		return null;
	}
});

export const createConnectionSession = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		provider: bookingProviderValidator,
		requestedByUserId: v.id('users'),
		state: v.string(),
		syncHorizonMonths: syncHorizonMonthsValidator
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const syncHorizonMonths = assertValidSyncHorizon(args.syncHorizonMonths);
		await ctx.db.insert('booking_connection_sessions', {
			workspaceId: args.workspaceId,
			provider: args.provider,
			requestedByUserId: args.requestedByUserId,
			state: args.state,
			status: 'pending',
			syncHorizonMonths,
			createdAt: Date.now(),
			expiresAt: Date.now() + CONNECT_STATE_TTL_MS
		});
		return null;
	}
});

export const getPendingConnectionSession = internalQuery({
	args: {
		state: v.string()
	},
	returns: v.union(
		v.null(),
		v.object({
			sessionId: v.id('booking_connection_sessions'),
			workspaceId: v.id('workspaces'),
			provider: bookingProviderValidator,
			status: v.union(
				v.literal('pending'),
				v.literal('completed'),
				v.literal('failed'),
				v.literal('expired')
			),
			syncHorizonMonths: v.number(),
			expiresAt: v.number()
		})
	),
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query('booking_connection_sessions')
			.withIndex('by_state', (q) => q.eq('state', args.state))
			.unique();
		if (!session) return null;

		return {
			sessionId: session._id,
			workspaceId: session.workspaceId,
			provider: session.provider,
			status: session.status,
			syncHorizonMonths: session.syncHorizonMonths,
			expiresAt: session.expiresAt
		};
	}
});

export const markConnectionSession = internalMutation({
	args: {
		sessionId: v.id('booking_connection_sessions'),
		status: v.union(v.literal('completed'), v.literal('failed'), v.literal('expired'))
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.sessionId, { status: args.status });
		return null;
	}
});

export const pruneOldBookingConnectionSessionsCron = internalMutation({
	args: {},
	returns: v.object({
		deletedCount: v.number()
	}),
	handler: async (ctx) => {
		const cutoff = Date.now() - CONNECTION_SESSION_RETENTION_MS;
		const statuses = ['pending', 'expired', 'completed', 'failed'] as const;
		let deletedCount = 0;

		for (const status of statuses) {
			const sessions = await ctx.db
				.query('booking_connection_sessions')
				.withIndex('by_status_and_createdAt', (q) => q.eq('status', status).lt('createdAt', cutoff))
				.take(100);

			for (const session of sessions) {
				await ctx.db.delete(session._id);
				deletedCount += 1;
			}
		}

		return { deletedCount };
	}
});

export const pruneOldBookeoWebhookEventsCron = internalMutation({
	args: {},
	returns: v.object({
		deletedCount: v.number()
	}),
	handler: async (ctx) => {
		const now = Date.now();
		const retentionByStatus = [
			{ status: 'processed', retentionMs: BOOKEO_WEBHOOK_SUCCESS_RETENTION_MS },
			{ status: 'ignored', retentionMs: BOOKEO_WEBHOOK_SUCCESS_RETENTION_MS },
			{ status: 'failed', retentionMs: BOOKEO_WEBHOOK_FAILED_RETENTION_MS }
		] as const;
		let deletedCount = 0;

		for (const { status, retentionMs } of retentionByStatus) {
			const cutoff = now - retentionMs;
			const events = await ctx.db
				.query('booking_webhook_events')
				.withIndex('by_status_and_receivedAt', (q) =>
					q.eq('status', status).lt('receivedAt', cutoff)
				)
				.take(100);

			for (const event of events) {
				await ctx.db.delete(event._id);
				deletedCount += 1;
			}
		}

		return { deletedCount };
	}
});

export const saveBookeoConnection = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		encryptedApiKey: v.string(),
		apiKeyLast4: v.string(),
		accountId: v.optional(v.string()),
		permissions: v.array(v.string()),
		syncHorizonMonths: syncHorizonMonthsValidator
	},
	returns: v.id('booking_integrations'),
	handler: async (ctx, args) => {
		const syncHorizonMonths = assertValidSyncHorizon(args.syncHorizonMonths);
		const now = Date.now();
		const existing = await ctx.db
			.query('booking_integrations')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(10);
		const integration = existing.find((candidate) => candidate.provider === 'bookeo') ?? null;

		for (const candidate of existing) {
			if (candidate.provider !== 'bookeo' && candidate.status !== 'disconnected') {
				await ctx.db.patch(candidate._id, {
					status: 'disconnected',
					disconnectedAt: now,
					updatedAt: now
				});
			}
		}

		if (!integration) {
			return await ctx.db.insert('booking_integrations', {
				workspaceId: args.workspaceId,
				provider: 'bookeo',
				status: 'syncing',
				encryptedApiKey: args.encryptedApiKey,
				apiKeyLast4: args.apiKeyLast4,
				...(args.accountId ? { accountId: args.accountId } : {}),
				permissions: args.permissions,
				syncHorizonMonths,
				updatedAt: now
			});
		}

		await ctx.db.patch(integration._id, {
			status: 'syncing',
			encryptedApiKey: args.encryptedApiKey,
			apiKeyLast4: args.apiKeyLast4,
			accountId: args.accountId,
			permissions: args.permissions,
			syncHorizonMonths,
			lastSyncError: undefined,
			disconnectedAt: undefined,
			updatedAt: now
		});
		return integration._id;
	}
});

export const markBookeoConnectionReady = internalMutation({
	args: {
		integrationId: v.id('booking_integrations')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.provider !== 'bookeo') {
			throw new ConvexError({
				code: 'not_found',
				message: 'Integration not found.'
			});
		}
		if (integration.status === 'disconnected') return null;
		const now = Date.now();
		await ctx.db.patch(integration._id, {
			status: 'connected',
			connectedAt: integration.connectedAt ?? now,
			disconnectedAt: undefined,
			lastSyncError: undefined,
			updatedAt: now
		});
		return null;
	}
});

export const markBookeoConnectionSetupFailed = internalMutation({
	args: {
		integrationId: v.id('booking_integrations'),
		errorMessage: v.string()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.provider !== 'bookeo') return null;
		if (integration.status === 'disconnected') return null;
		await ctx.db.patch(integration._id, {
			status: 'error',
			lastSyncError: args.errorMessage,
			updatedAt: Date.now()
		});
		return null;
	}
});

export const getIntegrationSecret = internalQuery({
	args: {
		integrationId: v.id('booking_integrations')
	},
	returns: v.union(
		v.null(),
		v.object({
			integrationId: v.id('booking_integrations'),
			workspaceId: v.id('workspaces'),
			provider: bookingProviderValidator,
			status: v.union(
				v.literal('connected'),
				v.literal('syncing'),
				v.literal('error'),
				v.literal('disconnected')
			),
			encryptedApiKey: v.union(v.string(), v.null()),
			syncHorizonMonths: v.number()
		})
	),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration) return null;
		return {
			integrationId: integration._id,
			workspaceId: integration.workspaceId,
			provider: integration.provider,
			status: integration.status,
			encryptedApiKey: integration.encryptedApiKey ?? null,
			syncHorizonMonths: integration.syncHorizonMonths
		};
	}
});

export const getWebhookIntegration = internalQuery({
	args: {
		integrationId: v.id('booking_integrations')
	},
	returns: v.union(
		v.null(),
		v.object({
			integrationId: v.id('booking_integrations'),
			workspaceId: v.id('workspaces'),
			status: v.union(
				v.literal('connected'),
				v.literal('syncing'),
				v.literal('error'),
				v.literal('disconnected')
			)
		})
	),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.provider !== 'bookeo') return null;
		return {
			integrationId: integration._id,
			workspaceId: integration.workspaceId,
			status: integration.status
		};
	}
});

export const markBookeoSyncStarted = internalMutation({
	args: {
		integrationId: v.id('booking_integrations')
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Integration not found.'
			});
		}
		if (integration.status === 'disconnected' || !integration.encryptedApiKey) {
			return false;
		}

		const now = Date.now();
		await ctx.db.patch(integration._id, {
			status: 'syncing',
			lastSyncError: undefined,
			updatedAt: now
		});
		return true;
	}
});

export const markBookeoSyncFinished = internalMutation({
	args: {
		integrationId: v.id('booking_integrations'),
		status: v.union(v.literal('succeeded'), v.literal('failed')),
		errorMessage: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		const integration = await ctx.db.get(args.integrationId);
		if (!integration || integration.status === 'disconnected') {
			return null;
		}

		await ctx.db.patch(args.integrationId, {
			status: args.status === 'succeeded' ? 'connected' : 'error',
			...(args.status === 'succeeded' ? { lastSyncError: undefined } : {}),
			...(args.errorMessage ? { lastSyncError: args.errorMessage } : {}),
			updatedAt: now
		});
		return null;
	}
});

export const upsertProviderBooking = internalMutation({
	args: {
		integrationId: v.id('booking_integrations'),
		lookupToken: v.string(),
		booking: v.object({
			providerBookingId: v.string(),
			status: v.union(v.literal('active'), v.literal('canceled')),
			activityName: v.string(),
			startTime: v.optional(v.string()),
			endTime: v.optional(v.string()),
			startAt: v.optional(v.number()),
			endAt: v.optional(v.number()),
			serviceDate: v.optional(v.string()),
			leadCustomerName: v.optional(v.string()),
			leadCustomerEmail: v.optional(v.string()),
			participantCount: v.number()
		})
	},
	returns: v.id('bookings'),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Integration not found.'
			});
		}

		const now = Date.now();
		const existing = await ctx.db
			.query('bookings')
			.withIndex('by_workspaceId_and_provider_and_providerBookingId', (q) =>
				q
					.eq('workspaceId', integration.workspaceId)
					.eq('provider', integration.provider)
					.eq('providerBookingId', args.booking.providerBookingId)
			)
			.unique();

		const activityName =
			args.booking.activityName === UNKNOWN_ACTIVITY_NAME && existing
				? existing.activityName
				: args.booking.activityName;
		const bookingFields = {
			workspaceId: integration.workspaceId,
			integrationId: integration._id,
			provider: integration.provider,
			providerBookingId: args.booking.providerBookingId,
			searchText: bookingSearchText({
				providerBookingId: args.booking.providerBookingId,
				activityName,
				leadCustomerName: args.booking.leadCustomerName,
				leadCustomerEmail: args.booking.leadCustomerEmail
			}),
			status: args.booking.status,
			activityName,
			startTime: args.booking.startTime,
			endTime: args.booking.endTime,
			startAt: args.booking.startAt,
			endAt: args.booking.endAt,
			serviceDate: args.booking.serviceDate,
			leadCustomerName: args.booking.leadCustomerName,
			leadCustomerEmail: args.booking.leadCustomerEmail,
			participantCount: args.booking.participantCount,
			updatedAt: now
		};

		const bookingId = existing
			? existing._id
			: await ctx.db.insert('bookings', {
					...bookingFields,
					lookupToken: args.lookupToken,
					signedCount: 0
				});

		if (existing) {
			await ctx.db.patch(existing._id, bookingFields);
		}

		return bookingId;
	}
});

export const recordBookeoWebhook = internalMutation({
	args: {
		integrationId: v.id('booking_integrations'),
		messageId: v.string(),
		eventType: v.string(),
		itemId: v.string(),
		rawBody: v.string(),
		previousMessageLost: v.boolean()
	},
	returns: v.object({
		duplicate: v.boolean()
	}),
	handler: async (ctx, args) => {
		const integration = await ctx.db.get(args.integrationId);
		if (!integration) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Integration not found.'
			});
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
			provider: 'bookeo',
			messageId: args.messageId,
			eventType: args.eventType,
			itemId: args.itemId,
			rawBody: args.rawBody,
			status: 'received',
			receivedAt: Date.now()
		});

		await ctx.scheduler.runAfter(0, internal.integrations.processBookeoWebhookEvent, { eventId });
		if (args.previousMessageLost) {
			await ctx.scheduler.runAfter(0, internal.integrations.syncBookeoIntegration, {
				integrationId: args.integrationId,
				syncType: 'repair'
			});
		}

		return { duplicate: false };
	}
});

export const getWebhookEvent = internalQuery({
	args: {
		eventId: v.id('booking_webhook_events')
	},
	returns: v.union(
		v.null(),
		v.object({
			eventId: v.id('booking_webhook_events'),
			integrationId: v.id('booking_integrations'),
			eventType: v.string(),
			rawBody: v.string()
		})
	),
	handler: async (ctx, args) => {
		const event = await ctx.db.get(args.eventId);
		if (!event) return null;
		return {
			eventId: event._id,
			integrationId: event.integrationId,
			eventType: event.eventType,
			rawBody: event.rawBody
		};
	}
});

export const markWebhookEvent = internalMutation({
	args: {
		eventId: v.id('booking_webhook_events'),
		status: v.union(v.literal('processed'), v.literal('ignored'), v.literal('failed')),
		errorMessage: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.eventId, {
			status: args.status,
			processedAt: Date.now(),
			...(args.errorMessage ? { errorMessage: args.errorMessage } : {})
		});
		return null;
	}
});

export const processBookeoWebhookEvent = internalAction({
	args: {
		eventId: v.id('booking_webhook_events')
	},
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
			const body = JSON.parse(event.rawBody) as { item?: BookeoBooking };
			const normalized = normalizeBookeoBooking(toRecord(body.item));
			if (!normalized) {
				await ctx.runMutation(internal.integrations.markWebhookEvent, {
					eventId: args.eventId,
					status: 'ignored'
				});
				return null;
			}

			if (event.eventType === 'deleted') {
				normalized.status = 'canceled';
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
				errorMessage: error instanceof Error ? error.message : 'Unable to process webhook.'
			});
		}

		return null;
	}
});

export const syncBookeoIntegration = internalAction({
	args: {
		integrationId: v.id('booking_integrations'),
		syncType: v.union(v.literal('initial'), v.literal('webhook'), v.literal('repair'))
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const integration: {
			integrationId: Id<'booking_integrations'>;
			workspaceId: Id<'workspaces'>;
			provider: 'bookeo' | 'resova' | 'xola';
			status: 'connected' | 'syncing' | 'error' | 'disconnected';
			encryptedApiKey: string | null;
			syncHorizonMonths: number;
		} | null = await ctx.runQuery(internal.integrations.getIntegrationSecret, {
			integrationId: args.integrationId
		});
		if (!integration || integration.provider !== 'bookeo' || !integration.encryptedApiKey) {
			return null;
		}
		if (integration.status === 'disconnected') return null;

		const horizon = assertValidSyncHorizon(integration.syncHorizonMonths);
		const range = initialSyncRange(args.syncType === 'repair' ? 1 : horizon);
		const syncStarted: boolean = await ctx.runMutation(
			internal.integrations.markBookeoSyncStarted,
			{
				integrationId: args.integrationId
			}
		);
		if (!syncStarted) return null;

		try {
			const apiKey = await decryptSecret(integration.encryptedApiKey);
			for (const chunk of chunkRanges(range.start, range.end)) {
				await syncBookeoWindow(ctx, {
					integrationId: args.integrationId,
					apiKey,
					start: chunk.start,
					end: chunk.end
				});
			}
			await ctx.runMutation(internal.integrations.markBookeoSyncFinished, {
				integrationId: args.integrationId,
				status: 'succeeded'
			});
		} catch (error) {
			await ctx.runMutation(internal.integrations.markBookeoSyncFinished, {
				integrationId: args.integrationId,
				status: 'failed',
				errorMessage: error instanceof Error ? error.message : 'Unable to sync Bookeo bookings.'
			});
		}

		return null;
	}
});

export const completeBookeoCallback = internalAction({
	args: {
		success: v.boolean(),
		state: v.string(),
		apiKey: v.optional(v.string())
	},
	returns: v.object({
		redirectUrl: v.string()
	}),
	handler: async (ctx, args): Promise<{ redirectUrl: string }> => {
		const session: {
			sessionId: Id<'booking_connection_sessions'>;
			workspaceId: Id<'workspaces'>;
			provider: 'bookeo' | 'resova' | 'xola';
			status: 'pending' | 'completed' | 'failed' | 'expired';
			syncHorizonMonths: number;
			expiresAt: number;
		} | null = await ctx.runQuery(internal.integrations.getPendingConnectionSession, {
			state: args.state
		});

		if (!session || session.status !== 'pending') {
			return { redirectUrl: `${appUrl()}/app?bookeo=invalid-state` };
		}

		if (session.expiresAt < Date.now()) {
			await ctx.runMutation(internal.integrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'expired'
			});
			return { redirectUrl: `${appUrl()}/app?bookeo=expired` };
		}

		const workspace: { slug: string } = await ctx.runQuery(
			internal.integrations.getWorkspaceRedirect,
			{
				workspaceId: session.workspaceId
			}
		);
		const redirectBase: string = `${appUrl()}/app/${workspace.slug}/integrations`;

		const apiKey = args.apiKey?.trim() ?? '';
		if (!args.success || apiKey.length < 6) {
			await ctx.runMutation(internal.integrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'failed'
			});
			return { redirectUrl: `${redirectBase}?bookeo=declined` };
		}

		let integrationId: Id<'booking_integrations'> | null = null;
		try {
			const apiKeyInfo = await getBookeoApiKeyInfo(apiKey);
			const missing = missingBookeoRequiredPermissions(apiKeyInfo.permissions);
			if (missing.length > 0) {
				throw new ConvexError({
					code: 'invalid_argument',
					message: `Missing permissions: ${missing.join(', ')}.`
				});
			}

			const savedIntegrationId: Id<'booking_integrations'> = await ctx.runMutation(
				internal.integrations.saveBookeoConnection,
				{
					workspaceId: session.workspaceId,
					encryptedApiKey: await encryptSecret(apiKey),
					apiKeyLast4: apiKey.slice(-4),
					accountId: apiKeyInfo.accountId,
					permissions: apiKeyInfo.permissions,
					syncHorizonMonths: assertValidSyncHorizon(session.syncHorizonMonths)
				}
			);
			integrationId = savedIntegrationId;
			await registerBookeoWebhooks(apiKey, savedIntegrationId);
			await ctx.runMutation(internal.integrations.markBookeoConnectionReady, {
				integrationId: savedIntegrationId
			});
			await ctx.runMutation(internal.integrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'completed'
			});
			await ctx.scheduler.runAfter(0, internal.integrations.syncBookeoIntegration, {
				integrationId,
				syncType: 'initial'
			});
			return { redirectUrl: `${redirectBase}?bookeo=connected` };
		} catch (error) {
			if (integrationId) {
				await ctx.runMutation(internal.integrations.markBookeoConnectionSetupFailed, {
					integrationId,
					errorMessage:
						error instanceof Error ? error.message : 'Unable to finish Bookeo connection setup.'
				});
			}
			await ctx.runMutation(internal.integrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'failed'
			});
			const message = encodeURIComponent(
				error instanceof Error ? error.message : 'Unable to connect Bookeo.'
			);
			return { redirectUrl: `${redirectBase}?bookeo=error&message=${message}` };
		}
	}
});

export const getWorkspaceRedirect = internalQuery({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.object({
		slug: v.string()
	}),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Workspace not found.'
			});
		}
		return { slug: workspace.slug };
	}
});

export const verifyAndRecordBookeoWebhook = internalAction({
	args: {
		integrationId: v.id('booking_integrations'),
		eventType: v.string(),
		url: v.string(),
		body: v.string(),
		timestamp: v.string(),
		messageId: v.string(),
		signature: v.string(),
		previousMessageLost: v.boolean()
	},
	returns: v.object({
		status: v.union(v.literal('accepted'), v.literal('duplicate'), v.literal('rejected'))
	}),
	handler: async (ctx, args): Promise<{ status: 'accepted' | 'duplicate' | 'rejected' }> => {
		const timestamp = Number(args.timestamp);
		if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 120_000) {
			return { status: 'rejected' };
		}

		const expected = await bookeoSignature({
			timestamp: args.timestamp,
			messageId: args.messageId,
			url: args.url,
			body: args.body
		});
		if (!timingSafeEqual(expected, args.signature.toLowerCase())) {
			return { status: 'rejected' };
		}

		const integration = await ctx.runQuery(internal.integrations.getWebhookIntegration, {
			integrationId: args.integrationId
		});
		if (!integration || integration.status === 'disconnected') {
			return { status: 'rejected' };
		}

		let itemId = 'unknown';
		try {
			const body = JSON.parse(args.body) as { itemId?: string };
			if (body.itemId) itemId = body.itemId;
		} catch (error) {
			console.error('[bookeo/webhook] unable to parse webhook body', error);
		}

		const result: { duplicate: boolean } = await ctx.runMutation(
			internal.integrations.recordBookeoWebhook,
			{
				integrationId: args.integrationId,
				messageId: args.messageId,
				eventType: args.eventType,
				itemId,
				rawBody: args.body,
				previousMessageLost: args.previousMessageLost
			}
		);

		return { status: result.duplicate ? 'duplicate' : 'accepted' };
	}
});
