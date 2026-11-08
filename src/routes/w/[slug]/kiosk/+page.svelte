<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { onDestroy, onMount, tick } from 'svelte';
	import { useConvexClient } from 'convex-svelte';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import PublicWaiverForm from '$lib/components/waivers/PublicWaiverForm.svelte';
	import WaiverDocumentShell from '$lib/components/waivers/WaiverDocumentShell.svelte';
	import {
		KIOSK_DEVICE_PARAM,
		KIOSK_IDLE_TIMEOUT_MS,
		KIOSK_IDLE_WARNING_MS,
		KIOSK_SUBMITTED_RESET_MS,
		kioskDeviceStorageKey
	} from '$lib/domain/kiosk';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { formatBookingTimestamp } from '$lib/utils/date';

	let { data } = $props();

	type PublicWaiverData = NonNullable<FunctionReturnType<typeof api.waivers.getPublicWaiverBySlug>>;
	type BookingWaiverData = NonNullable<
		FunctionReturnType<typeof api.waivers.getPublicWaiverForBooking>
	>;
	type LookupResult = Extract<
		FunctionReturnType<typeof api.kiosk.lookupBookings>,
		{ status: 'ok' }
	>['results'][number];

	type Screen =
		| { name: 'home' }
		| { name: 'lookup' }
		| { name: 'walk-in' }
		| { name: 'booking'; waiver: BookingWaiverData }
		| { name: 'submitted' };

	const waiver = $derived(data.waiver as PublicWaiverData);
	const convex = useConvexClient();

	let screen = $state<Screen>({ name: 'home' });
	// Booking lookup only works on a device opened from the Waiver page (see ADR 0001 and
	// kiosk.lookupBookings). Without a device token the kiosk offers walk-in signing only.
	let deviceToken = $state<string | null>(null);
	// Bumped on every reset so the signing form remounts with empty state and a blank signature.
	let sessionKey = $state(0);

	let lookupQuery = $state('');
	let lookupResults = $state<LookupResult[] | null>(null);
	let lookupError = $state<string | null>(null);
	let isLookingUp = $state(false);
	let openingToken = $state<string | null>(null);

	let lastActivityAt = $state(Date.now());
	let now = $state(Date.now());
	let submittedAt = $state<number | null>(null);
	let ticker: ReturnType<typeof setInterval> | null = null;

	const idleRemainingMs = $derived(
		screen.name === 'home' || screen.name === 'submitted'
			? null
			: Math.max(0, KIOSK_IDLE_TIMEOUT_MS - (now - lastActivityAt))
	);
	const showIdleWarning = $derived(
		idleRemainingMs !== null && idleRemainingMs <= KIOSK_IDLE_WARNING_MS
	);
	const submittedRemainingSeconds = $derived(
		submittedAt === null
			? 0
			: Math.max(0, Math.ceil((KIOSK_SUBMITTED_RESET_MS - (now - submittedAt)) / 1000))
	);

	function markActivity() {
		lastActivityAt = Date.now();
		now = lastActivityAt;
	}

	async function resetKiosk() {
		screen = { name: 'home' };
		sessionKey += 1;
		lookupQuery = '';
		lookupResults = null;
		lookupError = null;
		isLookingUp = false;
		openingToken = null;
		submittedAt = null;
		markActivity();
		// Drop focus and any text selection so nothing from the last guest stays on screen.
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
		window.getSelection()?.removeAllRanges();
		await tick();
		window.scrollTo({ top: 0 });
	}

	async function goTo(next: Screen) {
		screen = next;
		markActivity();
		await tick();
		window.scrollTo({ top: 0 });
	}

	function handleSubmitted() {
		submittedAt = Date.now();
		void goTo({ name: 'submitted' });
	}

	async function handleLookup(event: SubmitEvent) {
		event.preventDefault();
		if (isLookingUp) return;
		if (convex.disabled) {
			lookupError = 'The kiosk is still loading. Please try again.';
			return;
		}

		isLookingUp = true;
		lookupError = null;
		lookupResults = null;
		try {
			const result = await convex.mutation(api.kiosk.lookupBookings, {
				slug: waiver.slug,
				...(deviceToken ? { deviceToken } : {}),
				query: lookupQuery
			});
			if (result.status === 'ok') {
				lookupResults = result.results;
			} else if (result.status === 'invalid') {
				lookupError = result.message;
			} else if (result.status === 'rate_limited') {
				lookupError = `Too many searches right now. Try again in ${Math.ceil(result.retryAfterSeconds / 60)} min, or sign as a walk-in.`;
			} else if (result.status === 'device_required') {
				forgetDeviceToken();
				lookupError =
					'Booking lookup is turned off on this device. Please sign as a walk-in or ask staff for help.';
			} else {
				lookupError = 'Booking lookup is not available right now. Please sign as a walk-in.';
			}
		} catch (error) {
			lookupError = getConvexErrorMessage(error, 'Unable to search bookings.');
		} finally {
			isLookingUp = false;
			markActivity();
		}
	}

	async function openBooking(result: LookupResult) {
		if (openingToken) return;
		openingToken = result.lookupToken;
		lookupError = null;
		try {
			const bookingWaiver = await convex.query(api.waivers.getPublicWaiverForBooking, {
				slug: waiver.slug,
				lookupToken: result.lookupToken
			});
			if (!bookingWaiver) {
				lookupError = 'That booking is no longer available. Please ask staff for help.';
				return;
			}
			sessionKey += 1;
			await goTo({ name: 'booking', waiver: bookingWaiver });
		} catch (error) {
			lookupError = getConvexErrorMessage(error, 'Unable to open this booking.');
		} finally {
			openingToken = null;
		}
	}

	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await document.documentElement.requestFullscreen();
			}
		} catch {
			// Fullscreen is optional; some browsers or embedded views refuse it.
		}
	}

	$effect(() => {
		if (idleRemainingMs === 0) void resetKiosk();
	});

	$effect(() => {
		if (screen.name === 'submitted' && submittedAt !== null && submittedRemainingSeconds === 0) {
			void resetKiosk();
		}
	});

	function readStoredDeviceToken() {
		try {
			return localStorage.getItem(kioskDeviceStorageKey(waiver.slug));
		} catch {
			return null;
		}
	}

	function storeDeviceToken(token: string) {
		try {
			localStorage.setItem(kioskDeviceStorageKey(waiver.slug), token);
		} catch {
			// Storage can be blocked (private mode); the token still works for this page load.
		}
	}

	function forgetDeviceToken() {
		deviceToken = null;
		try {
			localStorage.removeItem(kioskDeviceStorageKey(waiver.slug));
		} catch {
			// Nothing stored.
		}
	}

	// Keep the device token out of the address bar so it can't be copied off the shared device.
	// The router isn't ready during the first load's mount callbacks, so wait one task.
	afterNavigate(() => {
		if (!page.url.searchParams.has(KIOSK_DEVICE_PARAM)) return;
		setTimeout(() => {
			replaceState(resolve('/w/[slug]/kiosk', { slug: page.params.slug ?? waiver.slug }), {});
		}, 0);
	});

	onMount(() => {
		const fromUrl = page.url.searchParams.get(KIOSK_DEVICE_PARAM)?.trim();
		if (fromUrl) {
			storeDeviceToken(fromUrl);
			deviceToken = fromUrl;
		} else {
			deviceToken = readStoredDeviceToken();
		}

		ticker = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (ticker) clearInterval(ticker);
	});

	const primaryButtonClass =
		'flex min-h-16 w-full items-center justify-center bg-foreground px-6 text-base font-semibold tracking-wide text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40';
	const secondaryButtonClass =
		'flex min-h-16 w-full items-center justify-center border border-foreground/25 px-6 text-base font-semibold tracking-wide transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40';
	const backButtonClass =
		'text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline';
