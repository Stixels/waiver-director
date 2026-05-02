<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		headerActions: Snippet;
		body: Snippet;
	}

	let { headerActions, body }: Props = $props();
</script>

<div class="mt-10 space-y-6 border-t border-border/50 pt-8">
	{@render headerActions()}
	{@render body()}
</div>
