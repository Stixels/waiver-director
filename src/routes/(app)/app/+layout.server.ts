import { redirect } from '@sveltejs/kit';
import { api } from '../../../convex/_generated/api';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const auth = locals.auth();
	const { userId } = auth;

	if (!userId) {
		const next = `${url.pathname}${url.search}`;
		throw redirect(303, `/sign-in?redirectTo=${encodeURIComponent(next)}`);
	}

	let currentUser = await locals.convex.query(api.users.currentUser, {});

	if (!currentUser) {
		await locals.convex.mutation(api.users.ensureCurrentUser, {});
		currentUser = await locals.convex.query(api.users.currentUser, {});
	}

	return {
		currentUser
	};
};
