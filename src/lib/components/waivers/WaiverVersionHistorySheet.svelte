<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import {
		Sheet,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetDescription
	} from '$lib/components/ui/sheet';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import WaiverReadonlyDocument from '$lib/components/waivers/WaiverReadonlyDocument.svelte';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
	}

	let { open = $bindable(), workspaceId }: Props = $props();

	type VersionSummary = FunctionReturnType<typeof api.waivers.listWaiverVersions>[number];

	const versionsQuery = useProtectedQuery(
		api.waivers.listWaiverVersions,
		() => ({ workspaceId }),
		() => ({ keepPreviousData: true })
	);

	const versions = $derived((versionsQuery.data ?? []) as VersionSummary[]);

	let selectedId = $state<VersionSummary['versionId'] | null>(null);
	let previewOpen = $state(false);
	const selected = $derived(versions.find((version) => version.versionId === selectedId) ?? null);

	function formatPublishedAt(timestamp: number) {
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(timestamp));
	}

	function openVersionPreview(versionId: VersionSummary['versionId']) {
		selectedId = versionId;
		previewOpen = true;
	}

	// Clear selection when the preview closes or the history sheet closes.
	$effect(() => {
		if (!previewOpen) selectedId = null;
	});

	$effect(() => {
		if (!open) {
			previewOpen = false;
			selectedId = null;
		}
	});
</script>

<Sheet bind:open>
	<SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
		<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
			<SheetTitle class="text-base font-semibold">Version history</SheetTitle>
			<SheetDescription class="text-xs text-muted-foreground">
				Published versions are locked. Signed records keep the version guests accepted.
			</SheetDescription>
		</SheetHeader>

		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if versionsQuery.isLoading}
				<ul class="divide-y divide-border">
					{#each [0, 1, 2, 3, 4] as index (index)}
						<li class="flex items-center justify-between gap-3 px-6 py-4">
							<div class="min-w-0 flex-1 space-y-1.5">
								<Skeleton class="h-4 w-44 max-w-full" />
								<Skeleton class="h-3 w-24" />
							</div>
							<Skeleton class="h-3 w-10 shrink-0" />
						</li>
					{/each}
				</ul>
			{:else if versions.length === 0}
				<div class="px-6 py-12 text-center text-sm text-muted-foreground">
					No published versions yet.
				</div>
			{:else}
				<ul class="divide-y divide-border">
					{#each versions as version (version.versionId)}
						<li>
							<button
								type="button"
								class="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/40"
								onclick={() => openVersionPreview(version.versionId)}
							>
								<div class="min-w-0 space-y-0.5">
									<div class="flex min-w-0 items-center gap-2">
										<p class="truncate text-sm font-medium">
											Version {version.versionNumber}: {version.title}
										</p>
										{#if version.isActivePublic}
											<span
												class="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-emerald-600 uppercase"
											>
												Live
											</span>
										{/if}
									</div>
									<p class="text-xs text-muted-foreground">
										Published {formatPublishedAt(version.publishedAt)}
									</p>
								</div>
								<span class="shrink-0 text-xs text-muted-foreground/50">Preview</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</SheetContent>
</Sheet>

<Dialog bind:open={previewOpen}>
	<DialogContent
		class="h-[96vh] w-[calc(100vw-1rem)] max-w-none gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-w-[min(1500px,calc(100vw-4rem))]"
	>
		{#if selected}
			<DialogHeader class="shrink-0 border-b border-border px-6 py-5">
				<DialogTitle class="text-base font-semibold">
					Version {selected.versionNumber}: {selected.title}
				</DialogTitle>
				<DialogDescription class="text-xs text-muted-foreground">
					Published {formatPublishedAt(selected.publishedAt)}
				</DialogDescription>
			</DialogHeader>

			<div class="min-h-0 flex-1 overflow-y-auto bg-muted/20">
				<WaiverReadonlyDocument
					workspaceName={selected.workspaceName}
					introCopy={selected.introCopy}
					fields={selected.fields}
					preview
				/>
			</div>
		{/if}
	</DialogContent>
</Dialog>
