import { redirect } from '@sveltejs/kit';
import { loadCurrentUserWorkspaces } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const workspaces = await loadCurrentUserWorkspaces(locals);

	if (workspaces.length > 0) {
		throw redirect(303, '/app');
	}

	return {};
};
