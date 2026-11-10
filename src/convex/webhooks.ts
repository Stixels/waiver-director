import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { decryptPurposeSecret, encryptPurposeSecret } from './lib/secretBox';
import { serializeSubmission } from './lib/publicApi';
import { requireWorkspaceMember, requireWorkspaceOwner } from './lib/waivers';
import {
	WEBHOOK_DELIVERY_HEADER,
	WEBHOOK_DESCRIPTION_MAX_LENGTH,
	WEBHOOK_EVENT_HEADER,
	WEBHOOK_SIGNATURE_HEADER,
	WEBHOOK_SIGNING_SECRET_PREFIX,
	checkWebhookHostResolvesPublic,
	normalizeWebhookUrl,
	randomToken,
	secretHint,
	signWebhookPayload,
	webhookRetryDelayMs,
	webhookSignatureHeaderValue
} from './lib/webhooks';
import {
	webhookDeliveryEventTypeValidator,
	webhookDeliveryStatusValidator,
	webhookEndpointStatusValidator,
	webhookEventTypeValidator
} from './lib/webhookValidators';

const SECRET_PURPOSE = 'webhook-signing-secret';
const MAX_ENDPOINTS_PER_WORKSPACE = 10;
const RECENT_DELIVERIES_LIMIT = 20;
const AUTO_DISABLE_AFTER_FAILURES = 15;
const DELIVERY_TIMEOUT_MS = 10_000;
const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DELIVERY_CLEANUP_BATCH = 200;
const ERROR_MESSAGE_MAX_LENGTH = 300;

type WebhookEventType = Doc<'webhook_deliveries'>['eventType'];

const endpointSummary = v.object({
	endpointId: v.id('webhook_endpoints'),
	url: v.string(),
	description: v.union(v.string(), v.null()),
	eventTypes: v.array(webhookEventTypeValidator),
	status: webhookEndpointStatusValidator,
	disabledReason: v.union(v.string(), v.null()),
	signingSecretHint: v.string(),
	consecutiveFailures: v.number(),
	lastDeliveryAt: v.union(v.number(), v.null()),
	lastDeliveryOk: v.union(v.boolean(), v.null()),
	createdAt: v.number()
});

const deliverySummary = v.object({
	deliveryId: v.id('webhook_deliveries'),
	eventId: v.string(),
	eventType: webhookDeliveryEventTypeValidator,
	status: webhookDeliveryStatusValidator,
	attempts: v.number(),
	nextAttemptAt: v.union(v.number(), v.null()),
	lastAttemptAt: v.union(v.number(), v.null()),
	lastResponseStatus: v.union(v.number(), v.null()),
	lastError: v.union(v.string(), v.null()),
	createdAt: v.number()
});

function toEndpointSummary(endpoint: Doc<'webhook_endpoints'>) {
	return {
		endpointId: endpoint._id,
		url: endpoint.url,
		description: endpoint.description ?? null,
		eventTypes: endpoint.eventTypes,
		status: endpoint.status,
		disabledReason: endpoint.disabledReason ?? null,
		signingSecretHint: endpoint.signingSecretHint,
		consecutiveFailures: endpoint.consecutiveFailures,
		lastDeliveryAt: endpoint.lastDeliveryAt ?? null,
		lastDeliveryOk: endpoint.lastDeliveryOk ?? null,
		createdAt: endpoint.createdAt
	};
}

function requireValidUrl(raw: string): string {
	const result = normalizeWebhookUrl(raw);
	if (!result.ok) {
		throw new ConvexError({ code: 'invalid_argument', message: result.message });
	}
	return result.url;
}

