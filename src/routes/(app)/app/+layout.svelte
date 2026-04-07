<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { setupConvex } from 'convex-svelte';
	import { appNavigation } from '$lib/domain/navigation';
	import ConvexClerkBridge from '$lib/components/auth/ConvexClerkBridge.svelte';
	import ConvexUserSync from '$lib/components/auth/ConvexUserSync.svelte';
	import { Button } from '$lib/components/ui/button';
	import { publicEnv } from '$lib/config/public';
	import { useClerkContext } from 'svelte-clerk';

	setupConvex(publicEnv.convexUrl);

	let { children } = $props();
	const clerk = useClerkContext();
	let isSigningOut = $state(false);

	async function handleSignOut() {
		if (!clerk.clerk || isSigningOut) return;
		isSigningOut = true;
		try {
			await clerk.clerk.signOut({
				redirectUrl: resolve('/')
			});
		} finally {
			isSigningOut = false;
		}
	}
</script>

<div class="p-6">
	{#if browser}
		<ConvexClerkBridge />
		<ConvexUserSync />
	{/if}
	<header class="flex justify-between gap-4">
		<div class="ml-auto flex items-end gap-2">
			<Button variant="outline" onclick={handleSignOut} disabled={isSigningOut}>
				{isSigningOut ? 'Logging out...' : 'Log out'}
			</Button>
		</div>
	</header>

	<div class="mt-6 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
		<nav class="space-y-1">
			{#each appNavigation as item (item.label)}
				<a href={resolve(item.href)} class="block text-sm underline underline-offset-4">
					{item.label}
				</a>
			{/each}
		</nav>

		<div>
			{@render children()}
		</div>
	</div>
</div>
