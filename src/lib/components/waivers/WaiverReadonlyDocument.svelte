<script lang="ts">
	import type { WaiverField, WaiverTheme } from '$lib/domain/waivers';
	import WaiverCopySection from '$lib/components/waivers/WaiverCopySection.svelte';
	import WaiverDocumentShell from '$lib/components/waivers/WaiverDocumentShell.svelte';
	import WaiverFieldDisplay from '$lib/components/waivers/WaiverFieldDisplay.svelte';
	import WaiverPublicAboutSignerCard from '$lib/components/waivers/WaiverPublicAboutSignerCard.svelte';
	import WaiverPublicAdditionalInfoSection from '$lib/components/waivers/WaiverPublicAdditionalInfoSection.svelte';
	import WaiverPublicMinorsBlock from '$lib/components/waivers/WaiverPublicMinorsBlock.svelte';
	import WaiverPublicSignatureAreaPreview from '$lib/components/waivers/WaiverPublicSignatureAreaPreview.svelte';
	import {
		waiverAddMinorButtonClass,
		waiverFieldLabelClass,
		waiverUnderlineInputClass
	} from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		workspaceName?: string;
		introCopy: string;
		fields: WaiverField[];
		theme?: WaiverTheme;
		preview?: boolean;
		signerName?: string;
		signerEmail?: string;
		signerDateOfBirth?: string;
		minors?: string[];
		answers?: Record<string, string | boolean | null>;
		marketingConsent?: boolean;
		marketingConsentLabel?: string | null;
		signatureDataUrl?: string;
		submittedAt?: number;
	}

	let {
		workspaceName,
		introCopy,
		fields,
		theme = 'dark',
		preview = false,
		signerName = '',
		signerEmail = '',
		signerDateOfBirth = '',
		minors = [],
		answers = {},
		marketingConsent = false,
		marketingConsentLabel = null,
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
</script>

<div
	class="bg-background text-foreground"
	class:waiver-theme-light={theme === 'light'}
	class:waiver-theme-dark={theme === 'dark'}
>
	<WaiverDocumentShell {workspaceName}>
		<WaiverCopySection {introCopy} />

		<div class="mt-6">
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
							<WaiverFieldDisplay {field} value={answers[field.id]} {preview} />
						{/each}
					</WaiverPublicAdditionalInfoSection>
				{/if}

				{#if !preview && marketingConsentLabel}
					<div class="mt-8 border-t border-border pt-8">
						<h3 class="mb-4 text-lg font-semibold tracking-tight">Marketing consent</h3>
						<p class="text-sm">{marketingConsentLabel}</p>
						<p class="mt-2 text-sm font-semibold">
							{marketingConsent ? 'Opted in' : 'Did not opt in'}
						</p>
					</div>
				{/if}

				<div class="mt-8 border-t border-border pt-8">
					<div class="mb-7">
						<h3 class="text-lg font-semibold tracking-tight">Signature</h3>
					</div>
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
				</div>
			</WaiverPublicAboutSignerCard>
		</div>
	</WaiverDocumentShell>
</div>
