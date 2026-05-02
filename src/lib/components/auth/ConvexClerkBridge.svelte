<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, tick, type Snippet } from 'svelte';
	import { useConvexClient } from 'convex-svelte';
	import { useClerkContext } from 'svelte-clerk';
	import {
		clearProtectedQueryCache,
		setConvexAuthContext,
		type ConvexAuthState
	} from '$lib/components/auth/convex-auth.svelte';

	interface Props {
		initialToken?: string | null;
		children?: Snippet;
	}

	let { initialToken = null, children }: Props = $props();

	const clerk = useClerkContext();
	const convex = useConvexClient();
	const convexAuth = $state<ConvexAuthState>({
		status: 'loading',
		sessionId: null,
		signOut
	});
	setConvexAuthContext(convexAuth);

	let lastRegisteredSessionId: string | null = null;

	let hasSeededInitialToken = false;

	function getCurrentSessionId() {
		return clerk.clerk?.session?.id ?? clerk.session?.id ?? clerk.auth.sessionId ?? null;
	}

	function ownsCurrentTokenState(sessionId: string) {
		return lastRegisteredSessionId === sessionId && getCurrentSessionId() === sessionId;
	}

	function takeInitialToken() {
		if (hasSeededInitialToken) return;
		hasSeededInitialToken = true;

		return initialToken;
	}

	async function signOut(redirectUrl: string) {
		if (!clerk.clerk) return;

		const previousStatus = convexAuth.status;
		const previousSessionId = convexAuth.sessionId;
		convexAuth.status = 'unauthenticated';
		convexAuth.sessionId = null;
		clearProtectedQueryCache();
		await tick();

		try {
			await clerk.clerk.signOut({ redirectUrl });
		} catch (error) {
			if (
				previousSessionId &&
				getCurrentSessionId() === previousSessionId &&
				lastRegisteredSessionId === previousSessionId
			) {
				convexAuth.status = previousStatus;
				convexAuth.sessionId = previousSessionId;
			}
			throw error;
		}
	}

	function updateAuthStatusForSession(sessionId: string, isAuthenticated: boolean) {
		if (!ownsCurrentTokenState(sessionId)) return;
		convexAuth.status = isAuthenticated ? 'authenticated' : 'loading';
		if (isAuthenticated) {
			convexAuth.sessionId = sessionId;
		}
	}

	function beginUnauthenticatedTeardown() {
		const previousSessionId = lastRegisteredSessionId;

		convexAuth.status = 'unauthenticated';
		convexAuth.sessionId = null;
		clearProtectedQueryCache();

		if (previousSessionId) {
			void clearConvexAuthAfterProtectedQueriesSkip(previousSessionId);
		}
	}

	async function clearConvexAuthAfterProtectedQueriesSkip(sessionId: string) {
		await tick();

		if (lastRegisteredSessionId !== sessionId || getCurrentSessionId()) {
			return;
		}

		convex.client.clearAuth();
		lastRegisteredSessionId = null;
	}

	async function getTokenForSession(
		registeredSessionId: string,
		forceRefreshToken: boolean
	): Promise<string | null> {
		const activeSession = clerk.clerk?.session ?? clerk.session;
		if (
			!activeSession ||
			activeSession.id !== registeredSessionId ||
			!ownsCurrentTokenState(registeredSessionId)
		) {
			return null;
		}

		if (!forceRefreshToken) {
			const seededToken = takeInitialToken();
			if (seededToken) {
				return seededToken;
			}
		}

		try {
			return await activeSession.getToken({
				template: 'convex',
				skipCache: forceRefreshToken
			});
		} catch (error) {
			console.error('[auth/bridge] token fetch failed', error);
			return null;
		}
	}

	$effect(() => {
		if (!browser || convex.disabled) {
			return;
		}

		const convexClient = convex.client;
		const isLoaded = clerk.isLoaded;
		const userId = clerk.auth.userId;
		const sessionId = clerk.auth.sessionId;

		if (!isLoaded) {
			convexAuth.status = 'loading';
			return;
		}

		if (!userId || !sessionId) {
			beginUnauthenticatedTeardown();
			return;
		}

		if (sessionId === lastRegisteredSessionId) {
			return;
		}

		clearProtectedQueryCache();
		lastRegisteredSessionId = sessionId;
		convexAuth.status = 'loading';
		if (convexAuth.sessionId !== sessionId) {
			convexAuth.sessionId = null;
		}

		// Set the Convex auth token for the current Clerk session
		convexClient.setAuth(
			async ({ forceRefreshToken }) => await getTokenForSession(sessionId, forceRefreshToken),
			(isAuthenticated) => updateAuthStatusForSession(sessionId, isAuthenticated)
		);
	});

	onDestroy(() => {
		if (!browser || convex.disabled) {
			return;
		}

		convexAuth.status = 'unauthenticated';
		convexAuth.sessionId = null;
		clearProtectedQueryCache();
		convex.client.clearAuth();
		lastRegisteredSessionId = null;
	});
</script>

{@render children?.()}
