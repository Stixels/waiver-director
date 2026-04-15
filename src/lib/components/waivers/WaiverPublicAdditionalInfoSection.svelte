<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="mt-10 space-y-6 border-t border-border/50 pt-8">
	<div class="space-y-2">
		<h3 class="text-base font-semibold tracking-tight">Additional information</h3>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Complete any extra questions required for this waiver.
		</p>
	</div>

	<div class="space-y-6">
		{@render children()}
	</div>
</div>
