<script lang="ts">
	import { cn } from '$lib/utils';
	import TagBadge from './TagBadge.svelte';
	import type { TagColor } from './tag-colors';

	interface Props {
		tags: Array<{ tagId: string; name: string; color: TagColor }>;
		max?: number;
		class?: string;
	}

	let { tags, max = 3, class: className }: Props = $props();
	const visible = $derived(tags.slice(0, max));
	const hiddenCount = $derived(Math.max(0, tags.length - max));
</script>

{#if tags.length > 0}
	<div class={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
		{#each visible as tag (tag.tagId)}
			<TagBadge name={tag.name} color={tag.color} />
		{/each}
		{#if hiddenCount > 0}
			<span
				class="text-[10px] font-medium text-muted-foreground tabular-nums"
				title={tags
					.slice(max)
					.map((tag) => tag.name)
					.join(', ')}
			>
				+{hiddenCount}
			</span>
		{/if}
	</div>
{/if}
