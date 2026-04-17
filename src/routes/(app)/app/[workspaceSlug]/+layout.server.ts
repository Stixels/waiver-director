import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, parent }) => {
	const { workspaces } = await parent();
	const currentWorkspace = workspaces.find((workspace) => workspace.slug === params.workspaceSlug);

	if (!currentWorkspace) {
		throw error(404, 'Workspace not found.');
	}

	return {
		currentWorkspace
	};
};
