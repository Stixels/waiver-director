import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
	PHOTO_UPLOAD_MAX_BYTES,
	clientAddressFromForwardedFor,
	photoUploadRequestError
} from './lib/photoCapture';

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

// Public signers upload photos here. The endpoint checks the declared type and
// size before reading the body, stores the file itself, and records it against a
// reservation, so no raw storage upload URL is ever handed to a browser.
const PHOTO_UPLOAD_CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
	Vary: 'Origin'
};

function photoUploadJson(body: Record<string, unknown>, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...PHOTO_UPLOAD_CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}

async function hashClientKey(address: string | null) {
	if (!address) return 'unknown';
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
	return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
}

http.route({
	path: '/photo-uploads',
	method: 'OPTIONS',
	handler: httpAction(
		async () => new Response(null, { status: 204, headers: PHOTO_UPLOAD_CORS_HEADERS })
	)
});

http.route({
	path: '/photo-uploads',
	method: 'POST',
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const slug = url.searchParams.get('slug') ?? '';
		const kind = url.searchParams.get('kind');
		if (!slug || (kind !== 'participant' && kind !== 'id')) {
			return photoUploadJson({ message: 'Bad request.' }, 400);
		}

		const contentType = request.headers.get('Content-Type');
		const lengthHeader = request.headers.get('Content-Length');
		const declaredLength = lengthHeader === null ? null : Number(lengthHeader);
		if (declaredLength !== null && !Number.isFinite(declaredLength)) {
			return photoUploadJson({ message: 'Bad request.' }, 400);
		}
		// Reject oversized or wrong-type uploads before reading the body.
		const requestError = photoUploadRequestError(contentType, declaredLength);
		if (requestError) {
			const tooLarge = declaredLength !== null && declaredLength > PHOTO_UPLOAD_MAX_BYTES;
			return photoUploadJson({ message: requestError }, tooLarge ? 413 : 415);
		}

		const clientKey = await hashClientKey(
			clientAddressFromForwardedFor(request.headers.get('X-Forwarded-For'))
		);
		const reservation = await ctx.runMutation(internal.photoUploads.reservePublicPhotoUpload, {
			slug,
			kind,
			clientKey
		});
		if (!reservation.ok) {
			return photoUploadJson({ message: reservation.message }, reservation.status);
		}

		let storageId: Id<'_storage'>;
		try {
			const body = await request.blob();
			// Content-Length is only a claim; check the bytes actually received.
			if (body.size > PHOTO_UPLOAD_MAX_BYTES || body.size === 0) {
				await ctx.runMutation(internal.photoUploads.cancelPublicPhotoUpload, {
					uploadId: reservation.uploadId
				});
				return photoUploadJson(
					{ message: photoUploadRequestError(contentType, body.size) ?? 'Invalid photo.' },
					413
				);
			}
			storageId = await ctx.storage.store(
				new Blob([body], { type: contentType?.split(';')[0]?.trim() || 'image/jpeg' })
			);
		} catch (error) {
			console.error('[photo-uploads] failed to store photo', error);
			await ctx.runMutation(internal.photoUploads.cancelPublicPhotoUpload, {
				uploadId: reservation.uploadId
			});
			return photoUploadJson({ message: 'Photo upload failed. Please try again.' }, 500);
		}

		const completed = await ctx.runMutation(internal.photoUploads.completePublicPhotoUpload, {
			uploadId: reservation.uploadId,
			storageId
		});
		if (!completed.ok) {
			return photoUploadJson({ message: completed.message }, 400);
		}
		return photoUploadJson({ uploadToken: reservation.uploadToken }, 200);
	})
});

// Workspace members view submission photos through short-lived links issued by
// `photoUploads.issueSubmissionPhotoViewUrls`. Each request re-checks the link
// and the member's access; photos are never served from public storage URLs.
http.route({
	path: '/submission-photos',
	method: 'GET',
	handler: httpAction(async (ctx, request) => {
		const token = new URL(request.url).searchParams.get('token') ?? '';
		const notFound = () =>
			new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
		if (!token) return notFound();

		const storageId = await ctx.runQuery(internal.photoUploads.resolveSubmissionPhotoViewToken, {
			token
		});
		if (!storageId) return notFound();
		const blob = await ctx.storage.get(storageId);
		if (!blob) return notFound();

		return new Response(blob, {
			status: 200,
			headers: {
				'Content-Type': blob.type || 'application/octet-stream',
				'Cache-Control': 'private, no-store',
				'Referrer-Policy': 'no-referrer',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	})
});

export default http;
