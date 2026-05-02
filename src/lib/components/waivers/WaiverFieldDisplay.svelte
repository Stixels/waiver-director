<script lang="ts">
	import type { WaiverField } from '$lib/domain/waivers';
	import {
		waiverFieldLabelClass,
		waiverUnderlineInputClass,
		waiverUnderlineTextareaClass
	} from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		field: WaiverField;
		value?: string | boolean | null;
		preview?: boolean;
	}

	let { field, value = null, preview = false }: Props = $props();

	function sampleValue(field: WaiverField) {
		switch (field.type) {
			case 'text':
				return 'Sample answer';
			case 'select':
				return field.options[0]?.label ?? 'Choose one';
			case 'date':
				return 'YYYY-MM-DD';
			case 'checkbox':
				return field.label;
		}
	}

	function answerDisplay(field: WaiverField): string {
		if (value === null || value === undefined || value === '') return '—';
		if (field.type === 'checkbox') return value === true ? 'Yes' : 'No';
		if (field.type === 'select' && typeof value === 'string') {
			return field.options.find((option) => option.id === value)?.label ?? String(value);
		}
		return String(value);
	}
</script>

<div>
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
	{:else if field.type === 'text'}
		<div
			class={`${waiverUnderlineTextareaClass} ${preview ? 'pointer-events-none min-h-13 whitespace-pre-wrap text-muted-foreground/45 select-none' : 'min-h-13 whitespace-pre-wrap'}`}
			aria-hidden={preview}
		>
			{preview ? sampleValue(field) : answerDisplay(field)}
		</div>
	{:else}
		<div
			class={`${waiverUnderlineInputClass} ${preview ? 'pointer-events-none text-muted-foreground/45 select-none' : 'cursor-default'}`}
			aria-hidden={preview}
		>
			{preview ? sampleValue(field) : answerDisplay(field)}
		</div>
	{/if}
</div>
