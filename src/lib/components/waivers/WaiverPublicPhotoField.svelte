<script lang="ts">
	import { waiverFieldLabelClass } from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		id: string;
		label: string;
		description: string;
		required: boolean;
		/** Which camera a phone opens first. */
		capture: 'user' | 'environment';
		file: File | null;
		disabled?: boolean;
	}

	let {
		id,
		label,
		description,
		required,
		capture,
		file = $bindable(),
		disabled = false
	}: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let error = $state<string | null>(null);
	const previewUrl = $derived(file ? URL.createObjectURL(file) : null);

	$effect(() => {
		const url = previewUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	function handleChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const selected = input.files?.[0] ?? null;
		input.value = '';
		if (!selected) return;
		if (!selected.type.startsWith('image/')) {
			error = 'Choose a photo (JPEG, PNG, or WebP).';
			return;
		}
		error = null;
		file = selected;
	}

	function removePhoto() {
		file = null;
		error = null;
	}
</script>

<div>
	<p class={waiverFieldLabelClass} id={`${id}-label`}>
		{label}
		{#if required}
			<span class="text-foreground/40">*</span>
		{:else}
			<span class="tracking-normal normal-case">(optional)</span>
		{/if}
	</p>
	<p class="mb-3 text-xs leading-relaxed text-muted-foreground">{description}</p>

	<input
		bind:this={fileInput}
		{id}
		type="file"
		accept="image/*"
		{capture}
		class="sr-only"
		aria-labelledby={`${id}-label`}
		{disabled}
		onchange={handleChange}
	/>

	{#if previewUrl}
		<div class="flex items-center gap-4">
			<img
				src={previewUrl}
				alt={`${label} preview`}
				class="h-24 w-24 shrink-0 border border-border object-cover"
			/>
			<div class="flex flex-col items-start gap-2">
				<button
					type="button"
					class="text-xs font-semibold tracking-wide underline-offset-4 hover:underline disabled:opacity-40"
					onclick={() => fileInput?.click()}
					{disabled}
				>
					Retake or replace
				</button>
				<button
					type="button"
					class="text-xs text-muted-foreground/70 hover:text-muted-foreground disabled:opacity-40"
					onclick={removePhoto}
					{disabled}
				>
					Remove
				</button>
			</div>
		</div>
	{:else}
		<button
			type="button"
			class="inline-flex h-11 items-center justify-center border border-dashed border-foreground/30 px-4 text-sm font-medium transition-colors hover:border-foreground/60 disabled:opacity-40"
			onclick={() => fileInput?.click()}
			{disabled}
		>
			Take or choose photo
		</button>
	{/if}

	{#if error}
		<p class="mt-2 text-xs text-destructive">{error}</p>
	{/if}
</div>
