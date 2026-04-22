import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const http = httpRouter();

http.route({
	path: '/bookeo/callback',
	method: 'GET',
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const success = url.searchParams.get('success') === 'true';
		const state = url.searchParams.get('state') ?? '';
		const apiKey = url.searchParams.get('apiKey') ?? undefined;

		const result: { redirectUrl: string } = await ctx.runAction(
			internal.integrations.completeBookeoCallback,
			{
				success,
				state,
				...(apiKey ? { apiKey } : {})
			}
		);

		return Response.redirect(result.redirectUrl, 303);
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

		const result: { status: 'accepted' | 'duplicate' | 'rejected' } = await ctx.runAction(
			internal.integrations.verifyAndRecordBookeoWebhook,
			{
				integrationId,
				eventType,
				url: request.url,
				body,
				timestamp,
				messageId,
				signature,
				previousMessageLost
			}
		);

		if (result.status === 'rejected') {
			return new Response('Rejected', { status: 401 });
		}

		return new Response(result.status, { status: 202 });
	})
});

export default http;
