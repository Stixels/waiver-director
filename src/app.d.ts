// Add locals types
/// <reference types="svelte-clerk/env" />

import type { ConvexHttpClient } from 'convex/browser';

declare global {
	namespace App {
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
		interface ConvexTokenState {
			token: string | null;
			/** Clerk still has a session cookie, but the session no longer exists. */
			sessionUnavailable: boolean;
		}
		interface Locals {
			/** Unauthenticated client for public Convex functions. */
			convex: ConvexHttpClient;
			/** Fetches the Convex token once per request; throws if Clerk fails for another reason. */
			getConvexToken: () => Promise<ConvexTokenState>;
			/** Client authenticated as the signed-in user, when there is one. */
			getAuthenticatedConvex: () => Promise<ConvexHttpClient>;
		}
	}
}

export {};
