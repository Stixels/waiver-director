import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { workspaces } = await parent();

	if (workspaces.length > 0) {
		throw redirect(303, `/app/${workspaces[0].slug}`);
	}

	return {};
};
