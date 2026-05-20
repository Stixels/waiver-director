<script lang="ts">
	import { setupConvex } from 'convex-svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { publicEnv } from '$lib/config/public';

	setupConvex(publicEnv.convexUrl);

	let { children } = $props();
</script>

{@render children()}
<Toaster richColors position="top-right" closeButton />
