<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	type Props = {
		class?: string;
		currentPage?: number;
		hasNextPage?: boolean;
		hasPreviousPage?: boolean;
		itemCount: number;
		itemLabel: string;
		nextLabel?: string;
		onNext?: () => void;
		onPrevious?: () => void;
		previousLabel?: string;
		totalCount?: number | null;
	};

	let {
		class: className,
		currentPage,
		hasNextPage = false,
		hasPreviousPage = false,
		itemCount,
		itemLabel,
		nextLabel = 'Next',
		onNext,
		onPrevious,
		previousLabel = 'Previous',
		totalCount = null
	}: Props = $props();

	const hasPaginationControls = $derived(hasPreviousPage || hasNextPage);
	const itemLabelText = $derived(itemCount === 1 ? itemLabel : `${itemLabel}s`);
</script>

<div
	class={cn(
		'flex items-center gap-3',
		hasPaginationControls ? 'justify-between' : 'justify-end',
		className
	)}
>
	<p class="text-xs text-muted-foreground tabular-nums">
		{#if currentPage}Page {currentPage} ·
		{/if}{itemCount}
		{#if totalCount !== null && totalCount !== undefined}
			of {totalCount}
		{/if}
		{itemLabelText}
	</p>
	{#if hasPaginationControls}
		<div class="flex items-center gap-2">
			<Button size="sm" variant="outline" disabled={!hasPreviousPage} onclick={onPrevious}>
				<ChevronLeftIcon class="size-4" aria-hidden="true" />
				{previousLabel}
			</Button>
			<Button size="sm" variant="outline" disabled={!hasNextPage} onclick={onNext}>
				{nextLabel}
				<ChevronRightIcon class="size-4" aria-hidden="true" />
			</Button>
		</div>
	{/if}
</div>
