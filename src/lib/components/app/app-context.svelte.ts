import { getContext, setContext } from 'svelte';
import type { FunctionReturnType } from 'convex/server';
import { api } from '$convex/_generated/api';

export type AppContextData = FunctionReturnType<typeof api.app.current>;
export type AppWorkspace = AppContextData['workspaces'][number];

export type AppContextState = {
	currentUser: AppContextData['currentUser'];
	workspaces: AppWorkspace[];
	isLoading: boolean;
	error: Error | null;
};

const APP_CONTEXT = Symbol('app-context');

export function setAppContext(state: AppContextState) {
	setContext(APP_CONTEXT, state);
}

export function useAppContext() {
	const context = getContext<AppContextState>(APP_CONTEXT);
	if (!context) {
		throw new Error('App context is missing.');
	}

	return context;
}
