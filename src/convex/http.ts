import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { ActionCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { looksLikeApiKey, parseBearerToken, parsePageLimit, sha256Hex } from './lib/webhooks';

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

// ---------------------------------------------------------------------------------------------
// Public read API (v1). Authenticated with a workspace API key: `Authorization: Bearer wd_live_…`.
// ---------------------------------------------------------------------------------------------

const API_JSON_HEADERS = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store'
};

function apiJson(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: API_JSON_HEADERS });
}

function apiError(status: number, code: string, message: string) {
	return apiJson({ error: { code, message } }, status);
}

async function authenticateApiRequest(
	ctx: ActionCtx,
	request: Request
): Promise<{ workspaceId: Id<'workspaces'> } | Response> {
	const token = parseBearerToken(request.headers.get('Authorization'));
	if (!token || !looksLikeApiKey(token)) {
		return apiError(401, 'unauthenticated', 'Provide an API key as a Bearer token.');
	}
	const result = await ctx.runMutation(internal.apiKeys.authenticateApiRequest, {
		keyHash: await sha256Hex(token)
	});
	if (result.kind === 'unauthenticated') {
		return apiError(401, 'unauthenticated', 'This API key is invalid or has been revoked.');
	}
	if (result.kind === 'rate_limited') {
		const response = apiError(
			429,
			'rate_limited',
			`Too many requests. Try again in ${result.retryAfterSeconds} seconds.`
		);
		response.headers.set('Retry-After', String(result.retryAfterSeconds));
		return response;
	}
	return { workspaceId: result.workspaceId };
}

function parsePageArgs(request: Request): { numItems: number; cursor: string | null } | Response {
	const url = new URL(request.url);
	const numItems = parsePageLimit(url.searchParams.get('limit'));
	if (numItems === null) {
		return apiError(400, 'invalid_argument', 'limit must be a whole number from 1 to 100.');
	}
	return { numItems, cursor: url.searchParams.get('cursor') || null };
}

function apiHandler(
	handler: (ctx: ActionCtx, request: Request, workspaceId: Id<'workspaces'>) => Promise<Response>
) {
	return httpAction(async (ctx, request) => {
		const auth = await authenticateApiRequest(ctx, request);
		if (auth instanceof Response) return auth;
		try {
			return await handler(ctx, request, auth.workspaceId);
		} catch (error) {
			if (error instanceof Error && /cursor/i.test(error.message)) {
				return apiError(400, 'invalid_argument', 'cursor is invalid or has expired.');
			}
			console.error('[api/v1] unexpected error', error);
			return apiError(500, 'internal_error', 'Something went wrong.');
		}
	});
}

http.route({
	path: '/api/v1/workspace',
	method: 'GET',
	handler: apiHandler(async (ctx, _request, workspaceId) => {
		const workspace: unknown = await ctx.runQuery(internal.publicApi.getWorkspace, { workspaceId });
		if (!workspace) return apiError(404, 'not_found', 'Workspace not found.');
		return apiJson({ data: workspace });
	})
});

http.route({
	path: '/api/v1/submissions',
	method: 'GET',
	handler: apiHandler(async (ctx, request, workspaceId) => {
		const page = parsePageArgs(request);
		if (page instanceof Response) return page;
		const result: unknown = await ctx.runQuery(internal.publicApi.listSubmissions, {
			workspaceId,
			...page
		});
		return apiJson(result);
	})
});

http.route({
	pathPrefix: '/api/v1/submissions/',
	method: 'GET',
	handler: apiHandler(async (ctx, request, workspaceId) => {
		const submissionId = decodeURIComponent(
			new URL(request.url).pathname.slice('/api/v1/submissions/'.length)
		);
		if (!submissionId || submissionId.includes('/')) {
			return apiError(404, 'not_found', 'Submission not found.');
		}
		const submission: unknown = await ctx.runQuery(internal.publicApi.getSubmission, {
			workspaceId,
			submissionId
		});
		if (!submission) return apiError(404, 'not_found', 'Submission not found.');
		return apiJson({ data: submission });
	})
});

http.route({
	path: '/api/v1/customers',
	method: 'GET',
	handler: apiHandler(async (ctx, request, workspaceId) => {
		const page = parsePageArgs(request);
		if (page instanceof Response) return page;
		const result: unknown = await ctx.runQuery(internal.publicApi.listCustomers, {
			workspaceId,
			...page
		});
		return apiJson(result);
	})
});

export default http;
