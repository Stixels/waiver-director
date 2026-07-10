<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = {
		class?: string;
		children?: Snippet;
		footer?: Snippet;
		header?: Snippet;
		viewportClass?: string;
	};

	let { class: className, children, footer, header, viewportClass }: Props = $props();
</script>

<div
	class={cn(
		'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/30',
		className
	)}
>
	{#if header}
		<div class="shrink-0 border-b border-border bg-card/80 px-4 py-3">
			{@render header()}
		</div>
	{/if}
	<div class={cn('min-h-0 flex-1 overflow-auto', viewportClass)}>
		{@render children?.()}
	</div>
	{#if footer}
		<div class="shrink-0 border-t border-border bg-card/80 px-4 py-2.5">
			{@render footer()}
		</div>
	{/if}
</div>
