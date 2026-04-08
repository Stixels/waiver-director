import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { workspaces } = await parent();
	const firstWorkspaceSlug = workspaces[0]?.slug;

	if (!firstWorkspaceSlug) {
		throw redirect(303, '/app/workspaces/new');
	}

	throw redirect(303, `/app/${firstWorkspaceSlug}`);
};
