import type { AuthConfig } from 'convex/server';

const clerkFrontendApiUrl = process.env.CLERK_FRONTEND_API_URL;

if (!clerkFrontendApiUrl) {
	throw new Error('Missing CLERK_FRONTEND_API_URL required for Convex Clerk authentication.');
}

export default {
	providers: [
		{
			domain: clerkFrontendApiUrl,
			applicationID: 'convex'
		}
	]
} satisfies AuthConfig;
