<script lang="ts">
	import { setupConvex } from 'convex-svelte';
	import ConvexClerkBridge from '$lib/components/auth/ConvexClerkBridge.svelte';
	import { publicEnv } from '$lib/config/public';

	setupConvex(publicEnv.convexUrl, { expectAuth: true });
	let { children } = $props();
</script>

<ConvexClerkBridge />
{@render children()}
