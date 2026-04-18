<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		workspaceName?: string;
		children: Snippet;
	}

	let { workspaceName, children }: Props = $props();
</script>

<div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
	{#if workspaceName}
		<p
			class="mb-6 text-center text-[10px] font-bold tracking-[0.24em] text-muted-foreground/60 uppercase"
		>
			{workspaceName}
		</p>
	{/if}

	{@render children()}
</div>
