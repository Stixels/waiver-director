import { httpRouter } from 'convex/server';
import type { FunctionArgs } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ConvexError } from 'convex/values';
import { clientIpFromHeaders, normalizeForwardedFor, normalizeUserAgent } from './lib/audit';

const http = httpRouter();

function callbackErrorRedirectUrl(request: Request) {
	return new URL('/app?bookeo=callback-error', request.url).toString();
}

http.route({
	path: '/bookeo/callback',
	method: 'GET',
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const success = url.searchParams.get('success') === 'true';
		const state = url.searchParams.get('state') ?? '';
		const apiKey = url.searchParams.get('apiKey') ?? undefined;

		let result: { redirectUrl: string };
		try {
			result = await ctx.runAction(internal.integrations.completeBookeoCallback, {
				success,
				state,
				...(apiKey ? { apiKey } : {})
			});
		} catch (error) {
			console.error('[bookeo/callback] unable to complete callback', {
				error,
				state,
				hasApiKey: Boolean(apiKey)
			});
			return Response.redirect(callbackErrorRedirectUrl(request), 303);
		}

		return Response.redirect(result.redirectUrl, 303);
	})
});

http.route({
	path: '/mailchimp/callback',
	method: 'GET',
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const state = url.searchParams.get('state') ?? '';
		const code = url.searchParams.get('code') ?? undefined;
		const error = url.searchParams.get('error') ?? undefined;

		if (!state) return new Response('Bad request', { status: 400 });

		try {
			const result: { redirectUrl: string } = await ctx.runAction(
				internal.mailchimp.completeOAuthCallback,
				{
					state,
					...(code ? { code } : {}),
					...(error ? { error } : {})
				}
			);
			return Response.redirect(result.redirectUrl, 303);
		} catch (callbackError) {
			console.error('[mailchimp/callback] unable to complete callback', {
				error: callbackError,
				state
			});
			return Response.redirect(new URL('/app?mailchimp=callback-error', request.url), 303);
		}
	})
});

http.route({
	path: '/bookeo/webhook',
	method: 'POST',
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const integrationId = url.searchParams.get(
			'integrationId'
		) as Id<'booking_integrations'> | null;
		const eventType = url.searchParams.get('type') ?? 'unknown';
		const timestamp = request.headers.get('X-Bookeo-Timestamp') ?? '';
		const messageId = request.headers.get('X-Bookeo-MessageId') ?? '';
		const signature = request.headers.get('X-Bookeo-Signature') ?? '';
		const previousMessageLost = request.headers.get('X-Bookeo-PreviousMessageLost') === 'true';
		const body = await request.text();

		if (!integrationId || !timestamp || !messageId || !signature) {
			return new Response('Bad request', { status: 400 });
		}

		let result: { status: 'accepted' | 'duplicate' | 'rejected' };
		try {
			result = await ctx.runAction(internal.integrations.verifyAndRecordBookeoWebhook, {
				integrationId,
				eventType,
				url: request.url,
				body,
				timestamp,
				messageId,
				signature,
				previousMessageLost
			});
		} catch (error) {
			if (
				error instanceof Error &&
				(error.name === 'ArgumentValidationError' ||
					error.message.includes('ArgumentValidationError'))
			) {
				return new Response('Bad request', { status: 400 });
			}
			console.error('[bookeo/webhook] unexpected webhook error', error);
			return new Response('Internal server error', { status: 500 });
		}

		if (result.status === 'rejected') {
			return new Response('Rejected', { status: 401 });
		}

		return new Response(result.status, { status: 202 });
	})
});

http.route({
	path: '/clerk/billing/webhook',
	method: 'POST',
	handler: httpAction(async (ctx, request) => {
		const svixId = request.headers.get('svix-id') ?? '';
		const svixTimestamp = request.headers.get('svix-timestamp') ?? '';
		const svixSignature = request.headers.get('svix-signature') ?? '';
		const body = await request.text();

		if (!svixId || !svixTimestamp || !svixSignature) {
			return new Response('Bad request', { status: 400 });
		}

		let result: { status: 'accepted' | 'duplicate' | 'ignored' | 'rejected' };
		try {
			result = await ctx.runAction(internal.billing.verifyAndApplyClerkBillingWebhook, {
				body,
				svixId,
				svixTimestamp,
				svixSignature
			});
		} catch (error) {
			if (
				error instanceof Error &&
				(error.name === 'ArgumentValidationError' ||
					error.message.includes('ArgumentValidationError'))
			) {
				return new Response('Bad request', { status: 400 });
			}
			console.error('[clerk/billing/webhook] unexpected webhook error', error);
			return new Response('Internal server error', { status: 500 });
		}

		if (result.status === 'rejected') {
			return new Response('Rejected', { status: 401 });
		}

		return new Response(result.status, { status: 200 });
	})
});

// Public waiver signing. Runs as an HTTP action (not a client mutation) so the
// signer's IP address and user agent come from the request itself and are
// recorded in the submission's audit trail.
const PUBLIC_SUBMIT_CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
	Vary: 'Origin'
};

function publicSubmitJson(body: unknown, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...PUBLIC_SUBMIT_CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}

http.route({
	path: '/waivers/submit',
	method: 'OPTIONS',
	handler: httpAction(async () => {
		return new Response(null, { status: 204, headers: PUBLIC_SUBMIT_CORS_HEADERS });
	})
});

http.route({
	path: '/waivers/submit',
	method: 'POST',
	handler: httpAction(async (ctx, request) => {
		let payload: Record<string, unknown>;
		try {
			const parsed: unknown = await request.json();
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new Error('Expected a JSON object.');
			}
			payload = parsed as Record<string, unknown>;
		} catch {
			return publicSubmitJson(
				{ code: 'invalid_argument', message: 'Invalid waiver submission.' },
				400
			);
		}

		// Never let the client supply audit request metadata.
		delete payload.request;

		try {
			const result = await ctx.runMutation(internal.waivers.submitPublicWaiver, {
				// Shape is enforced by the mutation's argument validator.
				...(payload as Omit<FunctionArgs<typeof internal.waivers.submitPublicWaiver>, 'request'>),
				request: {
					ipAddress: clientIpFromHeaders(request.headers),
					forwardedFor: normalizeForwardedFor(request.headers.get('x-forwarded-for')),
					userAgent: normalizeUserAgent(request.headers.get('user-agent'))
				}
			});
			return publicSubmitJson(result, 200);
		} catch (error) {
			if (error instanceof ConvexError) {
				const data = error.data as { code?: unknown; message?: unknown } | string;
				const code =
					typeof data === 'object' && typeof data.code === 'string' ? data.code : 'error';
				const message =
					typeof data === 'object' && typeof data.message === 'string'
						? data.message
						: typeof data === 'string'
							? data
							: 'Unable to submit this waiver.';
				return publicSubmitJson({ code, message }, code === 'not_found' ? 404 : 400);
			}
			if (
				error instanceof Error &&
				(error.name === 'ArgumentValidationError' ||
					error.message.includes('ArgumentValidationError'))
			) {
				return publicSubmitJson(
					{ code: 'invalid_argument', message: 'Invalid waiver submission.' },
					400
				);
			}
			console.error('[waivers/submit] unexpected submission error', error);
			return publicSubmitJson(
				{ code: 'internal_error', message: 'Unable to submit this waiver.' },
				500
			);
		}
	})
});

export default http;
