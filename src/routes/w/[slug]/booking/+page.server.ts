import { error } from '@sveltejs/kit';
import { api } from '$convex/_generated/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const waiver = await locals.convex.query(api.waivers.getPublicWaiverBySlug, {
		slug: params.slug
	});

	if (!waiver) {
		throw error(404, 'Public waiver not found.');
	}

	return { waiver };
};
