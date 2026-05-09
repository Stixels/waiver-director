<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		children: Snippet;
		flush?: boolean;
		class?: string;
	}

	let { children, flush = false, class: className = '' }: Props = $props();
</script>

<div class={cn('w-full min-w-0', flush ? 'h-full p-0' : 'p-4 sm:p-5', className)}>
	<div
		class={cn(
			'mx-auto w-full min-w-0',
			flush ? 'h-full max-w-none space-y-0' : 'max-w-7xl space-y-4'
		)}
	>
		{@render children()}
	</div>
</div>
