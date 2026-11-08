<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { cn } from '$lib/utils';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TagIcon from '@lucide/svelte/icons/tag';
	import TagBadge from './TagBadge.svelte';
	import { tagDotClass, type TagColor } from './tag-colors';

	interface Props {
		workspaceId: Id<'workspaces'>;
		tags: Array<{ tagId: Id<'workspace_tags'>; name: string; color: TagColor }>;
		onSetTag: (tagId: Id<'workspace_tags'>, applied: boolean) => Promise<void>;
		class?: string;
	}

	let { workspaceId, tags, onSetTag, class: className }: Props = $props();

	const convex = useConvexClient();
	let open = $state(false);
	let filter = $state('');
	let pendingTagIds = $state<string[]>([]);
	let isCreating = $state(false);

	const workspaceTagsQuery = useProtectedQuery(api.tags.listWorkspaceTags, () => ({
		workspaceId
	}));
	type WorkspaceTag = FunctionReturnType<typeof api.tags.listWorkspaceTags>[number];
	const workspaceTags = $derived((workspaceTagsQuery.data ?? []) as WorkspaceTag[]);
	const appliedIds = $derived(new Set<string>(tags.map((tag) => tag.tagId)));
	const normalizedFilter = $derived(filter.trim().replace(/\s+/g, ' ').toLowerCase());
	const filteredTags = $derived(
		normalizedFilter
			? workspaceTags.filter((tag) => tag.name.toLowerCase().includes(normalizedFilter))
			: workspaceTags
	);
	const canCreate = $derived(
		normalizedFilter.length > 0 &&
			!workspaceTags.some((tag) => tag.name.toLowerCase() === normalizedFilter)
	);

	async function setTag(tagId: Id<'workspace_tags'>, applied: boolean) {
		if (pendingTagIds.includes(tagId)) return;
		pendingTagIds = [...pendingTagIds, tagId];
		try {
			await onSetTag(tagId, applied);
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Could not update tags.'));
		} finally {
			pendingTagIds = pendingTagIds.filter((id) => id !== tagId);
		}
	}

	async function createAndApply() {
		if (!canCreate || isCreating) return;
		isCreating = true;
		try {
			const tag = await convex.mutation(api.tags.createTag, {
				workspaceId,
				name: filter
			});
			filter = '';
			await setTag(tag.tagId, true);
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Could not create tag.'));
		} finally {
			isCreating = false;
		}
	}

	function handleFilterKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		const exact = workspaceTags.find((tag) => tag.name.toLowerCase() === normalizedFilter);
		if (exact) {
			void setTag(exact.tagId, !appliedIds.has(exact.tagId));
			filter = '';
			return;
		}
		void createAndApply();
	}
</script>

<div class={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
	{#each tags as tag (tag.tagId)}
		<TagBadge name={tag.name} color={tag.color} onRemove={() => void setTag(tag.tagId, false)} />
	{/each}

	<Popover bind:open>
		<PopoverTrigger
			class="inline-flex h-5 items-center gap-1 rounded-full border border-dashed border-border px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
			aria-label="Add tag"
		>
			{#if tags.length === 0}
				<TagIcon class="size-3" aria-hidden="true" />
				Add tag
			{:else}
				<PlusIcon class="size-3" aria-hidden="true" />
			{/if}
		</PopoverTrigger>
		<PopoverContent align="start" class="w-64 gap-2 p-2">
			<input
				type="text"
				bind:value={filter}
				onkeydown={handleFilterKeydown}
				maxlength={32}
				placeholder="Find or create a tag"
				aria-label="Find or create a tag"
				class="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
			/>
			<ul class="max-h-60 overflow-y-auto" role="listbox" aria-label="Tags">
				{#each filteredTags as tag (tag.tagId)}
					{@const isApplied = appliedIds.has(tag.tagId)}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={isApplied}
							disabled={pendingTagIds.includes(tag.tagId)}
							class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-60"
							onclick={() => void setTag(tag.tagId, !isApplied)}
						>
							<span class={cn('size-2 shrink-0 rounded-full', tagDotClass(tag.color))}></span>
							<span class="min-w-0 flex-1 truncate">{tag.name}</span>
							{#if isApplied}
								<CheckIcon class="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
							{/if}
						</button>
					</li>
				{/each}
				{#if filteredTags.length === 0 && !canCreate}
					<li class="px-2 py-1.5 text-xs text-muted-foreground">
						{workspaceTags.length === 0 ? 'Type a name to create your first tag.' : 'No tags.'}
					</li>
				{/if}
			</ul>
			{#if canCreate}
				<button
					type="button"
					disabled={isCreating}
					class="flex w-full items-center gap-2 rounded-md border-t border-border px-2 pt-2 pb-1.5 text-left text-xs font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-60"
					onclick={() => void createAndApply()}
				>
					<PlusIcon class="size-3.5 shrink-0" aria-hidden="true" />
					<span class="min-w-0 truncate">Create “{filter.trim()}”</span>
				</button>
			{/if}
		</PopoverContent>
	</Popover>
</div>
