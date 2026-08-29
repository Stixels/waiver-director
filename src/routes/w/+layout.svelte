<script lang="ts">
	import { setupConvex } from 'convex-svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import { publicEnv } from '$lib/config/public';

	setupConvex(publicEnv.convexUrl);

	let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />
{@render children()}
<Toaster richColors position="top-right" closeButton />
