// import { dev } from '$app/environment';
// $app/environment is a SvelteKit-provided module that gives you information about the current runtime environment
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';
import { publicEnv } from '$lib/config/public';
import { withClerkHandler } from 'svelte-clerk/server';

function isMissingClerkSessionError(error: unknown) {
	if (!error || typeof error !== 'object') return false;
	const maybeError = error as { clerkError?: unknown; status?: unknown };
	return maybeError.clerkError === true && maybeError.status === 404;
}

async function fetchConvexToken(event: RequestEvent): Promise<App.ConvexTokenState> {
	const auth = event.locals.auth();
	if (!auth.userId) {
		return { token: null, sessionUnavailable: false };
	}

	try {
		const token = await auth.getToken({ template: 'convex' });
		return { token, sessionUnavailable: false };
	} catch (error) {
		if (!isMissingClerkSessionError(error)) {
			throw error;
		}

		console.warn('[auth/server] Ignoring stale Clerk session while fetching Convex token.', {
			pathname: event.url.pathname,
			userId: auth.userId,
			sessionId: auth.sessionId
		});
		return { token: null, sessionUnavailable: true };
	}
}

// This handler will authenticate requests and gives you access to the Auth object inside your server loaders and actions.
// Auth object examples: https://clerk.com/docs/reference/backend/types/auth-object#auth-object
// Example you can call debug: dev to see the Auth object in the console for debugging purposes.
// The Convex token is fetched lazily so pages that don't need it never call Clerk.
const setupConvexClient: Handle = async ({ event, resolve }) => {
	let tokenState: Promise<App.ConvexTokenState> | undefined;

	event.locals.convex = new ConvexHttpClient(publicEnv.convexUrl);
	event.locals.getConvexToken = () => (tokenState ??= fetchConvexToken(event));
	event.locals.getAuthenticatedConvex = async () => {
		const { token } = await event.locals.getConvexToken();
		const client = new ConvexHttpClient(publicEnv.convexUrl);
		if (token) {
			client.setAuth(token);
		}
		return client;
	};

	return resolve(event);
};

export const handle = sequence(withClerkHandler(), setupConvexClient);
