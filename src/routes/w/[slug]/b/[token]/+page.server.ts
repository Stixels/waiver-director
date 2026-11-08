import { error, redirect } from '@sveltejs/kit';
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

	// Booking links are shared with the default waiver's slug. When the
	// booking's activity requires different waivers, send guests to the first
	// one instead of a waiver this booking does not need.
	if (waiver.requiredWaivers.length > 0 && !waiver.requiredWaivers.some((item) => item.isCurrent)) {
		const [firstRequired] = waiver.requiredWaivers;
		throw redirect(
			307,
			`/w/${encodeURIComponent(firstRequired.slug)}/b/${encodeURIComponent(params.token)}`
		);
	}

	return { waiver };
};
