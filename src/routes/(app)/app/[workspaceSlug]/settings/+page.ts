import { redirect } from '@sveltejs/kit';

export const load = ({ params }) => {
	throw redirect(307, `/app/${params.workspaceSlug}/settings/general`);
};
