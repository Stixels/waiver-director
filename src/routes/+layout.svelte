<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { setupConvex } from 'convex-svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import { publicEnv } from '$lib/config/public';

	let { children } = $props();

	setupConvex(publicEnv.convexUrl);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher />
<div class="min-h-screen bg-background text-foreground antialiased">
	{@render children()}
	<Toaster richColors position="top-right" />
</div>
