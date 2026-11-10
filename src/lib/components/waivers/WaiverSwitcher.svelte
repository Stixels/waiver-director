<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuLabel,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';

	type WaiverListItem = FunctionReturnType<typeof api.waivers.listWorkspaceWaivers>[number];

	interface Props {
		workspaceId: Id<'workspaces'>;
		currentWaiverId: Id<'workspace_waivers'> | null;
		isOwner: boolean;
		onSelect: (waiverId: Id<'workspace_waivers'>) => void;
		onOpenRequirements: () => void;
	}

	let { workspaceId, currentWaiverId, isOwner, onSelect, onOpenRequirements }: Props = $props();

	const convex = useConvexClient();
	const waiversQuery = useProtectedQuery(
		api.waivers.listWorkspaceWaivers,
		() => ({ workspaceId }),
		() => ({ keepPreviousData: true })
	);
	const waivers = $derived((waiversQuery.data ?? []) as WaiverListItem[]);
	const current = $derived(waivers.find((waiver) => waiver.waiverId === currentWaiverId) ?? null);

	let createOpen = $state(false);
	let newTitle = $state('');
	let isCreating = $state(false);

	function openCreate() {
		newTitle = '';
		createOpen = true;
	}

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		if (convex.disabled || isCreating) return;
		isCreating = true;
		try {
			const { waiverId } = await convex.mutation(api.waivers.createWorkspaceWaiver, {
				workspaceId,
				title: newTitle
			});
			createOpen = false;
			toast.success('Waiver created.');
			onSelect(waiverId);
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to create this waiver.'));
		} finally {
			isCreating = false;
		}
	}
</script>

<DropdownMenu>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				class="flex h-8 max-w-56 min-w-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium hover:bg-muted"
				aria-label="Switch waiver"
			>
				<span class="truncate">{current?.title ?? 'Waiver'}</span>
				{#if current?.isDefault && waivers.length > 1}
					<span
						class="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground uppercase"
					>
						Default
					</span>
				{/if}
				<ChevronsUpDownIcon class="size-3.5 shrink-0 text-muted-foreground" />
			</button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="start" class="w-64">
		<DropdownMenuLabel class="text-xs text-muted-foreground">Waivers</DropdownMenuLabel>
		{#each waivers as waiver (waiver.waiverId)}
			<DropdownMenuItem onclick={() => onSelect(waiver.waiverId)} class="gap-2">
				<span class="flex size-3.5 shrink-0 items-center justify-center">
					{#if waiver.waiverId === currentWaiverId}
						<CheckIcon class="size-3.5" />
					{/if}
				</span>
				<span class="min-w-0 flex-1 truncate">{waiver.title}</span>
				{#if waiver.isDefault}
					<span class="text-[10px] text-muted-foreground uppercase">Default</span>
				{:else if !waiver.isPublished}
					<span class="text-[10px] text-muted-foreground uppercase">Draft</span>
				{/if}
			</DropdownMenuItem>
		{/each}
		<DropdownMenuSeparator />
		{#if isOwner}
			<DropdownMenuItem onclick={openCreate} class="gap-2">
				<PlusIcon class="size-3.5" />
				New waiver
			</DropdownMenuItem>
		{/if}
		<DropdownMenuItem onclick={onOpenRequirements} class="gap-2">
			<ListChecksIcon class="size-3.5" />
			Activity requirements
		</DropdownMenuItem>
	</DropdownMenuContent>
</DropdownMenu>

<Dialog bind:open={createOpen}>
	<DialogContent class="sm:max-w-md">
		<form onsubmit={handleCreate} class="space-y-4">
			<DialogHeader>
				<DialogTitle>New waiver</DialogTitle>
				<DialogDescription>
					Add a separate waiver for an activity that needs its own terms, such as a rental or a
					high-risk tour. It gets its own link and version history.
				</DialogDescription>
			</DialogHeader>
			<div class="space-y-2">
				<Label for="new-waiver-title">Waiver title</Label>
				<Input
					id="new-waiver-title"
					bind:value={newTitle}
					placeholder="e.g. Zipline release of liability"
					maxlength={120}
					required
				/>
			</div>
			<DialogFooter>
				<Button type="button" variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={isCreating || newTitle.trim().length === 0}>
					{isCreating ? 'Creating…' : 'Create waiver'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
