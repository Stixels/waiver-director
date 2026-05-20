import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { userId } = locals.auth();

	if (userId && !locals.clerkSessionUnavailable && url.pathname !== '/sso-callback') {
		throw redirect(303, '/app');
	}

	return {};
};
