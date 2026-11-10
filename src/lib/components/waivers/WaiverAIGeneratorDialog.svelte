<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		WAIVER_AI_LEGAL_NOTICE,
		WAIVER_AI_MAX_DESCRIPTION_LENGTH,
		WAIVER_AI_MAX_LOCATION_LENGTH,
		WAIVER_AI_MIN_DESCRIPTION_LENGTH,
		type WaiverAIDraft
	} from '$lib/domain/waiver-ai';
	import { formatFieldTypeLabel } from '$lib/domain/waivers';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';

	interface Props {
		open?: boolean;
		workspaceId: string;
		workspaceSlug: string;
		/** When true, applying the draft replaces existing draft content. */
		replacesContent?: boolean;
		onApply: (draft: WaiverAIDraft) => void;
	}

	let {
		open = $bindable(false),
		workspaceId,
		workspaceSlug,
		replacesContent = false,
		onApply
	}: Props = $props();

	let description = $state('');
	let location = $state('');
	let isGenerating = $state(false);
	let errorMessage = $state<string | null>(null);
	let result = $state<WaiverAIDraft | null>(null);
	let controller: AbortController | null = null;

	const trimmedLength = $derived(description.trim().length);
	const canGenerate = $derived(
		!isGenerating &&
			trimmedLength >= WAIVER_AI_MIN_DESCRIPTION_LENGTH &&
			trimmedLength <= WAIVER_AI_MAX_DESCRIPTION_LENGTH
	);

	$effect(() => {
		if (open) return;
		controller?.abort();
		controller = null;
		isGenerating = false;
		errorMessage = null;
		result = null;
	});

	async function generate() {
		if (!canGenerate) return;
		controller?.abort();
		const current = new AbortController();
		controller = current;
		isGenerating = true;
		errorMessage = null;
		result = null;

		try {
			const response = await fetch(resolve(`/app/${workspaceSlug}/waiver/ai` as const), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ workspaceId, description, location }),
				signal: current.signal
			});
			const payload = (await response.json().catch(() => null)) as
				| (WaiverAIDraft & { message?: string })
				| null;

			if (!response.ok || !payload) {
				errorMessage = payload?.message ?? 'Unable to generate a waiver draft right now.';
				return;
			}
			result = payload;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = 'Unable to reach the AI waiver generator.';
		} finally {
			if (controller === current) {
				controller = null;
				isGenerating = false;
			}
		}
	}

	function apply() {
		if (!result) return;
		onApply(result);
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-h-[90dvh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<SparklesIcon class="size-4 text-primary" aria-hidden="true" />
				Generate a waiver with AI
			</DialogTitle>
			<DialogDescription>
				Describe your activity and get a first draft of waiver copy and custom fields. You can edit
				everything before you publish.
			</DialogDescription>
		</DialogHeader>

		<div
			class="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[13px] text-foreground"
			role="note"
		>
			<ScaleIcon class="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
			<p>{WAIVER_AI_LEGAL_NOTICE}</p>
		</div>

		{#if !result}
			<form
				class="grid gap-4"
				onsubmit={(event) => {
					event.preventDefault();
					void generate();
				}}
			>
				<div class="grid gap-1.5">
					<Label for="waiver-ai-description">What do participants do?</Label>
					<Textarea
						id="waiver-ai-description"
						bind:value={description}
						rows={5}
						maxlength={WAIVER_AI_MAX_DESCRIPTION_LENGTH}
						disabled={isGenerating}
						placeholder="Guided half-day sea kayak tours for beginners, ages 12 and up. We provide kayaks, paddles and life jackets. Tours run in open water along the coast."
					/>
					<p class="text-[12px] text-muted-foreground">
						Include the activity, who takes part, equipment, and anything unusual about the setting.
						<span class="tabular-nums">{trimmedLength}/{WAIVER_AI_MAX_DESCRIPTION_LENGTH}</span>
					</p>
				</div>
				<div class="grid gap-1.5">
					<Label for="waiver-ai-location">Location (optional)</Label>
					<Input
						id="waiver-ai-location"
						bind:value={location}
						maxlength={WAIVER_AI_MAX_LOCATION_LENGTH}
						disabled={isGenerating}
						placeholder="Vancouver Island, Canada"
					/>
				</div>

				{#if errorMessage}
					<div
						class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
						role="alert"
					>
						<AlertCircleIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						<p>{errorMessage}</p>
					</div>
				{/if}

				<DialogFooter>
					<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
					<Button type="submit" disabled={!canGenerate} class="gap-1.5">
						{#if isGenerating}
							<LoaderIcon class="size-4 animate-spin" aria-hidden="true" />
							Drafting…
						{:else}
							<SparklesIcon class="size-4" aria-hidden="true" />
							Generate draft
						{/if}
					</Button>
				</DialogFooter>
			</form>
		{:else}
			<div class="grid gap-4">
				<div class="grid gap-1">
					<p class="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Title</p>
					<p class="text-sm font-medium">{result.title}</p>
				</div>

				<div class="grid gap-1.5">
					<p class="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
						Custom fields ({result.fields.length})
					</p>
					{#if result.fields.length === 0}
						<p class="text-[13px] text-muted-foreground">No custom fields were suggested.</p>
					{:else}
						<ul class="grid gap-1 text-[13px]">
							{#each result.fields as field (field.id)}
								<li class="flex items-baseline justify-between gap-3">
									<span>{field.label}{field.required ? ' *' : ''}</span>
									<span class="shrink-0 text-[12px] text-muted-foreground">
										{formatFieldTypeLabel(field.type)}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				{#if result.notes.length > 0}
					<div class="grid gap-1.5">
						<p class="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
							Check before publishing
						</p>
						<ul class="list-disc space-y-1 pl-5 text-[13px]">
							{#each result.notes as note (note)}
								<li>{note}</li>
							{/each}
						</ul>
					</div>
				{/if}

				<p class="text-[12px] text-muted-foreground">
					{replacesContent
						? "Using this draft replaces the current draft's title, copy and custom fields. "
						: ''}Your published version is not changed until you publish again.
				</p>

				<DialogFooter>
					<Button type="button" variant="outline" onclick={() => (result = null)}>Back</Button>
					<Button type="button" variant="outline" onclick={generate} disabled={!canGenerate}>
						Try again
					</Button>
					<Button type="button" onclick={apply}>
						{replacesContent ? 'Replace draft' : 'Use draft'}
					</Button>
				</DialogFooter>
			</div>
		{/if}
	</DialogContent>
</Dialog>
