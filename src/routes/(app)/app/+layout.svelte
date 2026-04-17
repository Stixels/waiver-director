<script lang="ts">
	import ConvexClerkBridge from '$lib/components/auth/ConvexClerkBridge.svelte';
	let { children, data } = $props();
</script>

<ConvexClerkBridge initialToken={data.convexToken}>
	{@render children()}
</ConvexClerkBridge>
