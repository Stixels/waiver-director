import { redirect } from '@sveltejs/kit';
import { getSignedInAppRedirectPath } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { userId } = locals.auth();

	if (!userId) {
		const next = `${url.pathname}${url.search}`;
		throw redirect(303, `/sign-in?redirectTo=${encodeURIComponent(next)}`);
	}

	throw redirect(303, await getSignedInAppRedirectPath(locals));
};
