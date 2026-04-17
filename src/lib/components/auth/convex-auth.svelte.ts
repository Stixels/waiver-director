import { getContext, setContext } from 'svelte';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import { useQuery } from 'convex-svelte';

type ConvexAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type ConvexAuthState = {
	status: ConvexAuthStatus;
	signOut: (redirectUrl: string) => Promise<void>;
};

type UseQueryOptions<Query extends FunctionReference<'query'>> = {
	initialData?: FunctionReturnType<Query>;
	keepPreviousData?: boolean;
};

const CONVEX_AUTH_CONTEXT = Symbol('convex-auth');

export function setConvexAuthContext(state: ConvexAuthState) {
	setContext(CONVEX_AUTH_CONTEXT, state);
}

export function useConvexAuthState(): ConvexAuthState {
	return (
		getContext<ConvexAuthState>(CONVEX_AUTH_CONTEXT) ?? {
			status: 'unauthenticated',
			signOut: async () => {}
		}
	);
}

export function useProtectedQuery<Query extends FunctionReference<'query'>>(
	query: Query,
	args: FunctionArgs<Query> | 'skip' | (() => FunctionArgs<Query> | 'skip'),
	options?: UseQueryOptions<Query> | (() => UseQueryOptions<Query>)
) {
	const auth = useConvexAuthState();
	const queryResult = useQuery(
		query,
		() => (auth.status === 'authenticated' ? resolveArgs(args) : 'skip'),
		options
	);

	return {
		get data() {
			if (auth.status === 'unauthenticated') return undefined;
			return queryResult.data;
		},
		get error() {
			if (auth.status === 'unauthenticated') return undefined;
			return queryResult.error;
		},
		get isLoading() {
			return auth.status === 'loading' || queryResult.isLoading;
		},
		get isStale() {
			return queryResult.isStale;
		}
	};
}

function resolveArgs<Query extends FunctionReference<'query'>>(
	args: FunctionArgs<Query> | 'skip' | (() => FunctionArgs<Query> | 'skip')
): FunctionArgs<Query> | 'skip' {
	return typeof args === 'function' ? (args as () => FunctionArgs<Query> | 'skip')() : args;
}
