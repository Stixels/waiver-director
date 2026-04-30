import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import {
	getFunctionName,
	type FunctionArgs,
	type FunctionReference,
	type FunctionReturnType
} from 'convex/server';
import { convexToJson } from 'convex/values';
import { useQuery } from 'convex-svelte';

type ConvexAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type ConvexAuthState = {
	status: ConvexAuthStatus;
	sessionId: string | null;
	signOut: (redirectUrl: string) => Promise<void>;
};

type UseQueryOptions<Query extends FunctionReference<'query'>> = {
	initialData?: FunctionReturnType<Query>;
	keepPreviousData?: boolean;
};

const CONVEX_AUTH_CONTEXT = Symbol('convex-auth');
const protectedQueryCache = new SvelteMap<string, unknown>();

export function setConvexAuthContext(state: ConvexAuthState) {
	setContext(CONVEX_AUTH_CONTEXT, state);
}

export function useConvexAuthState(): ConvexAuthState {
	return (
		getContext<ConvexAuthState>(CONVEX_AUTH_CONTEXT) ?? {
			status: 'unauthenticated',
			sessionId: null,
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
	const effectiveArgs = $derived.by(() => {
		if (auth.status === 'authenticated' || (auth.status === 'loading' && auth.sessionId)) {
			return resolveArgs(args);
		}

		return 'skip';
	});
	const cacheKey = $derived(getCacheKey(query, effectiveArgs, auth.sessionId));
	const queryResult = useQuery(query, () => effectiveArgs, options);
	const cachedData = $derived.by(() =>
		cacheKey
			? (protectedQueryCache.get(cacheKey) as FunctionReturnType<Query> | undefined)
			: undefined
	);
	const data = $derived(queryResult.data !== undefined ? queryResult.data : cachedData);

	$effect(() => {
		if (!cacheKey || queryResult.data === undefined || queryResult.isStale) return;
		protectedQueryCache.set(cacheKey, queryResult.data);
	});

	return {
		get data() {
			if (auth.status === 'unauthenticated') return undefined;
			return data;
		},
		get error() {
			if (auth.status === 'unauthenticated') return undefined;
			return queryResult.error;
		},
		get isLoading() {
			if (auth.status === 'unauthenticated') return false;
			if (data !== undefined || queryResult.error !== undefined) return false;
			return auth.status === 'loading' || queryResult.isLoading;
		},
		get isStale() {
			return queryResult.isStale;
		}
	};
}

function getCacheKey<Query extends FunctionReference<'query'>>(
	query: Query,
	args: FunctionArgs<Query> | 'skip',
	sessionId: string | null
): string | null {
	if (args === 'skip' || !sessionId) return null;

	return `${sessionId}:${getFunctionName(query)}:${JSON.stringify(convexToJson(args))}`;
}

function resolveArgs<Query extends FunctionReference<'query'>>(
	args: FunctionArgs<Query> | 'skip' | (() => FunctionArgs<Query> | 'skip')
): FunctionArgs<Query> | 'skip' {
	return typeof args === 'function' ? (args as () => FunctionArgs<Query> | 'skip')() : args;
}
