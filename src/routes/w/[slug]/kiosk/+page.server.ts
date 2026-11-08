import { error } from '@sveltejs/kit';
import { api } from '$convex/_generated/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const waiver = await locals.convex.query(api.waivers.getPublicWaiverBySlug, {
		slug: params.slug
	});

	if (!waiver) {
		throw error(404, 'Kiosk not found.');
	}

	// A kiosk is a shared device; never let a cached page carry one guest's state to the next.
	setHeaders({ 'cache-control': 'no-store' });

	return { waiver };
};
