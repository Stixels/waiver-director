import { api } from '../../convex/_generated/api';

export async function ensureCurrentAppUser(locals: App.Locals) {
	let currentUser = await locals.convex.query(api.users.currentUser, {});

	if (!currentUser) {
		const ensuredUser = await locals.convex.mutation(api.users.ensureCurrentUser, {});
		currentUser = ensuredUser.currentUser;
	}

	return currentUser;
}

export async function requireCurrentAppUser(locals: App.Locals) {
	const currentUser = await ensureCurrentAppUser(locals);

	if (!currentUser) {
		throw new Error('Authenticated Clerk session is missing a corresponding Convex user.');
	}

	return currentUser;
}

export async function loadCurrentUserWorkspaces(locals: App.Locals) {
	return await locals.convex.query(api.workspaces.listCurrentUserWorkspaces, {});
}

export async function getSignedInAppRedirectPath(locals: App.Locals) {
	await requireCurrentAppUser(locals);
	const workspaces = await loadCurrentUserWorkspaces(locals);

	return workspaces.length === 0 ? '/app/workspaces/new' : '/app';
}
