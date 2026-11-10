<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import { ConvexError } from 'convex/values';
	import { useConvexClient } from 'convex-svelte';
	import { onMount, tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
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
	import {
		MAX_MINORS,
		MAX_MINOR_NAME_LENGTH,
		MIN_MINOR_NAME_LENGTH
	} from '$lib/domain/waiver-constraints';
	import type { WaiverField, WaiverMinor, WaiverTheme } from '$lib/domain/waivers';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { formatBookingTimestamp } from '$lib/utils/date';

	type PublicWaiver = {
		slug: string;
		versionId: Id<'waiver_versions'>;
		workspaceName: string;
		workspaceLogoUrl: string | null;
		title: string;
		introCopy: string;
		theme: WaiverTheme;
		fields: WaiverField[];
		marketingOptIn: { provider: 'mailchimp'; label: string } | null;
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
	let marketingConsent = $state(false);
	let minors = $state<MinorFormState[]>([]);
	let isSubmitting = $state(false);
	let submitError = $state<string | null>(null);
	let isSubmitted = $state(false);
	let isResetting = $state(false);
	// Latest selectable date of birth. Set on the client so it reflects the signer's local day.
	let maxDateOfBirth = $state<string | undefined>(undefined);
	let successHeading = $state<HTMLHeadingElement | null>(null);
	let submitErrorElement = $state<HTMLParagraphElement | null>(null);

	const canAddMinor = $derived(minors.length < MAX_MINORS);

	function localIsoDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	onMount(() => {
		maxDateOfBirth = localIsoDate(new Date());
	});

	async function addMinor() {
		if (!canAddMinor) return;
		const uid = crypto.randomUUID();
		minors.push({ _uid: uid, fullName: '' });
		await tick();
		document.getElementById(`minor-name-${uid}`)?.focus();
	}

	async function removeMinor(index: number) {
		minors.splice(index, 1);
		// The focused Remove button is gone; keep keyboard users in the minors section.
		await tick();
		const nextMinor = minors[Math.min(index, minors.length - 1)];
		const nextTarget = nextMinor
			? document.getElementById(`minor-name-${nextMinor._uid}`)
			: document.getElementById('add-minor-button');
		nextTarget?.focus();
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
		if (isSubmitting) return;

		if (convex.disabled) {
			submitError = 'The waiver form is still loading. Please try again.';
			return;
		}

		if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
			submitError = 'Please provide a signature.';
			document
				.getElementById('signature-pad')
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}

		isSubmitting = true;
		submitError = null;
		const minorsPayload = minors.map((minor) => ({ fullName: minor.fullName }));
		// Only send answers for fields on the version being signed (drops answers left over
		// from fields that disappeared after the form refreshed to a newer version).
		const fieldIds = new Set(waiver.fields.map((field) => field.id));
		const answersPayload = Object.fromEntries(
			Object.entries(answers).filter(([fieldId]) => fieldIds.has(fieldId))
		);

		try {
			await convex.mutation(api.waivers.submitPublicWaiver, {
				slug: waiver.slug,
				versionId: waiver.versionId,
				...(booking ? { bookingLookupToken: booking.lookupToken } : {}),
				signerName,
				signerEmail,
				signerDateOfBirth,
				signatureDataUrl,
				marketingConsent,
				answers: answersPayload,
				minors: minorsPayload
			});

			isSubmitted = true;
			toast.success('Waiver submitted.');
			await tick();
			window.scrollTo({ top: 0 });
			successHeading?.focus();
		} catch (error) {
			if (isStaleVersionError(error)) {
				// Refresh to the newly published version in place so the signer keeps
				// what they've already typed instead of reloading and starting over.
				try {
					await invalidateAll();
					submitError = 'This waiver was just updated. Please review the form and submit again.';
				} catch {
					submitError = getConvexErrorMessage(error, 'Unable to submit this waiver.');
				}
			} else {
				submitError = getConvexErrorMessage(error, 'Unable to submit this waiver.');
			}
			await tick();
			submitErrorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		} finally {
			isSubmitting = false;
		}
	}

	function isStaleVersionError(error: unknown): boolean {
		return (
			error instanceof ConvexError &&
			typeof error.data === 'object' &&
			error.data !== null &&
			'code' in error.data &&
			error.data.code === 'stale_version'
		);
	}

	async function signAnother() {
		if (isResetting) return;
		isResetting = true;
		try {
			// Refresh the booking's signed count so the next signer sees current progress.
			await invalidateAll();
		} catch {
			// Keep going with the existing data; the count is informational only.
		} finally {
			isResetting = false;
		}
		resetForm();
		await tick();
		window.scrollTo({ top: 0 });
		document.getElementById('signer-name')?.focus();
	}

	function resetForm() {
		signerName = '';
		signerEmail = '';
		signerDateOfBirth = '';
		signatureDataUrl = '';
		answers = {};
		marketingConsent = false;
		minors = [];
		submitError = null;
		isSubmitted = false;
	}
</script>

<div
	class="min-h-screen bg-background text-foreground"
	class:waiver-theme-light={waiver.theme === 'light'}
	class:waiver-theme-dark={waiver.theme === 'dark'}
>
	<WaiverDocumentShell
		workspaceName={waiver.workspaceName}
		workspaceLogoUrl={waiver.workspaceLogoUrl}
	>
		{#if isSubmitted}
			<div class="flex flex-col items-center py-20 text-center">
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
				<h1
					bind:this={successHeading}
					tabindex="-1"
					class="mb-4 text-3xl font-bold tracking-tight focus:outline-none"
				>
					Waiver complete
				</h1>
				<p class="max-w-sm text-base leading-relaxed text-muted-foreground">
					Thank you. Your signed waiver has been recorded for {waiver.workspaceName}.
				</p>
				{#if booking}
					<button
						type="button"
						class="mt-8 h-12 bg-foreground px-8 text-sm font-semibold tracking-wide text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
						onclick={signAnother}
						disabled={isResetting}
					>
						{isResetting ? 'Loading...' : 'Sign another waiver'}
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
									minlength={2}
									maxlength={120}
									autocomplete="name"
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
									maxlength={254}
									autocomplete="email"
									autocapitalize="off"
									spellcheck={false}
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
									min="1900-01-01"
									max={maxDateOfBirth}
									autocomplete="bday"
								/>
							</div>
						</div>

						<WaiverPublicMinorsBlock>
							{#snippet headerActions()}
								<button
									id="add-minor-button"
									type="button"
									class={waiverAddMinorButtonClass}
									onclick={addMinor}
									disabled={!canAddMinor}
									title={canAddMinor
										? undefined
										: `You can add up to ${MAX_MINORS} minors per waiver.`}
								>
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
														class="-my-2 -mr-2 min-h-11 px-2 text-xs text-muted-foreground hover:text-foreground"
														aria-label={`Remove minor ${index + 1}`}
														onclick={() => removeMinor(index)}
													>
														Remove
													</button>
												</div>

												<label class={waiverFieldLabelClass} for={`minor-name-${minor._uid}`}>
													<span class="sr-only">Minor {index + 1}</span>
													Full name
												</label>
												<input
													id={`minor-name-${minor._uid}`}
													class={waiverUnderlineInputClass}
													bind:value={minor.fullName}
													required
													minlength={MIN_MINOR_NAME_LENGTH}
													maxlength={MAX_MINOR_NAME_LENGTH}
													autocomplete="off"
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
												class={`${waiverUnderlineTextareaClass} field-sizing-content max-h-64`}
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

						{#if waiver.marketingOptIn}
							<div class="mt-8 border-t border-border pt-8">
								<h3 class="mb-4 text-lg font-semibold tracking-tight">Stay in touch</h3>
								<label class="waiver-checkbox-label flex cursor-pointer items-start gap-3">
									<span
										class={`waiver-checkbox-box mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${marketingConsent ? 'border-foreground bg-foreground' : 'border-foreground/25 bg-transparent'}`}
										aria-hidden="true"
									>
										{#if marketingConsent}
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
									<input type="checkbox" class="sr-only" bind:checked={marketingConsent} />
									<span>
										<span class="block text-sm">{waiver.marketingOptIn.label}</span>
										<span class="mt-1 block text-xs leading-relaxed text-muted-foreground">
											Optional. You can unsubscribe from marketing emails at any time.
										</span>
									</span>
								</label>
							</div>
						{/if}

						<div class="mt-8 border-t border-border pt-8">
							<div class="mb-7">
								<h3 class="text-lg font-semibold tracking-tight">Signature</h3>
							</div>
							<SignaturePad
								bind:value={signatureDataUrl}
								canvasId="signature-pad"
								disabled={isSubmitting}
							/>
						</div>
					</WaiverPublicAboutSignerCard>

					{#if submitError}
						<p bind:this={submitErrorElement} class="text-sm text-destructive" role="alert">
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
