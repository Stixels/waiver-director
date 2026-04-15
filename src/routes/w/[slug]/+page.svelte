<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import SignaturePad from '$lib/components/waivers/SignaturePad.svelte';
	import WaiverPublicAboutSignerCard from '$lib/components/waivers/WaiverPublicAboutSignerCard.svelte';
	import WaiverPublicAdditionalInfoSection from '$lib/components/waivers/WaiverPublicAdditionalInfoSection.svelte';
	import WaiverPublicIntroCard from '$lib/components/waivers/WaiverPublicIntroCard.svelte';
	import WaiverPublicMinorsBlock from '$lib/components/waivers/WaiverPublicMinorsBlock.svelte';
	import WaiverPublicSignatureCard from '$lib/components/waivers/WaiverPublicSignatureCard.svelte';
	import {
		waiverAddMinorButtonClass,
		waiverFieldLabelClass,
		waiverUnderlineInputClass,
		waiverUnderlineTextareaClass
	} from '$lib/components/waivers/waiver-public-form-classes';
	import type { WaiverMinor } from '$lib/domain/waivers';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	let { data } = $props();

	const convex = useConvexClient();
	type PublicWaiverData = NonNullable<FunctionReturnType<typeof api.waivers.getPublicWaiverBySlug>>;
	const waiver = $derived(data.waiver as PublicWaiverData);

	let signerName = $state('');
	let signerEmail = $state('');
	let signerDateOfBirth = $state('');
	let signatureDataUrl = $state('');
	let answers = $state<Record<string, string | boolean | null>>({});
	let minors = $state<WaiverMinor[]>([]);
	let isSubmitting = $state(false);
	let submitError = $state<string | null>(null);
	let isSubmitted = $state(false);

	function addMinor() {
		minors.push({ fullName: '' });
	}

	function removeMinor(index: number) {
		minors.splice(index, 1);
	}

	function setFieldAnswer(fieldId: string, value: string | boolean | null) {
		answers[fieldId] = value;
	}

	function currentStringAnswer(fieldId: string): string {
		const value = answers[fieldId];
		return typeof value === 'string' ? value : '';
	}

	function currentBooleanAnswer(fieldId: string): boolean {
		return answers[fieldId] === true;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (convex.disabled) {
			submitError = 'The waiver form is still loading. Please try again.';
			return;
		}

		isSubmitting = true;
		submitError = null;

		try {
			await convex.mutation(api.waivers.submitPublicWaiver, {
				slug: waiver.slug,
				versionId: waiver.versionId,
				signerName,
				signerEmail,
				signerDateOfBirth,
				signatureDataUrl,
				answers,
				minors
			});

			isSubmitted = true;
			toast.success('Waiver submitted.');
		} catch (error) {
			submitError = getConvexErrorMessage(error, 'Unable to submit this waiver.');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>{waiver.title} | {waiver.workspaceName}</title>
</svelte:head>

<div class={`min-h-screen bg-background ${data.embed ? '' : ''}`}>
	<!-- Workspace header -->
	<header class="border-b border-border/40 px-6 py-4">
		<p class="text-center text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
			{waiver.workspaceName}
		</p>
	</header>

	<div class={`mx-auto px-6 ${data.embed ? 'max-w-none py-8' : 'max-w-2xl py-12'}`}>
		{#if isSubmitted}
			<!-- Success state -->
			<div class="flex flex-col items-center py-24 text-center">
				<div
					class="mb-8 flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground/20"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-foreground/60"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
				<p class="mb-2 text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
					Submission received
				</p>
				<h1 class="mb-4 text-3xl font-bold tracking-tight">Waiver complete</h1>
				<p class="max-w-sm text-base leading-relaxed text-muted-foreground">
					Thank you. Your signed waiver has been recorded for {waiver.workspaceName}.
				</p>
			</div>
		{:else}
			<div class="space-y-6">
				<WaiverPublicIntroCard title={waiver.title} introCopy={waiver.introCopy} />

				<form onsubmit={handleSubmit} class="space-y-6">
					<WaiverPublicAboutSignerCard>
						<div class="space-y-6">
							<div>
								<label class={waiverFieldLabelClass} for="signer-name">Full name</label>
								<input
									id="signer-name"
									class={waiverUnderlineInputClass}
									bind:value={signerName}
									required
									maxlength={120}
								/>
							</div>

							<div>
								<label class={waiverFieldLabelClass} for="signer-email">Email</label>
								<input
									id="signer-email"
									type="email"
									class={waiverUnderlineInputClass}
									bind:value={signerEmail}
									required
								/>
							</div>

							<div>
								<label class={waiverFieldLabelClass} for="signer-dob">Date of birth</label>
								<input
									id="signer-dob"
									type="date"
									class={waiverUnderlineInputClass}
									bind:value={signerDateOfBirth}
									required
								/>
							</div>
						</div>

						<WaiverPublicMinorsBlock>
							{#snippet headerActions()}
								<button type="button" class={waiverAddMinorButtonClass} onclick={addMinor}>
									Add minor
								</button>
							{/snippet}
							{#snippet body()}
								{#if minors.length > 0}
									<div class="space-y-6">
										{#each minors as minor, index (index)}
											<div>
												<div class="mb-3 flex items-center justify-between gap-3">
													<p
														class="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase"
													>
														Minor {index + 1}
													</p>
													<button
														type="button"
														class="text-xs text-muted-foreground/60 hover:text-muted-foreground"
														onclick={() => removeMinor(index)}
													>
														Remove
													</button>
												</div>

												<label class={waiverFieldLabelClass} for={`minor-name-${index}`}>
													Full name
												</label>
												<input
													id={`minor-name-${index}`}
													class={waiverUnderlineInputClass}
													bind:value={minor.fullName}
													required
												/>
											</div>
										{/each}
									</div>
								{/if}
							{/snippet}
						</WaiverPublicMinorsBlock>

						{#if waiver.fields.length > 0}
							<WaiverPublicAdditionalInfoSection>
								{#each waiver.fields as field (field.id)}
									<div>
										<label class={waiverFieldLabelClass} for={field.id}>
											{field.label}
											{#if field.required}
												<span class="text-foreground/40">*</span>
											{/if}
										</label>

										{#if field.type === 'shortText'}
											<input
												id={field.id}
												class={waiverUnderlineInputClass}
												value={currentStringAnswer(field.id)}
												placeholder={field.placeholder ?? ''}
												oninput={(event) =>
													setFieldAnswer(field.id, (event.currentTarget as HTMLInputElement).value)}
											/>
										{:else if field.type === 'longText'}
											<textarea
												id={field.id}
												class={waiverUnderlineTextareaClass}
												rows={3}
												value={currentStringAnswer(field.id)}
												placeholder={field.placeholder ?? ''}
												oninput={(event) =>
													setFieldAnswer(
														field.id,
														(event.currentTarget as HTMLTextAreaElement).value
													)}
											></textarea>
										{:else if field.type === 'checkbox'}
											<label class="mt-2 flex cursor-pointer items-center gap-3">
												<span
													class={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${currentBooleanAnswer(field.id) ? 'border-foreground bg-foreground' : 'border-foreground/25 bg-transparent'}`}
												>
													{#if currentBooleanAnswer(field.id)}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="12"
															height="12"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2.5"
															stroke-linecap="round"
															stroke-linejoin="round"
															class="text-background"
														>
															<polyline points="20 6 9 17 4 12" />
														</svg>
													{/if}
												</span>
												<input
													type="checkbox"
													class="sr-only"
													checked={currentBooleanAnswer(field.id)}
													onchange={(event) =>
														setFieldAnswer(
															field.id,
															(event.currentTarget as HTMLInputElement).checked
														)}
												/>
												<span class="text-sm">{field.label}</span>
											</label>
										{:else if field.type === 'select'}
											<select
												id={field.id}
												class={waiverUnderlineInputClass}
												value={currentStringAnswer(field.id)}
												onchange={(event) =>
													setFieldAnswer(
														field.id,
														(event.currentTarget as HTMLSelectElement).value
													)}
											>
												<option value="">Select one</option>
												{#each field.options as option (option.id)}
													<option value={option.id}>{option.label}</option>
												{/each}
											</select>
										{:else if field.type === 'date'}
											<input
												id={field.id}
												type="date"
												class={waiverUnderlineInputClass}
												value={currentStringAnswer(field.id)}
												oninput={(event) =>
													setFieldAnswer(field.id, (event.currentTarget as HTMLInputElement).value)}
											/>
										{/if}
									</div>
								{/each}
							</WaiverPublicAdditionalInfoSection>
						{/if}
					</WaiverPublicAboutSignerCard>

					<WaiverPublicSignatureCard>
						<SignaturePad bind:value={signatureDataUrl} canvasId="signature-pad" />
					</WaiverPublicSignatureCard>

					{#if submitError}
						<p class="text-sm text-destructive">
							{submitError}
						</p>
					{/if}

					<div class="pb-16">
						<button
							type="submit"
							class="h-12 w-full bg-foreground text-sm font-semibold tracking-wide text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Submitting…' : 'Submit waiver'}
						</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>
