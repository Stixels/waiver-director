<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		heading?: string;
	}

	let { children, heading = 'Additional details' }: Props = $props();
</script>

<div class="mt-10 space-y-6 border-t border-border/50 pt-8">
	<div>
		<h3 class="text-base font-semibold tracking-tight">{heading}</h3>
	</div>

	<div class="space-y-6">
		{@render children()}
	</div>
</div>
