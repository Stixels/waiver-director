<script lang="ts">
	import { browser } from '$app/environment';
	import { api } from '../../../convex/_generated/api';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { useClerkContext } from 'svelte-clerk';

	const clerk = useClerkContext();
	const convex = useConvexClient();
	const currentUser = useQuery(api.users.currentUser, () => (clerk.auth.userId ? {} : 'skip'));

	let syncedSessionId = $state<string | null>(null);
	let syncInFlight = false;

	$effect(() => {
		if (!browser || convex.disabled) {
			return;
		}

		const isLoaded = clerk.isLoaded;
		const userId = clerk.auth.userId;
		const sessionId = clerk.auth.sessionId;

		if (!isLoaded || !userId || !sessionId) {
			syncedSessionId = null;
			return;
		}

		if (
			currentUser.isLoading ||
			currentUser.error ||
			currentUser.data !== null ||
			syncInFlight ||
			syncedSessionId === sessionId
		) {
			return;
		}

		let cancelled = false;
		syncInFlight = true;

		// Ensure the current user is persisted in Convex
		void convex
			.mutation(api.users.ensureCurrentUser, {})
			.then(() => {
				if (!cancelled) {
					syncedSessionId = sessionId;
				}
			})
			.catch((error) => {
				console.error('[auth/user-sync] failed to persist current user in Convex', error);
			})
			.finally(() => {
				if (!cancelled) {
					syncInFlight = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});
</script>
