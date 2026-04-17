<script lang="ts">
	import AppBootstrap from '$lib/components/app/AppBootstrap.svelte';
	import ConvexClerkBridge from '$lib/components/auth/ConvexClerkBridge.svelte';
	let { children } = $props();
</script>

<ConvexClerkBridge>
	<AppBootstrap>
		{@render children()}
	</AppBootstrap>
</ConvexClerkBridge>
