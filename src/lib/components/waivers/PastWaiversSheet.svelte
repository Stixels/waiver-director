<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import {
		Sheet,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetDescription
	} from '$lib/components/ui/sheet';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import {
		waiverSectionCardClass,
		waiverFieldLabelClass
	} from '$lib/components/waivers/waiver-public-form-classes';
	import { formatFieldTypeLabel } from '$lib/domain/waivers';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
	}

	let { open = $bindable(), workspaceId }: Props = $props();

	type TemplateSummary = FunctionReturnType<typeof api.waivers.listTemplates>[number];

	const templatesQuery = useProtectedQuery(
		api.waivers.listTemplates,
		() => ({ workspaceId }),
		() => ({ keepPreviousData: true })
	);

	const archivedTemplates = $derived(
		(templatesQuery.data ?? []).filter((t) => t.status === 'archived') as TemplateSummary[]
	);

	let selectedId = $state<TemplateSummary['templateId'] | null>(null);
	const selected = $derived(archivedTemplates.find((t) => t.templateId === selectedId) ?? null);

	// Clear selection when sheet closes
	$effect(() => {
		if (!open) selectedId = null;
	});
</script>

<Sheet bind:open>
	<SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
		{#if selected}
			<!-- Waiver detail view -->
			<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
				<div class="flex items-center gap-3">
					<button
						type="button"
						class="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
						onclick={() => (selectedId = null)}
					>
						<ArrowLeftIcon class="h-3.5 w-3.5" />
						Back
					</button>
					<span class="text-muted-foreground/40">/</span>
					<SheetTitle class="text-sm font-medium">{selected.title}</SheetTitle>
				</div>
				<SheetDescription class="sr-only">Archived waiver — read only</SheetDescription>
			</SheetHeader>

			<div class="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-8 sm:px-8">
				<div class="mx-auto max-w-xl space-y-5">
					<section class={waiverSectionCardClass}>
						<h1 class="text-3xl font-bold tracking-tight">{selected.title}</h1>
						{#if selected.introCopy}
							<WaiverRichText
								html={selected.introCopy}
								class="mt-4 text-base leading-relaxed text-foreground/75"
							/>
						{/if}
					</section>

					{#if selected.fields.length > 0}
						<section class={waiverSectionCardClass}>
							<p
								class="mb-6 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
							>
								Custom fields
							</p>
							<div class="space-y-6">
								{#each selected.fields as field (field.id)}
									<div>
										<div class={waiverFieldLabelClass}>
											{field.label}
											{#if field.required}<span class="text-foreground/40">*</span>{/if}
										</div>
										<div class="mt-1 text-xs text-muted-foreground/60 capitalize italic">
											{formatFieldTypeLabel(field.type)}
											{#if field.type === 'select'}
												({field.options.map((option) => option.label).join(', ')})
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</section>
					{/if}
				</div>
			</div>
		{:else}
			<!-- List view -->
			<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
				<SheetTitle class="text-base font-semibold">Past waivers</SheetTitle>
				<SheetDescription class="text-xs text-muted-foreground">
					Archived waivers are locked. Their signed records are preserved in submissions.
				</SheetDescription>
			</SheetHeader>

			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if templatesQuery.isLoading}
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
				{:else if archivedTemplates.length === 0}
					<div class="px-6 py-12 text-center text-sm text-muted-foreground">
						No archived waivers yet.
					</div>
				{:else}
					<ul class="divide-y divide-border">
						{#each archivedTemplates as template (template.templateId)}
							<li>
								<button
									type="button"
									class="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/40"
									onclick={() => (selectedId = template.templateId)}
								>
									<div class="min-w-0 space-y-0.5">
										<p class="truncate text-sm font-medium">{template.title}</p>
										<p class="text-xs text-muted-foreground">
											{template.usageState === 'used' ? 'Has signed records' : 'No signatures'}
										</p>
									</div>
									<span class="shrink-0 text-xs text-muted-foreground/50">View →</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</SheetContent>
</Sheet>
