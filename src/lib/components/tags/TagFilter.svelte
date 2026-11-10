<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { TAG_COLORS } from '$convex/lib/tags';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { cn } from '$lib/utils';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import TagIcon from '@lucide/svelte/icons/tag';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { tagDotClass } from './tag-colors';

	interface Props {
		workspaceId: Id<'workspaces'>;
		kind: 'customer' | 'submission';
		selectedTagId: Id<'workspace_tags'> | null;
		canManage?: boolean;
		onSelect: (tagId: Id<'workspace_tags'> | null) => void;
	}

	let { workspaceId, kind, selectedTagId, canManage = false, onSelect }: Props = $props();

	const convex = useConvexClient();
	let open = $state(false);
	let pendingDelete = $state<{ tagId: Id<'workspace_tags'>; name: string } | null>(null);
	let confirmOpen = $state(false);

	const workspaceTagsQuery = useProtectedQuery(api.tags.listWorkspaceTags, () => ({
		workspaceId
	}));
	type WorkspaceTag = FunctionReturnType<typeof api.tags.listWorkspaceTags>[number];
	const workspaceTags = $derived((workspaceTagsQuery.data ?? []) as WorkspaceTag[]);
	const selectedTag = $derived(workspaceTags.find((tag) => tag.tagId === selectedTagId) ?? null);

	function usageCount(tag: WorkspaceTag) {
		return kind === 'customer' ? tag.customerCount : tag.submissionCount;
	}

	function select(tagId: Id<'workspace_tags'> | null) {
		onSelect(tagId);
		open = false;
	}

	async function cycleColor(tag: WorkspaceTag) {
		const nextColor = TAG_COLORS[(TAG_COLORS.indexOf(tag.color) + 1) % TAG_COLORS.length];
		try {
			await convex.mutation(api.tags.updateTag, {
				workspaceId,
				tagId: tag.tagId,
				color: nextColor
			});
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Could not change the tag color.'));
		}
	}

	function requestDelete(tag: WorkspaceTag) {
		pendingDelete = { tagId: tag.tagId, name: tag.name };
		open = false;
		confirmOpen = true;
	}

	async function confirmDelete() {
		if (!pendingDelete) return;
		const { tagId, name } = pendingDelete;
		try {
			await convex.mutation(api.tags.deleteTag, { workspaceId, tagId });
			if (selectedTagId === tagId) onSelect(null);
			toast.success(`Deleted tag “${name}”.`);
			confirmOpen = false;
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Could not delete the tag.'));
		}
	}
</script>

<Popover bind:open>
	<PopoverTrigger
		class={cn(
			'inline-flex h-9 max-w-56 shrink-0 items-center gap-2 rounded-lg border border-input bg-background/60 px-3 text-sm shadow-xs transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
			selectedTag && 'border-foreground/30 bg-background'
		)}
		aria-label="Filter by tag"
	>
		{#if selectedTag}
			<span class={cn('size-2 shrink-0 rounded-full', tagDotClass(selectedTag.color))}></span>
			<span class="truncate">{selectedTag.name}</span>
		{:else}
			<TagIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span class="text-muted-foreground">All tags</span>
		{/if}
		<ChevronDownIcon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
	</PopoverTrigger>
	<PopoverContent align="start" class="w-64 gap-1 p-1.5">
		<button
			type="button"
			class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
			onclick={() => select(null)}
		>
			<span class="min-w-0 flex-1">All tags</span>
			{#if !selectedTagId}
				<CheckIcon class="size-3.5 shrink-0" aria-hidden="true" />
			{/if}
		</button>
		{#if workspaceTags.length === 0}
			<p class="px-2 py-1.5 text-xs text-muted-foreground">
				No tags yet. Add one from a {kind === 'customer' ? 'customer' : 'submission'}.
			</p>
		{:else}
			<ul class="max-h-72 overflow-y-auto border-t border-border pt-1">
				{#each workspaceTags as tag (tag.tagId)}
					<li class="group flex items-center gap-1">
						{#if canManage}
							<button
								type="button"
								class="ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
								aria-label={`Change color of ${tag.name}`}
								title="Change color"
								onclick={() => void cycleColor(tag)}
							>
								<span class={cn('size-2 rounded-full', tagDotClass(tag.color))}></span>
							</button>
						{/if}
						<button
							type="button"
							class={cn(
								'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
								canManage && 'pl-1'
							)}
							onclick={() => select(tag.tagId)}
						>
							{#if !canManage}
								<span class={cn('size-2 shrink-0 rounded-full', tagDotClass(tag.color))}></span>
							{/if}
							<span class="min-w-0 flex-1 truncate">{tag.name}</span>
							<span class="shrink-0 text-[10px] text-muted-foreground tabular-nums">
								{usageCount(tag)}
							</span>
							{#if selectedTagId === tag.tagId}
								<CheckIcon class="size-3.5 shrink-0" aria-hidden="true" />
							{/if}
						</button>
						{#if canManage}
							<button
								type="button"
								class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
								aria-label={`Delete tag ${tag.name}`}
								title="Delete tag"
								onclick={() => requestDelete(tag)}
							>
								<Trash2Icon class="size-3.5" aria-hidden="true" />
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</PopoverContent>
</Popover>

<ConfirmDialog
	bind:open={confirmOpen}
	title={pendingDelete ? `Delete “${pendingDelete.name}”?` : 'Delete tag?'}
	description="The tag is removed from every customer and submission in this workspace. Signed waivers are not changed."
	confirmLabel="Delete tag"
	destructive
	onConfirm={confirmDelete}
/>
