<script lang="ts">
	import { setupConvex } from 'convex-svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { ClerkProvider } from 'svelte-clerk';
	import AppBootstrap from '$lib/components/app/AppBootstrap.svelte';
	import ConvexClerkBridge from '$lib/components/auth/ConvexClerkBridge.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { publicEnv } from '$lib/config/public';

	setupConvex(publicEnv.convexUrl);

	let { children } = $props();
</script>

<ModeWatcher defaultMode="dark" />
<ClerkProvider>
	<ConvexClerkBridge>
		<AppBootstrap>
			{@render children()}
		</AppBootstrap>
	</ConvexClerkBridge>
	<Toaster richColors position="top-right" closeButton />
</ClerkProvider>
