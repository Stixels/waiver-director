<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full min-w-0 max-w-7xl space-y-6">
		{@render children()}
	</div>
</div>
