import { api } from '../../convex/_generated/api';

export async function loadCurrentAppContext(locals: App.Locals) {
	const appContext = await locals.convex.query(api.app.current, {});

	if (!appContext.currentUser) {
		const ensuredUser = await locals.convex.mutation(api.users.ensureCurrentUser, {});
		return {
			currentUser: ensuredUser.currentUser,
			workspaces: []
		};
	}

	return appContext;
}

export async function requireCurrentAppUser(locals: App.Locals) {
	const { currentUser } = await loadCurrentAppContext(locals);

	if (!currentUser) {
		throw new Error('Authenticated Clerk session is missing a corresponding Convex user.');
	}

	return currentUser;
}

export async function getSignedInAppRedirectPath(locals: App.Locals) {
	const { currentUser, workspaces } = await loadCurrentAppContext(locals);

	if (!currentUser) {
		throw new Error('Authenticated Clerk session is missing a corresponding Convex user.');
	}

	return workspaces.length === 0 ? '/app/workspaces/new' : `/app/${workspaces[0].slug}`;
}
