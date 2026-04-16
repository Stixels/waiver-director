<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { useConvexClient } from 'convex-svelte';
	import { useClerkContext } from 'svelte-clerk';

	const clerk = useClerkContext();
	const convex = useConvexClient();

	let lastRegisteredSessionId: string | null = null;

	let cachedToken: string | null = $state(null);
	let cachedTokenExpiresAtMs: number | null = $state(null);
	let inflightTokenPromise: Promise<string | null> | null = null;
	let lastRateLimitLogAtMs = 0;

	function decodeJwtExpiry(token: string): number | null {
		try {
			const [, payload] = token.split('.');
			if (!payload) return null;

			const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
			const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
			const decoded = JSON.parse(atob(padded)) as { exp?: number };

			return decoded.exp ? decoded.exp * 1000 : null;
		} catch {
			return null;
		}
	}

	function hasUsableCachedToken() {
		return (
			!!cachedToken &&
			typeof cachedTokenExpiresAtMs === 'number' &&
			Number.isFinite(cachedTokenExpiresAtMs) &&
			cachedTokenExpiresAtMs > Date.now() + 30_000
		);
	}

	function getCurrentSessionId() {
		return clerk.clerk?.session?.id ?? clerk.session?.id ?? clerk.auth.sessionId ?? null;
	}

	function ownsCurrentTokenState(sessionId: string) {
		return lastRegisteredSessionId === sessionId && getCurrentSessionId() === sessionId;
	}

	function isRateLimitError(error: unknown) {
		if (typeof error !== 'object' || !error) return false;

		if ('status' in error && error.status === 429) {
			return true;
		}

		if ('errors' in error && Array.isArray(error.errors)) {
			return error.errors.some(
				(issue) =>
					typeof issue === 'object' &&
					issue !== null &&
					('code' in issue || 'message' in issue) &&
					(issue.code === 'too_many_requests' ||
						(typeof issue.message === 'string' && issue.message.includes('Too Many Requests')))
			);
		}

		return false;
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
			if (lastRegisteredSessionId === registeredSessionId) {
				cachedToken = null;
				cachedTokenExpiresAtMs = null;
				inflightTokenPromise = null;
			}
			return null;
		}

		if (!forceRefreshToken && inflightTokenPromise) {
			return await inflightTokenPromise;
		}

		if (!forceRefreshToken && hasUsableCachedToken()) {
			return cachedToken;
		}

		let currentTokenPromise: Promise<string | null> | null = null;
		const tokenPromise = (async () => {
			try {
				const token = await activeSession.getToken({
					template: 'convex',
					skipCache: forceRefreshToken
				});

				if (!ownsCurrentTokenState(registeredSessionId)) {
					return null;
				}

				cachedToken = token ?? null;
				cachedTokenExpiresAtMs = token ? decodeJwtExpiry(token) : null;

				return cachedToken;
			} catch (error) {
				if (
					isRateLimitError(error) &&
					ownsCurrentTokenState(registeredSessionId) &&
					hasUsableCachedToken()
				) {
					if (Date.now() - lastRateLimitLogAtMs > 5_000) {
						lastRateLimitLogAtMs = Date.now();
						console.warn('[auth/bridge] Clerk token rate-limited, reusing cached token');
					}

					return cachedToken;
				}

				console.error('[auth/bridge] token fetch failed', error);
				return null;
			} finally {
				if (
					lastRegisteredSessionId === registeredSessionId &&
					inflightTokenPromise === currentTokenPromise
				) {
					inflightTokenPromise = null;
				}
			}
		})();
		currentTokenPromise = tokenPromise;

		if (!forceRefreshToken) {
			inflightTokenPromise = tokenPromise;
		}

		return await tokenPromise;
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
			return;
		}

		if (!userId || !sessionId) {
			cachedToken = null;
			cachedTokenExpiresAtMs = null;
			inflightTokenPromise = null;
			if (lastRegisteredSessionId !== null) {
				convexClient.clearAuth();
				lastRegisteredSessionId = null;
			}
			return;
		}

		if (sessionId === lastRegisteredSessionId) {
			void getTokenForSession(sessionId, false);
			return;
		}

		lastRegisteredSessionId = sessionId;
		cachedToken = null;
		cachedTokenExpiresAtMs = null;
		inflightTokenPromise = null;

		// Set the Convex auth token for the current Clerk session
		convexClient.setAuth(
			async ({ forceRefreshToken }) => await getTokenForSession(sessionId, forceRefreshToken),
			() => {}
		);
		void getTokenForSession(sessionId, false);
	});

	onDestroy(() => {
		if (!browser || convex.disabled) {
			return;
		}

		inflightTokenPromise = null;
		convex.client.clearAuth();
		lastRegisteredSessionId = null;
	});
</script>
