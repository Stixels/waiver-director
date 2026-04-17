import { redirect } from '@sveltejs/kit';
import { loadCurrentAppContext } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const auth = locals.auth();
	const { userId } = auth;

	if (!userId) {
		const next = `${url.pathname}${url.search}`;
		throw redirect(303, `/sign-in?redirectTo=${encodeURIComponent(next)}`);
	}

	const { currentUser, workspaces } = await loadCurrentAppContext(locals);
	let convexToken: string | null = null;

	if (!currentUser) {
		throw new Error('Authenticated Clerk session is missing a corresponding Convex user.');
	}

	try {
		convexToken = await auth.getToken({ template: 'convex' });
	} catch (error) {
		console.warn('[auth] Failed to fetch Convex token during SSR', error);
	}

	if (workspaces.length === 0 && url.pathname !== '/app/workspaces/new') {
		throw redirect(303, '/app/workspaces/new');
	}

	return {
		currentUser,
		workspaces,
		convexToken
	};
};