function normalizeDescription(raw: string | undefined): string | undefined {
	const description = raw?.trim();
	if (!description) return undefined;
	if (description.length > WEBHOOK_DESCRIPTION_MAX_LENGTH) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Description must be ${WEBHOOK_DESCRIPTION_MAX_LENGTH} characters or fewer.`
		});
	}
	return description;
}

function normalizeEventTypes(
	eventTypes: Array<Doc<'webhook_endpoints'>['eventTypes'][number]>
): Doc<'webhook_endpoints'>['eventTypes'] {
	const unique = [...new Set(eventTypes)];
	if (unique.length === 0) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'Choose at least one event to send.'
		});
	}
	return unique;
}

async function requireOwnedEndpoint(
	ctx: MutationCtx,
	workspaceId: Id<'workspaces'>,
	endpointId: Id<'webhook_endpoints'>
) {
	const endpoint = await ctx.db.get(endpointId);
	if (!endpoint || endpoint.workspaceId !== workspaceId) {
		throw new ConvexError({ code: 'not_found', message: 'Webhook endpoint not found.' });
	}
	return endpoint;
}

async function enqueueDelivery(
	ctx: MutationCtx,
	args: {
		endpoint: Doc<'webhook_endpoints'>;
		eventId: string;
		eventType: WebhookEventType;
		payload: string;
	}
) {
	const now = Date.now();
	const deliveryId = await ctx.db.insert('webhook_deliveries', {
		workspaceId: args.endpoint.workspaceId,
		endpointId: args.endpoint._id,
		eventId: args.eventId,
		eventType: args.eventType,
		payload: args.payload,
		status: 'pending',
		attempts: 0,
		nextAttemptAt: now,
		createdAt: now,
		updatedAt: now
	});
	await ctx.scheduler.runAfter(0, internal.webhooks.deliverWebhook, { deliveryId });
	return deliveryId;
}

function eventEnvelope(args: {
	eventId: string;
	eventType: WebhookEventType;
	workspace: Doc<'workspaces'>;
	data: unknown;
}) {
	return JSON.stringify({
		id: args.eventId,
		object: 'event',
		type: args.eventType,
		createdAt: new Date().toISOString(),
		workspace: { id: args.workspace._id, slug: args.workspace.slug },
		data: args.data
	});
}

// ---------------------------------------------------------------------------------------------
// Owner-facing queries and mutations
// ---------------------------------------------------------------------------------------------

export const listWebhookEndpoints = query({
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({ canManage: v.boolean(), endpoints: v.array(endpointSummary) }),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceMember(ctx, args.workspaceId);
		if (membership.role !== 'owner') return { canManage: false, endpoints: [] };

		const endpoints = await ctx.db
			.query('webhook_endpoints')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(MAX_ENDPOINTS_PER_WORKSPACE);
		return { canManage: true, endpoints: endpoints.map(toEndpointSummary) };
	}
});

export const listWebhookDeliveries = query({
	args: { workspaceId: v.id('workspaces'), endpointId: v.id('webhook_endpoints') },
	returns: v.array(deliverySummary),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'view webhook deliveries');
		const endpoint = await ctx.db.get(args.endpointId);
		if (!endpoint || endpoint.workspaceId !== args.workspaceId) return [];

		const deliveries = await ctx.db
			.query('webhook_deliveries')
			.withIndex('by_endpointId_and_createdAt', (q) => q.eq('endpointId', args.endpointId))
			.order('desc')
			.take(RECENT_DELIVERIES_LIMIT);
		return deliveries.map((delivery) => ({
			deliveryId: delivery._id,
			eventId: delivery.eventId,
			eventType: delivery.eventType,
			status: delivery.status,
			attempts: delivery.attempts,
			nextAttemptAt: delivery.status === 'pending' ? (delivery.nextAttemptAt ?? null) : null,
			lastAttemptAt: delivery.lastAttemptAt ?? null,
			lastResponseStatus: delivery.lastResponseStatus ?? null,
			lastError: delivery.lastError ?? null,
			createdAt: delivery.createdAt
		}));
	}
});

// Secrets are generated in actions so they come from an unseeded random source, then the
// owner check and insert happen in a single internal mutation that sees the caller's auth.
export const createWebhookEndpoint = action({
	args: {
		workspaceId: v.id('workspaces'),
		url: v.string(),
		description: v.optional(v.string()),
		eventTypes: v.array(webhookEventTypeValidator)
	},
	returns: v.object({ endpointId: v.id('webhook_endpoints'), signingSecret: v.string() }),
	handler: async (
		ctx,
		args
	): Promise<{ endpointId: Id<'webhook_endpoints'>; signingSecret: string }> => {
		const url = requireValidUrl(args.url);
		const host = await checkWebhookHostResolvesPublic(new URL(url).hostname);
		if (!host.ok) throw new ConvexError({ code: 'invalid_argument', message: host.message });
		const signingSecret = randomToken(WEBHOOK_SIGNING_SECRET_PREFIX);
		const endpointId: Id<'webhook_endpoints'> = await ctx.runMutation(
			internal.webhooks.insertWebhookEndpoint,
			{
				workspaceId: args.workspaceId,
				url,
				description: args.description,
				eventTypes: args.eventTypes,
				encryptedSigningSecret: await encryptPurposeSecret(SECRET_PURPOSE, signingSecret),
				signingSecretHint: secretHint(signingSecret)
			}
		);
		return { endpointId, signingSecret };
	}
});

export const insertWebhookEndpoint = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		url: v.string(),
		description: v.optional(v.string()),
		eventTypes: v.array(webhookEventTypeValidator),
		encryptedSigningSecret: v.string(),
		signingSecretHint: v.string()
	},
	returns: v.id('webhook_endpoints'),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceOwner(ctx, args.workspaceId, 'manage webhooks');
		const existing = await ctx.db
			.query('webhook_endpoints')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(MAX_ENDPOINTS_PER_WORKSPACE);
		if (existing.length >= MAX_ENDPOINTS_PER_WORKSPACE) {
			throw new ConvexError({
				code: 'limit_reached',
				message: `A workspace can have up to ${MAX_ENDPOINTS_PER_WORKSPACE} webhook endpoints.`
			});
		}

		const now = Date.now();
		const description = normalizeDescription(args.description);
		return await ctx.db.insert('webhook_endpoints', {
			workspaceId: args.workspaceId,
			url: requireValidUrl(args.url),
			...(description ? { description } : {}),
			eventTypes: normalizeEventTypes(args.eventTypes),
			encryptedSigningSecret: args.encryptedSigningSecret,
			signingSecretHint: args.signingSecretHint,
			status: 'active',
			consecutiveFailures: 0,
			createdByUserId: user._id,
			createdAt: now,
			updatedAt: now
		});
	}
});

export const rollWebhookSigningSecret = action({
	args: { workspaceId: v.id('workspaces'), endpointId: v.id('webhook_endpoints') },
	returns: v.object({ signingSecret: v.string() }),
	handler: async (ctx, args): Promise<{ signingSecret: string }> => {
		const signingSecret = randomToken(WEBHOOK_SIGNING_SECRET_PREFIX);
		await ctx.runMutation(internal.webhooks.replaceWebhookSigningSecret, {
			workspaceId: args.workspaceId,
			endpointId: args.endpointId,
			encryptedSigningSecret: await encryptPurposeSecret(SECRET_PURPOSE, signingSecret),
			signingSecretHint: secretHint(signingSecret)
		});
		return { signingSecret };
	}
});

export const replaceWebhookSigningSecret = internalMutation({
	args: {
		workspaceId: v.id('workspaces'),
		endpointId: v.id('webhook_endpoints'),
		encryptedSigningSecret: v.string(),
		signingSecretHint: v.string()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'manage webhooks');
		await requireOwnedEndpoint(ctx, args.workspaceId, args.endpointId);
		await ctx.db.patch(args.endpointId, {
			encryptedSigningSecret: args.encryptedSigningSecret,
			signingSecretHint: args.signingSecretHint,
			updatedAt: Date.now()
		});
		return null;
	}
});

export const updateWebhookEndpoint = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		endpointId: v.id('webhook_endpoints'),
		url: v.optional(v.string()),
		description: v.optional(v.string()),
		eventTypes: v.optional(v.array(webhookEventTypeValidator)),
		status: v.optional(webhookEndpointStatusValidator)
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'manage webhooks');
		const endpoint = await requireOwnedEndpoint(ctx, args.workspaceId, args.endpointId);
		const patch: Partial<Doc<'webhook_endpoints'>> = { updatedAt: Date.now() };
		if (args.url !== undefined) patch.url = requireValidUrl(args.url);
		if (args.description !== undefined) patch.description = normalizeDescription(args.description);
		if (args.eventTypes !== undefined) patch.eventTypes = normalizeEventTypes(args.eventTypes);
		if (args.status !== undefined && args.status !== endpoint.status) {
			patch.status = args.status;
			if (args.status === 'active') {
				patch.consecutiveFailures = 0;
				patch.disabledReason = undefined;
			} else {
				patch.disabledReason = 'Disabled by a workspace owner.';
			}
		}
		await ctx.db.patch(args.endpointId, patch);
		return null;
	}
});

export const deleteWebhookEndpoint = mutation({
	args: { workspaceId: v.id('workspaces'), endpointId: v.id('webhook_endpoints') },
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'manage webhooks');
		await requireOwnedEndpoint(ctx, args.workspaceId, args.endpointId);
		await ctx.db.delete(args.endpointId);
		await ctx.scheduler.runAfter(0, internal.webhooks.deleteEndpointDeliveries, {
			endpointId: args.endpointId
		});
		return null;
	}
});

export const sendTestWebhook = mutation({
	args: { workspaceId: v.id('workspaces'), endpointId: v.id('webhook_endpoints') },
	returns: v.id('webhook_deliveries'),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'manage webhooks');
		const endpoint = await requireOwnedEndpoint(ctx, args.workspaceId, args.endpointId);
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}
		const eventId = `evt_test_${Date.now().toString(36)}`;
		return await enqueueDelivery(ctx, {
			endpoint,
			eventId,
			eventType: 'webhook.test',
			payload: eventEnvelope({
				eventId,
				eventType: 'webhook.test',
				workspace,
				data: { message: 'This is a test event from Waiver Director.' }
			})
		});
	}
});

export const redeliverWebhook = mutation({
	args: { workspaceId: v.id('workspaces'), deliveryId: v.id('webhook_deliveries') },
	returns: v.id('webhook_deliveries'),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'manage webhooks');
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery || delivery.workspaceId !== args.workspaceId) {
			throw new ConvexError({ code: 'not_found', message: 'Webhook delivery not found.' });
		}
		const endpoint = await requireOwnedEndpoint(ctx, args.workspaceId, delivery.endpointId);
		if (endpoint.status !== 'active') {
			throw new ConvexError({
				code: 'invalid_state',
				message: 'Enable this endpoint before resending events.'
			});
		}
		// Same event id, so receivers can de-duplicate a resend of an event they already handled.
		return await enqueueDelivery(ctx, {
			endpoint,
			eventId: delivery.eventId,
			eventType: delivery.eventType,
			payload: delivery.payload
		});
	}
});

// ---------------------------------------------------------------------------------------------
// Event fan-out and delivery
// ---------------------------------------------------------------------------------------------

export const enqueueSubmissionCreated = internalMutation({
	args: { submissionId: v.id('waiver_submissions') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const submission = await ctx.db.get(args.submissionId);
		if (!submission) return null;

		const endpoints = (
			await ctx.db
				.query('webhook_endpoints')
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', submission.workspaceId))
				.take(MAX_ENDPOINTS_PER_WORKSPACE)
		).filter(
			(endpoint) =>
				endpoint.status === 'active' && endpoint.eventTypes.includes('submission.created')
		);
		if (endpoints.length === 0) return null;

		const [workspace, version] = await Promise.all([
			ctx.db.get(submission.workspaceId),
			ctx.db.get(submission.versionId)
		]);
		if (!workspace || workspace.status !== 'active') return null;

		const eventId = `evt_submission_created_${submission._id}`;
		const payload = eventEnvelope({
			eventId,
			eventType: 'submission.created',
			workspace,
			data: serializeSubmission(submission, version)
		});
		for (const endpoint of endpoints) {
			await enqueueDelivery(ctx, {
				endpoint,
				eventId,
				eventType: 'submission.created',
				payload
			});
		}
		return null;
	}
});

export const getDeliveryForAttempt = internalQuery({
	args: { deliveryId: v.id('webhook_deliveries') },
	returns: v.union(
		v.object({ kind: v.literal('skip') }),
		v.object({ kind: v.literal('cancel'), reason: v.string() }),
		v.object({
			kind: v.literal('send'),
			url: v.string(),
			encryptedSigningSecret: v.string(),
			eventType: webhookDeliveryEventTypeValidator,
			payload: v.string()
		})
	),
	handler: async (ctx, args) => {
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery || delivery.status !== 'pending') return { kind: 'skip' as const };

		const endpoint = await ctx.db.get(delivery.endpointId);
		if (!endpoint || endpoint.workspaceId !== delivery.workspaceId) {
			return { kind: 'cancel' as const, reason: 'Endpoint was deleted.' };
		}
		if (endpoint.status !== 'active') {
			return { kind: 'cancel' as const, reason: 'Endpoint is disabled.' };
		}
		const workspace = await ctx.db.get(delivery.workspaceId);
		if (!workspace || workspace.status !== 'active') {
			return { kind: 'cancel' as const, reason: 'Workspace is no longer active.' };
		}
		return {
			kind: 'send' as const,
			url: endpoint.url,
			encryptedSigningSecret: endpoint.encryptedSigningSecret,
			eventType: delivery.eventType,
			payload: delivery.payload
		};
	}
});

class BlockedEndpointError extends Error {}

function truncateError(message: string) {
	return message.length > ERROR_MESSAGE_MAX_LENGTH
		? `${message.slice(0, ERROR_MESSAGE_MAX_LENGTH - 1)}…`
		: message;
}

export const deliverWebhook = internalAction({
	args: { deliveryId: v.id('webhook_deliveries') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const target = await ctx.runQuery(internal.webhooks.getDeliveryForAttempt, args);
		if (target.kind === 'skip') return null;
		if (target.kind === 'cancel') {
			await ctx.runMutation(internal.webhooks.recordDeliveryAttempt, {
				deliveryId: args.deliveryId,
				outcome: 'canceled',
				error: target.reason
			});
			return null;
		}

		let responseStatus: number | undefined;
		let error: string | undefined;
		try {
			// Re-check at send time in case validation rules tightened after the endpoint was saved.
			const url = normalizeWebhookUrl(target.url);
			if (!url.ok) throw new BlockedEndpointError(url.message);
			const host = await checkWebhookHostResolvesPublic(new URL(url.url).hostname);
			if (!host.ok) throw new BlockedEndpointError(host.message);

			const secret = await decryptPurposeSecret(SECRET_PURPOSE, target.encryptedSigningSecret);
			const timestamp = Math.floor(Date.now() / 1000);
			const signature = await signWebhookPayload({ secret, timestamp, body: target.payload });
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
			try {
				const response = await fetch(url.url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'User-Agent': 'WaiverDirector-Webhooks/1.0',
						[WEBHOOK_SIGNATURE_HEADER]: webhookSignatureHeaderValue(timestamp, signature),
						[WEBHOOK_EVENT_HEADER]: target.eventType,
						[WEBHOOK_DELIVERY_HEADER]: args.deliveryId
					},
					body: target.payload,
					redirect: 'manual',
					signal: controller.signal
				});
				responseStatus = response.status;
				await response.body?.cancel().catch(() => undefined);
				if (response.status < 200 || response.status >= 300) {
					error =
						response.status >= 300 && response.status < 400
							? `Endpoint responded with a redirect (${response.status}). Redirects are not followed.`
							: `Endpoint responded with HTTP ${response.status}.`;
				}
			} finally {
				clearTimeout(timeout);
			}
		} catch (caught) {
			// Keep network error detail out of the owner-visible log: only our own messages surface.
			error =
				caught instanceof BlockedEndpointError
					? caught.message
					: caught instanceof Error && caught.name === 'AbortError'
						? `Endpoint did not respond within ${DELIVERY_TIMEOUT_MS / 1000} seconds.`
						: 'Could not connect to the endpoint.';
		}

		await ctx.runMutation(internal.webhooks.recordDeliveryAttempt, {
			deliveryId: args.deliveryId,
			outcome: error ? 'failed' : 'succeeded',
			...(responseStatus !== undefined ? { responseStatus } : {}),
			...(error ? { error: truncateError(error) } : {})
		});
		return null;
	}
});

export const recordDeliveryAttempt = internalMutation({
	args: {
		deliveryId: v.id('webhook_deliveries'),
		outcome: v.union(v.literal('succeeded'), v.literal('failed'), v.literal('canceled')),
		responseStatus: v.optional(v.number()),
		error: v.optional(v.string())
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery || delivery.status !== 'pending') return null;
		const now = Date.now();

		if (args.outcome === 'canceled') {
			await ctx.db.patch(delivery._id, {
				status: 'canceled',
				nextAttemptAt: undefined,
				lastError: args.error,
				updatedAt: now
			});
			return null;
		}

		const attempts = delivery.attempts + 1;
		const endpoint = await ctx.db.get(delivery.endpointId);
		const isTest = delivery.eventType === 'webhook.test';
		const attemptFields = {
			attempts,
			lastAttemptAt: now,
			lastResponseStatus: args.responseStatus,
			lastError: args.error,
			updatedAt: now
		};

		if (args.outcome === 'succeeded') {
			await ctx.db.patch(delivery._id, {
				...attemptFields,
				status: 'succeeded',
				nextAttemptAt: undefined
			});
			if (endpoint) {
				await ctx.db.patch(endpoint._id, {
					consecutiveFailures: 0,
					lastDeliveryAt: now,
					lastDeliveryOk: true
				});
			}
			return null;
		}

		const retryDelay = isTest ? null : webhookRetryDelayMs(attempts);
		if (retryDelay !== null && endpoint?.status === 'active') {
			await ctx.db.patch(delivery._id, {
				...attemptFields,
				status: 'pending',
				nextAttemptAt: now + retryDelay
			});
			await ctx.scheduler.runAfter(retryDelay, internal.webhooks.deliverWebhook, {
				deliveryId: delivery._id
			});
		} else {
			await ctx.db.patch(delivery._id, {
				...attemptFields,
				status: 'failed',
				nextAttemptAt: undefined
			});
		}

		if (endpoint) {
			const reachedFinalFailure = retryDelay === null && !isTest;
			const consecutiveFailures = endpoint.consecutiveFailures + (reachedFinalFailure ? 1 : 0);
			const shouldDisable =
				endpoint.status === 'active' && consecutiveFailures >= AUTO_DISABLE_AFTER_FAILURES;
			await ctx.db.patch(endpoint._id, {
				consecutiveFailures,
				lastDeliveryAt: now,
				lastDeliveryOk: false,
				...(shouldDisable
					? {
							status: 'disabled' as const,
							disabledReason: `Disabled automatically after ${AUTO_DISABLE_AFTER_FAILURES} events failed in a row.`,
							updatedAt: now
						}
					: {})
			});
		}
		return null;
	}
});

// ---------------------------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------------------------

export const deleteEndpointDeliveries = internalMutation({
	args: { endpointId: v.id('webhook_endpoints') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const deliveries = await ctx.db
			.query('webhook_deliveries')
			.withIndex('by_endpointId_and_createdAt', (q) => q.eq('endpointId', args.endpointId))
			.take(DELIVERY_CLEANUP_BATCH);
		for (const delivery of deliveries) {
			await ctx.db.delete(delivery._id);
		}
		if (deliveries.length === DELIVERY_CLEANUP_BATCH) {
			await ctx.scheduler.runAfter(0, internal.webhooks.deleteEndpointDeliveries, args);
		}
		return null;
	}
});

export const pruneOldWebhookDeliveriesCron = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const cutoff = Date.now() - DELIVERY_RETENTION_MS;
		const deliveries = await ctx.db
			.query('webhook_deliveries')
			.withIndex('by_createdAt', (q) => q.lt('createdAt', cutoff))
			.take(DELIVERY_CLEANUP_BATCH);
		for (const delivery of deliveries) {
			await ctx.db.delete(delivery._id);
		}
		if (deliveries.length === DELIVERY_CLEANUP_BATCH) {
			await ctx.scheduler.runAfter(0, internal.webhooks.pruneOldWebhookDeliveriesCron, {});
		}
		return null;
	}
});
