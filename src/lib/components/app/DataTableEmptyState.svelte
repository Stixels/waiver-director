<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils';

	type Props = {
		class?: string;
		description: string;
		icon: Component;
		title: string;
	};

	let { class: className, description, icon: Icon, title }: Props = $props();
</script>

<div
	class={cn('flex min-h-72 flex-1 items-center justify-center px-4 py-12 text-center', className)}
>
	<div class="flex max-w-sm flex-col items-center gap-3">
		<div
			class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
		>
			<Icon class="size-5" aria-hidden="true" />
		</div>
		<div class="space-y-1">
			<p class="text-sm font-medium">{title}</p>
			<p class="text-xs text-muted-foreground">{description}</p>
		</div>
	</div>
</div>
