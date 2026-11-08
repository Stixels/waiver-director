import { redirect } from '@sveltejs/kit';
import { getSafePostAuthRedirectHref } from '$lib/auth/clerk-helpers';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { userId } = locals.auth();

	if (!userId || url.pathname === '/sso-callback') {
		return {};
	}

	// A stale session cookie or a Clerk outage should still let the user reach the auth pages.
	const tokenState = await locals.getConvexToken().catch((error) => {
		console.warn('[auth/server] Unable to confirm Clerk session for auth page.', error);
		return null;
	});

	if (tokenState && !tokenState.sessionUnavailable) {
		throw redirect(303, getSafePostAuthRedirectHref(url.searchParams.get('redirectTo')));
	}

	return {};
};
