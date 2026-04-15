<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ClerkProvider } from 'svelte-clerk';
	import { setupConvex } from 'convex-svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import { publicEnv } from '$lib/config/public';

	setupConvex(publicEnv.convexUrl);
	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher defaultMode="dark" />
<ClerkProvider>
	<div class="min-h-screen bg-background text-foreground antialiased">
		{@render children()}
		<Toaster richColors position="top-right" />
	</div>
</ClerkProvider>
