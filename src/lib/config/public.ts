import { PUBLIC_APP_URL, PUBLIC_CONVEX_SITE_URL, PUBLIC_CONVEX_URL } from '$env/static/public';

export const publicEnv = {
	appUrl: PUBLIC_APP_URL,
	convexUrl: PUBLIC_CONVEX_URL,
	convexSiteUrl: PUBLIC_CONVEX_SITE_URL
} as const;
