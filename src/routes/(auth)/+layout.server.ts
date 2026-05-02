import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { userId } = locals.auth();

	if (userId) {
		throw redirect(303, '/app');
	}

	return {};
};
