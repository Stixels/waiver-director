<script lang="ts">
	import { browser } from '$app/environment';
	import { setupConvex } from 'convex-svelte';
	import ConvexClerkBridge from '$lib/components/auth/ConvexClerkBridge.svelte';
	import { publicEnv } from '$lib/config/public';

	setupConvex(publicEnv.convexUrl);

	let { children } = $props();
</script>

{#if browser}
	<ConvexClerkBridge />
{/if}

{@render children()}
