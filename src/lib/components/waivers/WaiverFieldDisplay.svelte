<script lang="ts">
	import type { WaiverAnswerValue, WaiverField } from '$lib/domain/waivers';
	import { compositeParts, formatAnswerDisplay, isAnswerFlagged } from '$lib/domain/waiver-fields';
	import {
		waiverFieldLabelClass,
		waiverUnderlineInputClass,
		waiverUnderlineTextareaClass
	} from '$lib/components/waivers/waiver-public-form-classes';
	import FlagIcon from '@lucide/svelte/icons/flag';

	interface Props {
		field: WaiverField;
		value?: WaiverAnswerValue;
		preview?: boolean;
	}

	let { field, value = null, preview = false }: Props = $props();

	const flagged = $derived(!preview && isAnswerFlagged(field, value));
	const previewClass = 'pointer-events-none text-muted-foreground/45 select-none';

	function sampleValue(field: WaiverField) {
		switch (field.type) {
			case 'text':
				return 'Sample answer';
			case 'select':
				return field.options[0]?.label ?? 'Choose one';
			case 'date':
				return 'YYYY-MM-DD';
			case 'phone':
				return '(555) 123-4567';
			case 'number':
				return field.min !== undefined ? String(field.min) : '0';
			default:
				return field.label;
		}
	}

	function selectedOptionIds(): string[] {
		return Array.isArray(value) ? value : [];
	}

	function compositeValue(key: string): string {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			return value[key] ?? '';
		}
		return '';
	}
</script>

<div class={flagged ? '-mx-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2' : ''}>
	{#if flagged}
		<p
			class="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400"
		>
			<FlagIcon class="size-3" aria-hidden="true" />
			Flagged for review
		</p>
	{/if}

	{#if field.type !== 'checkbox'}
		<div class={waiverFieldLabelClass}>
			{field.label}
			{#if field.required}
				<span class="text-foreground/40">*</span>
			{/if}
		</div>
	{/if}

	{#if field.type === 'checkbox'}
		<div class="flex items-center gap-3" role="checkbox" aria-checked={value === true}>
			<span
				class="flex h-5 w-5 shrink-0 items-center justify-center border border-foreground/25 bg-transparent"
				class:bg-foreground={!preview && value === true}
				aria-hidden={preview ? 'true' : undefined}
			>
				{#if !preview && value === true}
					<svg
						class="h-3 w-3 text-background"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="3"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				{/if}
			</span>
			<span class="text-sm">
				{field.label}
				{#if field.required}
					<span class="text-foreground/40">*</span>
				{/if}
			</span>
		</div>
	{:else if field.type === 'multiselect'}
		<ul class="mt-2 space-y-2" aria-hidden={preview}>
			{#each field.options as option (option.id)}
				{@const checked = !preview && selectedOptionIds().includes(option.id)}
				<li class="flex items-center gap-3 text-sm">
					<span
						class="flex h-4 w-4 shrink-0 items-center justify-center border border-foreground/25"
						class:bg-foreground={checked}
						aria-hidden="true"
					>
						{#if checked}
							<svg
								class="h-2.5 w-2.5 text-background"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="3"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</span>
					<span class={preview ? 'text-muted-foreground/70' : checked ? '' : 'text-foreground/50'}>
						{option.label}
					</span>
					{#if checked}<span class="sr-only">(selected)</span>{/if}
				</li>
			{/each}
		</ul>
	{:else if field.type === 'address' || field.type === 'emergency_contact'}
		{#if preview}
			<div class="grid gap-x-4 sm:grid-cols-2" aria-hidden="true">
				{#each compositeParts(field.type) as part (part.key)}
					<div class={`${waiverUnderlineInputClass} ${previewClass}`}>{part.label}</div>
				{/each}
			</div>
		{:else}
			<dl class="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2">
				{#each compositeParts(field.type) as part (part.key)}
					<div class="border-b border-foreground/20 py-2">
						<dt class="text-[11px] text-muted-foreground">{part.label}</dt>
						<dd class="text-base">{compositeValue(part.key) || '—'}</dd>
					</div>
				{/each}
			</dl>
		{/if}
	{:else if field.type === 'initials'}
		<div class="mt-2 rounded-lg border border-border bg-muted/20 p-4">
			<p class="text-sm leading-relaxed whitespace-pre-wrap">{field.clause}</p>
			<div class="mt-3 flex items-center gap-3">
				<span class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
					Initials
				</span>
				<span
					class={`min-w-20 border-b border-foreground/30 px-1 py-1 font-semibold tracking-widest ${preview ? previewClass : ''}`}
				>
					{preview ? 'AB' : formatAnswerDisplay(field, value)}
				</span>
			</div>
		</div>
	{:else if field.type === 'text'}
		<div
			class={`${waiverUnderlineTextareaClass} ${preview ? `${previewClass} min-h-13 whitespace-pre-wrap` : 'min-h-13 whitespace-pre-wrap'}`}
			aria-hidden={preview}
		>
			{preview ? sampleValue(field) : formatAnswerDisplay(field, value)}
		</div>
	{:else}
		<div
			class={`${waiverUnderlineInputClass} ${preview ? previewClass : 'cursor-default'}`}
			aria-hidden={preview}
		>
			{preview ? sampleValue(field) : formatAnswerDisplay(field, value)}
		</div>
	{/if}
</div>
