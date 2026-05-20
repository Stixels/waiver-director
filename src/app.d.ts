// Add locals types
/// <reference types="svelte-clerk/env" />

import type { ConvexHttpClient } from 'convex/browser';

declare global {
	namespace App {
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
		interface Locals {
			convex: ConvexHttpClient;
			clerkSessionUnavailable: boolean;
		}
	}
}

export {};
