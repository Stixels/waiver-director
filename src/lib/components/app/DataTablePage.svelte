<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = {
		class?: string;
		children?: Snippet;
		contentClass?: string;
	};

	let { class: className, children, contentClass }: Props = $props();
</script>

<div class={cn('h-full min-h-0 w-full min-w-0 overflow-hidden p-4 sm:p-5', className)}>
	<div
		class={cn('mx-auto flex h-full min-h-0 w-full max-w-7xl min-w-0 flex-col gap-4', contentClass)}
	>
		{@render children?.()}
	</div>
</div>
