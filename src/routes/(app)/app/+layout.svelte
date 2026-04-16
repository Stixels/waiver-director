<script lang="ts">
	import ConvexClerkBridge from '$lib/components/auth/ConvexClerkBridge.svelte';
	let { children } = $props();
</script>

<ConvexClerkBridge />
{@render children()}
