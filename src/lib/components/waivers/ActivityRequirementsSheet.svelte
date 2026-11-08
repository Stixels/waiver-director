<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetHeader,
		SheetTitle
	} from '$lib/components/ui/sheet';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	type RequirementRow = FunctionReturnType<
		typeof api.waivers.listActivityWaiverRequirements
	>[number];
	type WaiverListItem = FunctionReturnType<typeof api.waivers.listWorkspaceWaivers>[number];

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
		isOwner: boolean;
	}

	let { open = $bindable(), workspaceId, isOwner }: Props = $props();

	const convex = useConvexClient();
	const requirementsQuery = useProtectedQuery(
		api.waivers.listActivityWaiverRequirements,
		() => (open ? { workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);
	const waiversQuery = useProtectedQuery(
		api.waivers.listWorkspaceWaivers,
		() => (open ? { workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);

	const rows = $derived((requirementsQuery.data ?? []) as RequirementRow[]);
	const waivers = $derived((waiversQuery.data ?? []) as WaiverListItem[]);
	const defaultWaiver = $derived(waivers.find((waiver) => waiver.isDefault) ?? null);

	let savingKey = $state<string | null>(null);
	let newActivityName = $state('');

	function waiverTitle(waiverId: Id<'workspace_waivers'>) {
		return waivers.find((waiver) => waiver.waiverId === waiverId)?.title ?? 'Waiver';
	}

	async function saveRequirement(
		key: string,
		activityName: string,
		waiverIds: Id<'workspace_waivers'>[]
	) {
		if (convex.disabled) return;
		savingKey = key;
		try {
			await convex.mutation(api.waivers.setActivityWaiverRequirement, {
				workspaceId,
				activityName,
				waiverIds
			});
			return true;
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to update this requirement.'));
			return false;
		} finally {
			savingKey = null;
		}
	}

	function toggleWaiver(row: RequirementRow, waiverId: Id<'workspace_waivers'>) {
		// Starting from the default requirement means "default only"; checking a
		// waiver builds an explicit list that replaces the default.
		const current = row.waiverIds ?? (defaultWaiver ? [defaultWaiver.waiverId] : []);
		const next = current.includes(waiverId)
			? current.filter((id) => id !== waiverId)
			: [...current, waiverId];
		void saveRequirement(row.activityKey, row.activityName, next);
	}

	async function addActivity(event: SubmitEvent) {
		event.preventDefault();
		const name = newActivityName.trim();
		if (!name || !defaultWaiver) return;
		const saved = await saveRequirement('__new__', name, [defaultWaiver.waiverId]);
		if (saved) newActivityName = '';
	}
</script>

<Sheet bind:open>
	<SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
		<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
			<SheetTitle class="text-base font-semibold">Activity requirements</SheetTitle>
			<SheetDescription>
				Every activity uses the default waiver{defaultWaiver ? ` (${defaultWaiver.title})` : ''}
				unless you pick different waivers for it here. Guests on a booking for that activity are asked
				to sign each selected waiver.
			</SheetDescription>
		</SheetHeader>

		<div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
			{#if requirementsQuery.isLoading || waiversQuery.isLoading}
				<div class="space-y-3">
					{#each [0, 1, 2] as index (index)}
						<Skeleton class="h-16 w-full rounded-lg" />
					{/each}
				</div>
			{:else if rows.length === 0}
				<p class="text-sm text-muted-foreground">
					No activities yet. Activities appear here once bookings sync from your booking provider,
					or you can add one by name below.
				</p>
			{:else}
				<ul class="space-y-3">
					{#each rows as row (row.activityKey)}
						{@const selected = row.waiverIds ?? []}
						<li class="rounded-lg border border-border p-3">
							<div class="flex items-baseline justify-between gap-3">
								<p class="min-w-0 truncate text-sm font-medium">{row.activityName}</p>
								<p class="shrink-0 text-xs text-muted-foreground">
									{row.waiverIds === null
										? 'Default waiver'
										: `${row.waiverIds.length} waiver${row.waiverIds.length === 1 ? '' : 's'}`}
								</p>
							</div>
							{#if isOwner && waivers.length > 1}
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each waivers as waiver (waiver.waiverId)}
										{@const isOn =
											row.waiverIds === null
												? waiver.isDefault
												: selected.includes(waiver.waiverId)}
										<button
											type="button"
											class="rounded-full border px-2.5 py-0.5 text-xs transition-colors {isOn
												? 'border-primary bg-primary text-primary-foreground'
												: 'border-border text-muted-foreground hover:bg-muted'}"
											aria-pressed={isOn}
											disabled={savingKey === row.activityKey}
											onclick={() => toggleWaiver(row, waiver.waiverId)}
										>
											{waiver.title}
										</button>
									{/each}
								</div>
								{#if row.waiverIds !== null}
									<button
										type="button"
										class="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
										disabled={savingKey === row.activityKey}
										onclick={() => saveRequirement(row.activityKey, row.activityName, [])}
									>
										Use the default waiver
									</button>
								{/if}
							{:else if row.waiverIds !== null}
								<p class="mt-1 text-xs text-muted-foreground">
									{row.waiverIds.map(waiverTitle).join(', ')}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			{#if isOwner && waivers.length <= 1}
				<p class="mt-4 text-xs text-muted-foreground">
					Create a second waiver from the waiver menu to require different waivers per activity.
				</p>
			{/if}
		</div>

		{#if isOwner && waivers.length > 1}
			<form onsubmit={addActivity} class="flex shrink-0 gap-2 border-t border-border px-6 py-4">
				<Input
					bind:value={newActivityName}
					placeholder="Activity name, as it appears on bookings"
					maxlength={200}
				/>
				<Button
					type="submit"
					variant="secondary"
					disabled={!newActivityName.trim() || savingKey === '__new__'}
				>
					Add
				</Button>
			</form>
		{/if}
	</SheetContent>
</Sheet>
