<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import {
		WAIVER_TEMPLATE_LEGAL_NOTICE,
		waiverTemplates,
		type WaiverTemplate
	} from '$lib/domain/waiver-templates';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import CheckIcon from '@lucide/svelte/icons/check';

	interface Props {
		open?: boolean;
		/** When true, applying a template will replace existing draft content. */
		replacesContent?: boolean;
		onApply: (template: WaiverTemplate) => void;
	}

	let { open = $bindable(false), replacesContent = false, onApply }: Props = $props();

	let selectedId = $state<string | null>(null);
	const selected = $derived(waiverTemplates.find((template) => template.id === selectedId) ?? null);

	$effect(() => {
		if (!open) selectedId = null;
	});

	function apply() {
		if (!selected) return;
		onApply(selected);
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90dvh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle>Start from a template</DialogTitle>
			<DialogDescription>
				Pick an activity to fill in starter waiver copy and custom fields. You can edit everything
				before you publish.
			</DialogDescription>
		</DialogHeader>

		<div
			class="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[13px] text-foreground"
			role="note"
		>
			<ScaleIcon class="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
			<p>{WAIVER_TEMPLATE_LEGAL_NOTICE}</p>
		</div>

		<div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Waiver templates">
			{#each waiverTemplates as template (template.id)}
				{@const isSelected = template.id === selectedId}
				<button
					type="button"
					role="radio"
					aria-checked={isSelected}
					class="relative flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none {isSelected
						? 'border-primary bg-primary/5'
						: 'border-border'}"
					onclick={() => (selectedId = template.id)}
				>
					<span class="pr-6 text-sm font-medium">{template.name}</span>
					<span class="text-[12px] text-muted-foreground">{template.activities}</span>
					<span class="text-[12px] text-muted-foreground/80">{template.description}</span>
					<span class="text-[11px] text-muted-foreground/70">
						{template.fields.length} custom fields
					</span>
					{#if isSelected}
						<CheckIcon class="absolute top-2.5 right-2.5 size-4 text-primary" aria-hidden="true" />
					{/if}
				</button>
			{/each}
		</div>

		{#if replacesContent}
			<p class="text-[12px] text-muted-foreground">
				Applying a template replaces the current draft's title, copy and custom fields. Your
				published version is not changed until you publish again.
			</p>
		{/if}

		<DialogFooter>
			<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button type="button" onclick={apply} disabled={!selected}>
				{replacesContent ? 'Replace draft' : 'Use template'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
