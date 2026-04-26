<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	type EmailTemplate = FunctionReturnType<typeof api.emails.listEmailTemplates>[number];

	interface Props {
		open: boolean;
		templates: EmailTemplate[];
		isLoading: boolean;
		selectedTemplate: EmailTemplate | null;
		deletingTemplateId: EmailTemplate['_id'] | null;
		onLoad: (template: EmailTemplate) => void;
		onDelete: (template: EmailTemplate) => void;
	}

	let {
		open = $bindable(false),
		templates,
		isLoading,
		selectedTemplate = $bindable(null),
		deletingTemplateId,
		onLoad,
		onDelete
	}: Props = $props();

	function formatDelay(template: EmailTemplate) {
		return `${template.sendAfterAmount} ${template.sendAfterUnit} delay`;
	}
</script>

<Dialog
	bind:open
	onOpenChange={(isOpen) => {
		if (!isOpen) selectedTemplate = null;
	}}
>
	<DialogContent class="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-4xl">
		<DialogHeader class="border-b border-border px-4 py-4 sm:px-6">
			<DialogTitle>Load template</DialogTitle>
			<DialogDescription>Select a saved template to preview it, then click Load.</DialogDescription>
		</DialogHeader>
		<div class="flex min-h-0 flex-1 flex-col md:h-[60vh] md:flex-row">
			<div
				class="max-h-48 shrink-0 overflow-y-auto border-b border-border md:max-h-none md:w-72 md:border-r md:border-b-0"
			>
				{#if isLoading}
					<div class="space-y-2 px-4 py-4">
						{#each [0, 1, 2] as i (i)}
							<Skeleton class="h-16 w-full rounded-lg" />
						{/each}
					</div>
				{:else if templates.length === 0}
					<div class="px-4 py-10 text-center text-sm text-muted-foreground">
						No saved templates yet. Use "Save template" to create one.
					</div>
				{:else}
					<div class="divide-y divide-border">
						{#each templates as template (template._id)}
							{@const isSelected = selectedTemplate?._id === template._id}
							<div
								class="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/30 {isSelected
									? 'bg-muted/40'
									: ''}"
							>
								<button
									class="min-w-0 flex-1 text-left"
									onclick={() => (selectedTemplate = template)}
								>
									<p class="truncate text-sm font-medium">{template.name}</p>
									<p class="mt-0.5 truncate text-xs text-muted-foreground">
										{formatDelay(template)}
									</p>
								</button>
								<div class="flex shrink-0 items-center gap-1">
									<Button size="sm" class="h-6 px-2 text-xs" onclick={() => onLoad(template)}>
										Load
									</Button>
									<button
										class="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
										onclick={() => onDelete(template)}
										disabled={deletingTemplateId === template._id}
										title="Delete template"
									>
										<TrashIcon class="size-3.5" />
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
				{#if selectedTemplate}
					<div class="space-y-4">
						<div class="space-y-1">
							<p
								class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
							>
								Subject
							</p>
							<p class="text-sm font-medium wrap-break-word">{selectedTemplate.subject}</p>
						</div>
						<div class="space-y-1">
							<p
								class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
							>
								Body
							</p>
							<WaiverRichText
								html={selectedTemplate.body}
								class="overflow-hidden rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm leading-7 wrap-break-word text-foreground"
							/>
						</div>
					</div>
				{:else}
					<div
						class="flex h-full min-h-[120px] items-center justify-center text-sm text-muted-foreground"
					>
						Select a template to preview it.
					</div>
				{/if}
			</div>
		</div>
		<div class="flex justify-end border-t border-border px-4 py-4 sm:px-6">
			<Button variant="outline" onclick={() => (open = false)}>Close</Button>
		</div>
	</DialogContent>
</Dialog>
