import { error } from '@sveltejs/kit';
import { api } from '$convex/_generated/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const waiver = await locals.convex.query(api.waivers.getPublicWaiverForBooking, {
		slug: params.slug,
		lookupToken: params.token
	});

	if (!waiver) {
		throw error(404, 'Booking waiver not found.');
	}

	return { waiver };
};
