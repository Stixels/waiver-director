import { redirect } from '@sveltejs/kit';
import { loadCurrentUserWorkspaces, requireCurrentAppUser } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const auth = locals.auth();
	const { userId } = auth;

	if (!userId) {
		const next = `${url.pathname}${url.search}`;
		throw redirect(303, `/sign-in?redirectTo=${encodeURIComponent(next)}`);
	}

	const currentUser = await requireCurrentAppUser(locals);
	const workspaces = await loadCurrentUserWorkspaces(locals);

	if (workspaces.length === 0 && url.pathname !== '/app/workspaces/new') {
		throw redirect(303, '/app/workspaces/new');
	}

	return {
		currentUser,
		workspaces
	};
};
