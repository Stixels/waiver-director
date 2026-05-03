// import { dev } from '$app/environment';
// $app/environment is a SvelteKit-provided module that gives you information about the current runtime environment
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';
import { publicEnv } from '$lib/config/public';
import { withClerkHandler } from 'svelte-clerk/server';

function isMissingClerkSessionError(error: unknown) {
	if (!error || typeof error !== 'object') return false;
	const maybeError = error as { clerkError?: unknown; status?: unknown };
	return maybeError.clerkError === true && maybeError.status === 404;
}

// This handler will authenticate requests and gives you access to the Auth object inside your server loaders and actions.
// Auth object examples: https://clerk.com/docs/reference/backend/types/auth-object#auth-object
// Example you can call debug: dev to see the Auth object in the console for debugging purposes.
const setupConvexClient: Handle = async ({ event, resolve }) => {
	const auth = event.locals.auth();
	const client = new ConvexHttpClient(publicEnv.convexUrl);
	event.locals.clerkSessionUnavailable = false;

	if (auth.userId) {
		let token: string | null = null;

		try {
			token = await auth.getToken({ template: 'convex' });
		} catch (error) {
			if (!isMissingClerkSessionError(error)) {
				throw error;
			}

			event.locals.clerkSessionUnavailable = true;
			console.warn('[auth/server] Ignoring stale Clerk session while fetching Convex token.', {
				pathname: event.url.pathname,
				userId: auth.userId,
				sessionId: auth.sessionId
			});
		}

		if (token) {
			client.setAuth(token);
		}
	}

	event.locals.convex = client;
	return resolve(event);
};

export const handle = sequence(withClerkHandler(), setupConvexClient);
