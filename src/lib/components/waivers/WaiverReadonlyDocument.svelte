<script lang="ts">
	import type { WaiverField } from '$lib/domain/waivers';
	import WaiverPublicAboutSignerCard from '$lib/components/waivers/WaiverPublicAboutSignerCard.svelte';
	import WaiverPublicAdditionalInfoSection from '$lib/components/waivers/WaiverPublicAdditionalInfoSection.svelte';
	import WaiverPublicIntroCard from '$lib/components/waivers/WaiverPublicIntroCard.svelte';
	import WaiverPublicMinorsBlock from '$lib/components/waivers/WaiverPublicMinorsBlock.svelte';
	import WaiverPublicSignatureAreaPreview from '$lib/components/waivers/WaiverPublicSignatureAreaPreview.svelte';
	import WaiverPublicSignatureCard from '$lib/components/waivers/WaiverPublicSignatureCard.svelte';
	import {
		waiverAddMinorButtonClass,
		waiverFieldLabelClass,
		waiverUnderlineInputClass,
		waiverUnderlineTextareaClass
	} from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		workspaceName?: string;
		title: string;
		introCopy: string;
		fields: WaiverField[];
		preview?: boolean;
		signerName?: string;
		signerEmail?: string;
		signerDateOfBirth?: string;
		minors?: string[];
		answers?: Record<string, string | boolean | null>;
		signatureDataUrl?: string;
		submittedAt?: number;
	}

	let {
		workspaceName,
		title,
		introCopy,
		fields,
		preview = false,
		signerName = '',
		signerEmail = '',
		signerDateOfBirth = '',
		minors = [],
		answers = {},
		signatureDataUrl = '',
		submittedAt
	}: Props = $props();

	function formatTimestamp(ts: number) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(
			new Date(ts)
		);
	}

	function formatDob(dob: string) {
		const [y, m, d] = dob.split('-').map(Number);
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(y, m - 1, d));
	}

	function answerDisplay(field: WaiverField): string {
		const value = answers[field.id];
		if (value === null || value === undefined || value === '') return '—';
		if (field.type === 'checkbox') return value === true ? 'Yes' : 'No';
		if (field.type === 'date' && typeof value === 'string') return formatDob(value);
		return String(value);
	}

	function sampleValue(field: WaiverField) {
		switch (field.type) {
			case 'shortText':
				return 'Sample answer';
			case 'longText':
				return 'Guests will fill this out before signing the waiver.';
			case 'select':
				return field.options[0]?.label ?? 'Choose one';
			case 'date':
				return 'YYYY-MM-DD';
			case 'checkbox':
				return field.label;
		}
	}
</script>

<div class="bg-background">
	{#if workspaceName}
		<header class="border-b border-border/40 px-6 py-4">
			<p class="text-center text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
				{workspaceName}
			</p>
		</header>
	{/if}

	<div class="mx-auto max-w-2xl space-y-6 px-6 py-12">
		<WaiverPublicIntroCard {title} {introCopy} />

		<WaiverPublicAboutSignerCard>
			<div class="space-y-6">
				<div>
					<div class={waiverFieldLabelClass}>Full name</div>
					<div
						class={`${waiverUnderlineInputClass} ${preview ? 'pointer-events-none text-muted-foreground/45 select-none' : 'cursor-default'}`}
						aria-hidden={preview}
					>
						{preview ? 'Preview value' : signerName}
					</div>
				</div>

				<div>
					<div class={waiverFieldLabelClass}>Email</div>
					<div
						class={`${waiverUnderlineInputClass} ${preview ? 'pointer-events-none text-muted-foreground/45 select-none' : 'cursor-default'}`}
						aria-hidden={preview}
					>
						{preview ? 'Preview value' : signerEmail}
					</div>
				</div>

				<div>
					<div class={waiverFieldLabelClass}>Date of birth</div>
					<div
						class={`${waiverUnderlineInputClass} ${preview ? 'pointer-events-none text-muted-foreground/45 select-none' : 'cursor-default'}`}
						aria-hidden={preview}
					>
						{preview ? 'YYYY-MM-DD' : signerDateOfBirth ? formatDob(signerDateOfBirth) : '—'}
					</div>
				</div>
			</div>

			{#if preview}
				<WaiverPublicMinorsBlock>
					{#snippet headerActions()}
						<button type="button" class={waiverAddMinorButtonClass} disabled aria-hidden="true">
							Add minor
						</button>
					{/snippet}
					{#snippet body()}{/snippet}
				</WaiverPublicMinorsBlock>
			{:else if minors.length > 0}
				<WaiverPublicMinorsBlock>
					{#snippet headerActions()}{/snippet}
					{#snippet body()}
						<div class="space-y-4">
							{#each minors as name, index (index)}
								<div>
									<div class={waiverFieldLabelClass}>Minor {index + 1}</div>
									<div class={`${waiverUnderlineInputClass} cursor-default`}>{name}</div>
								</div>
							{/each}
						</div>
					{/snippet}
				</WaiverPublicMinorsBlock>
			{/if}

			{#if fields.length > 0}
				<WaiverPublicAdditionalInfoSection>
					{#each fields as field (field.id)}
						<div>
							<div class={waiverFieldLabelClass}>
								{field.label}
								{#if field.required}
									<span class="text-foreground/40">*</span>
								{/if}
							</div>

							{#if field.type === 'checkbox'}
								{#if preview}
									<div class="mt-2 flex items-center gap-3" aria-hidden="true">
										<span
											class="flex h-5 w-5 shrink-0 items-center justify-center border border-foreground/25 bg-transparent"
										></span>
										<span class="text-sm">{field.label}</span>
									</div>
								{:else}
									<div class="mt-2 flex items-center gap-3">
										<span
											class="flex h-5 w-5 shrink-0 items-center justify-center border border-foreground/25"
											class:bg-foreground={answers[field.id] === true}
										>
											{#if answers[field.id] === true}
												<svg
													class="h-3 w-3 text-background"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													stroke-width="3"
												>
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
												</svg>
											{/if}
										</span>
										<span class="text-sm">{field.label}</span>
									</div>
								{/if}
							{:else if field.type === 'longText'}
								<div
									class={`${waiverUnderlineTextareaClass} ${preview ? 'pointer-events-none min-h-21 whitespace-pre-wrap text-muted-foreground/45 select-none' : 'min-h-21 whitespace-pre-wrap'}`}
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
					{/each}
				</WaiverPublicAdditionalInfoSection>
			{/if}
		</WaiverPublicAboutSignerCard>

		<WaiverPublicSignatureCard>
			{#if preview}
				<WaiverPublicSignatureAreaPreview />
			{:else}
				<div class="space-y-5">
					<div class="overflow-hidden rounded-2xl border border-border bg-white p-4">
						<img
							src={signatureDataUrl}
							alt="Signature"
							class="mx-auto max-h-28 w-full object-contain"
						/>
					</div>

					{#if submittedAt}
						<p class="text-xs text-muted-foreground">
							Signed and submitted on {formatTimestamp(submittedAt)}
						</p>
					{/if}
				</div>
			{/if}
		</WaiverPublicSignatureCard>
	</div>
</div>