</script>

<svelte:head>
	<title>Check in | {waiver.workspaceName}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svelte:window
	onpointerdown={markActivity}
	onkeydown={markActivity}
	oninput={markActivity}
	onscroll={markActivity}
/>

<div
	class="min-h-screen bg-background text-foreground"
	class:waiver-theme-light={waiver.theme === 'light'}
	class:waiver-theme-dark={waiver.theme === 'dark'}
>
	{#if screen.name === 'walk-in'}
		<div>
			<div class="mx-auto flex w-full max-w-3xl justify-start px-4 pt-6 sm:px-8">
				<button type="button" class={backButtonClass} onclick={resetKiosk}
					>Cancel and start over</button
				>
			</div>
			{#key sessionKey}
				<PublicWaiverForm {waiver} kiosk onSubmitted={handleSubmitted} />
			{/key}
		</div>
	{:else if screen.name === 'booking'}
		<div>
			<div class="mx-auto flex w-full max-w-3xl justify-start px-4 pt-6 sm:px-8">
				<button type="button" class={backButtonClass} onclick={resetKiosk}
					>Cancel and start over</button
				>
			</div>
			{#key sessionKey}
				<PublicWaiverForm
					waiver={screen.waiver}
					booking={screen.waiver.booking}
					kiosk
					onSubmitted={handleSubmitted}
				/>
			{/key}
		</div>
	{:else}
		<div>
			<WaiverDocumentShell
				workspaceName={waiver.workspaceName}
				workspaceLogoUrl={waiver.workspaceLogoUrl}
			>
				{#if screen.name === 'home'}
					<div class="flex flex-col items-center py-10 text-center sm:py-16">
						<p class="mb-2 text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
							{waiver.workspaceName}
						</p>
						<h1 class="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Sign your waiver</h1>
						<p class="mb-10 max-w-md text-base leading-relaxed text-muted-foreground">
							{deviceToken
								? 'Booked ahead? Find your booking so your waiver is attached to it. Otherwise, sign as a walk-in.'
								: 'Tap below to read and sign your waiver.'}
						</p>
						<div class="grid w-full max-w-md gap-4">
							{#if deviceToken}
								<button
									type="button"
									class={primaryButtonClass}
									onclick={() => goTo({ name: 'lookup' })}
								>
									I have a booking
								</button>
							{/if}
							<button
								type="button"
								class={deviceToken ? secondaryButtonClass : primaryButtonClass}
								onclick={() => {
									sessionKey += 1;
									void goTo({ name: 'walk-in' });
								}}
							>
								Sign as a walk-in
							</button>
						</div>
						<button
							type="button"
							class="mt-12 text-xs text-muted-foreground/60 hover:text-muted-foreground"
							onclick={toggleFullscreen}
						>
							Toggle full screen
						</button>
						{#if !deviceToken}
							<p class="mt-3 max-w-sm text-xs text-muted-foreground/60">
								Booking lookup is off on this device. Staff can turn it on by opening the kiosk from
								the Waiver page in Waiver Director.
							</p>
						{/if}
					</div>
				{:else if screen.name === 'lookup'}
					<div class="py-8 sm:py-12">
						<button type="button" class={backButtonClass} onclick={resetKiosk}>Back</button>
						<h1 class="mt-6 mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
							Find your booking
						</h1>
						<p class="mb-8 text-base text-muted-foreground">
							Enter your booking number or the email used to book. Only bookings from the last few
							hours through tomorrow are shown.
						</p>
						<form class="space-y-4" onsubmit={handleLookup} autocomplete="off">
							<label class="sr-only" for="kiosk-lookup">Booking number or email</label>
							<input
								id="kiosk-lookup"
								class="h-16 w-full border border-foreground/25 bg-transparent px-4 text-lg outline-none focus:border-foreground"
								bind:value={lookupQuery}
								placeholder="Booking number or email"
								autocomplete="off"
								autocapitalize="off"
								spellcheck="false"
								maxlength={120}
								required
							/>
							<button type="submit" class={primaryButtonClass} disabled={isLookingUp}>
								{isLookingUp ? 'Searching...' : 'Find booking'}
							</button>
						</form>

						{#if lookupError}
							<p class="mt-6 text-sm text-destructive" role="alert">{lookupError}</p>
						{/if}

						{#if lookupResults}
							<div class="mt-8" aria-live="polite">
								{#if lookupResults.length === 0}
									<p class="text-base text-muted-foreground">
										No upcoming booking matched. Check the number or email, or sign as a walk-in.
									</p>
								{:else}
									<p
										class="mb-3 text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase"
									>
										Choose your booking
									</p>
									<ul class="grid gap-3">
										{#each lookupResults as result (result.lookupToken)}
											{@const start = formatBookingTimestamp(result.startTime, {
												dateStyle: 'medium',
												timeStyle: 'short'
											})}
											<li>
												<button
													type="button"
													class="flex min-h-16 w-full flex-col items-start border border-border bg-muted/20 p-4 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
													disabled={openingToken !== null}
													onclick={() => openBooking(result)}
												>
													<span class="text-lg font-semibold tracking-tight">
														{result.activityName}
													</span>
													<span class="mt-1 text-sm text-muted-foreground">
														{[
															start,
															result.leadFirstName ? `Booked by ${result.leadFirstName}` : null
														]
															.filter(Boolean)
															.join(' · ')}
													</span>
												</button>
											</li>
										{/each}
									</ul>
								{/if}
								<button
									type="button"
									class={`${secondaryButtonClass} mt-6`}
									onclick={() => {
										sessionKey += 1;
										void goTo({ name: 'walk-in' });
									}}
								>
									Sign as a walk-in instead
								</button>
							</div>
						{/if}
					</div>
				{:else if screen.name === 'submitted'}
					<div class="flex flex-col items-center py-20 text-center" role="status">
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
								aria-hidden="true"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
						<p class="mb-2 text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
							Submission received
						</p>
						<h1 class="mb-4 text-3xl font-bold tracking-tight">You're all set</h1>
						<p class="max-w-sm text-base leading-relaxed text-muted-foreground">
							Your signed waiver has been recorded for {waiver.workspaceName}. Please hand the
							device to the next guest.
						</p>
						<button
							type="button"
							class={`${primaryButtonClass} mt-10 max-w-xs`}
							onclick={resetKiosk}
						>
							Done
						</button>
						<p class="mt-4 text-sm text-muted-foreground">
							Starting over in {submittedRemainingSeconds}s
						</p>
					</div>
				{/if}
			</WaiverDocumentShell>
		</div>
	{/if}

	{#if showIdleWarning}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="kiosk-idle-title"
			aria-describedby="kiosk-idle-description"
		>
			<div class="w-full max-w-sm bg-background p-8 text-center text-foreground shadow-xl">
				<h2 id="kiosk-idle-title" class="mb-2 text-2xl font-bold tracking-tight">Still there?</h2>
				<p id="kiosk-idle-description" class="mb-6 text-base text-muted-foreground">
					This form will clear in {Math.ceil((idleRemainingMs ?? 0) / 1000)}s to protect your
					details.
				</p>
				<button type="button" class={primaryButtonClass} onclick={markActivity}>
					Keep going
				</button>
				<button type="button" class={`${backButtonClass} mt-4`} onclick={resetKiosk}>
					Start over now
				</button>
			</div>
		</div>
	{/if}
</div>
