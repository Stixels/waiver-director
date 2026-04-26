<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLElement>, HTMLElement>;

	let { ref = $bindable(null), class: className, children, ...restProps }: Props = $props();
</script>

<kbd
	bind:this={ref}
	data-slot="kbd"
	class={cn(
		'pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] leading-none font-medium text-muted-foreground shadow-xs select-none',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</kbd>
