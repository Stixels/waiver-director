<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import SignaturePad from '$lib/components/waivers/SignaturePad.svelte';
	import WaiverCopySection from '$lib/components/waivers/WaiverCopySection.svelte';
	import WaiverDocumentShell from '$lib/components/waivers/WaiverDocumentShell.svelte';
	import WaiverPublicAboutSignerCard from '$lib/components/waivers/WaiverPublicAboutSignerCard.svelte';
	import WaiverPublicAdditionalInfoSection from '$lib/components/waivers/WaiverPublicAdditionalInfoSection.svelte';
	import WaiverPublicMinorsBlock from '$lib/components/waivers/WaiverPublicMinorsBlock.svelte';
	import {
		waiverAddMinorButtonClass,
		waiverFieldLabelClass,
		waiverUnderlineInputClass,
		waiverUnderlineTextareaClass
	} from '$lib/components/waivers/waiver-public-form-classes';
	import type { WaiverField, WaiverMinor } from '$lib/domain/waivers';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { formatBookingTimestamp } from '$lib/utils/date';

	type PublicWaiver = {
		slug: string;
		versionId: Id<'waiver_versions'>;
		workspaceName: string;
		title: string;
		introCopy: string;
		fields: WaiverField[];
	};

	type BookingContext = {
		lookupToken: string;
		activityName: string;
		startTime: string | null;
		endTime: string | null;
		leadCustomerName: string | null;
		participantCount: number;
		signedCount: number;
	};
	type MinorFormState = WaiverMinor & { _uid: string };

	interface Props {
		waiver: PublicWaiver;
		booking?: BookingContext | null;
	}

	let { waiver, booking = null }: Props = $props();

	const convex = useConvexClient();

	let signerName = $state('');
	let signerEmail = $state('');
	let signerDateOfBirth = $state('');
	let signatureDataUrl = $state('');
	let answers = $state<Record<string, string | boolean | null>>({});
	let minors = $state<MinorFormState[]>([]);
	let isSubmitting = $state(false);
	let submitError = $state<string | null>(null);
	let isSubmitted = $state(false);

	function addMinor() {
		minors.push({ _uid: crypto.randomUUID(), fullName: '' });
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

		if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
			submitError = 'Please provide a signature.';
			return;
		}

		isSubmitting = true;
		submitError = null;
		const minorsPayload = minors.map((minor) => ({ fullName: minor.fullName }));

		try {
			await convex.mutation(api.waivers.submitPublicWaiver, {
				slug: waiver.slug,
				versionId: waiver.versionId,
				...(booking ? { bookingLookupToken: booking.lookupToken } : {}),
				signerName,
				signerEmail,
				signerDateOfBirth,
				signatureDataUrl,
				answers,
				minors: minorsPayload
			});

			isSubmitted = true;
			toast.success('Waiver submitted.');
		} catch (error) {
			submitError = getConvexErrorMessage(error, 'Unable to submit this waiver.');
		} finally {
			isSubmitting = false;
		}
	}

	function resetForm() {
		signerName = '';
		signerEmail = '';
		signerDateOfBirth = '';
		signatureDataUrl = '';
		answers = {};
		minors = [];
		submitError = null;
		isSubmitted = false;
	}
</script>

<div class="min-h-screen bg-background">
	<WaiverDocumentShell workspaceName={waiver.workspaceName}>
		{#if isSubmitted}
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
				{#if booking}
					<button
						type="button"
						class="mt-8 h-12 bg-foreground px-8 text-sm font-semibold tracking-wide text-background transition-opacity hover:opacity-85"
						onclick={resetForm}
					>
						Sign another waiver
					</button>
				{/if}
			</div>
		{:else}
			<div class="space-y-6">
				{#if booking}
					{@const formattedStart = formatBookingTimestamp(booking.startTime, {
						dateStyle: 'medium',
						timeStyle: 'short'
					})}
					<section class="border border-border bg-muted/20 p-4">
						<p class="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">
							Booking
						</p>
						<h2 class="mt-1 text-lg font-semibold tracking-tight">{booking.activityName}</h2>
						<div class="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
							{#if formattedStart}
								<p>{formattedStart}</p>
							{/if}
							{#if booking.leadCustomerName}
								<p>Booked by {booking.leadCustomerName}</p>
							{/if}
							<p>
								{booking.signedCount} signed of {booking.participantCount} expected
							</p>
						</div>
					</section>
				{/if}

				<WaiverCopySection introCopy={waiver.introCopy} />

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
										{#each minors as minor, index (minor._uid)}
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
										{#if field.type !== 'checkbox'}
											<label class={waiverFieldLabelClass} for={field.id}>
												{field.label}
												{#if field.required}
													<span class="text-foreground/40">*</span>
												{/if}
											</label>
										{/if}

										{#if field.type === 'text'}
											<textarea
												id={field.id}
												class={waiverUnderlineTextareaClass}
												rows={1}
												value={currentStringAnswer(field.id)}
												placeholder={field.placeholder ?? ''}
												required={field.required}
												oninput={(event) =>
													setFieldAnswer(
														field.id,
														(event.currentTarget as HTMLTextAreaElement).value
													)}
											></textarea>
										{:else if field.type === 'checkbox'}
											<label class="waiver-checkbox-label flex cursor-pointer items-center gap-3">
												<span
													class={`waiver-checkbox-box flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${currentBooleanAnswer(field.id) ? 'border-foreground bg-foreground' : 'border-foreground/25 bg-transparent'}`}
													aria-hidden="true"
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
															aria-hidden="true"
														>
															<polyline points="20 6 9 17 4 12" />
														</svg>
													{/if}
												</span>
												<input
													id={field.id}
													type="checkbox"
													class="sr-only"
													checked={currentBooleanAnswer(field.id)}
													required={field.required}
													onchange={(event) =>
														setFieldAnswer(
															field.id,
															(event.currentTarget as HTMLInputElement).checked
														)}
												/>
												<span class="text-sm">
													{field.label}
													{#if field.required}
														<span class="text-foreground/40">*</span>
													{/if}
												</span>
											</label>
										{:else if field.type === 'select'}
											<select
												id={field.id}
												class={waiverUnderlineInputClass}
												value={currentStringAnswer(field.id)}
												required={field.required}
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
												required={field.required}
												oninput={(event) =>
													setFieldAnswer(field.id, (event.currentTarget as HTMLInputElement).value)}
											/>
										{/if}
									</div>
								{/each}
							</WaiverPublicAdditionalInfoSection>
						{/if}

						<div class="mt-8 border-t border-border pt-8">
							<div class="mb-7">
								<h3 class="text-lg font-semibold tracking-tight">Signature</h3>
							</div>
							<SignaturePad bind:value={signatureDataUrl} canvasId="signature-pad" />
						</div>
					</WaiverPublicAboutSignerCard>

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
							{isSubmitting ? 'Submitting...' : 'Submit waiver'}
						</button>
					</div>
				</form>
			</div>
		{/if}
	</WaiverDocumentShell>
</div>

<style>
	.waiver-checkbox-label:focus-within .waiver-checkbox-box {
		border-color: color-mix(in srgb, var(--primary) 80%, var(--foreground));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 24%, transparent);
		outline: none;
	}
</style>
