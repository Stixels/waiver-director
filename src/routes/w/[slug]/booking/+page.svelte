<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { resolve } from '$app/paths';
	import { useConvexClient } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import WaiverDocumentShell from '$lib/components/waivers/WaiverDocumentShell.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	let { data } = $props();

	type PublicWaiverData = NonNullable<FunctionReturnType<typeof api.waivers.getPublicWaiverBySlug>>;
	type BookingMatch = FunctionReturnType<typeof api.bookings.findPublicBooking>[number];

	const convex = useConvexClient();
	const waiver = $derived(data.waiver as PublicWaiverData);

	let lookupMode = $state<'bookingNumber' | 'emailDate'>('bookingNumber');
	let bookingNumber = $state('');
	let leadEmail = $state('');
	let serviceDate = $state('');
	let matches = $state<BookingMatch[]>([]);
	let lookupError = $state<string | null>(null);
	let isLookingUp = $state(false);

	function formatTimestamp(timestamp: string | null) {
		if (!timestamp) return 'Time not set';
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return 'Time not set';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	async function handleLookup(event: SubmitEvent) {
		event.preventDefault();
		if (convex.disabled) {
			lookupError = 'Booking lookup is still loading. Please try again.';
			return;
		}

		isLookingUp = true;
		lookupError = null;
		matches = [];

		try {
			matches = await convex.query(api.bookings.findPublicBooking, {
				slug: waiver.slug,
				...(lookupMode === 'bookingNumber'
					? { bookingNumber: bookingNumber.trim() }
					: { leadEmail: leadEmail.trim(), serviceDate })
			});
			if (matches.length === 0) {
				lookupError = 'No active booking matched those details.';
			}
		} catch (error) {
			lookupError = getConvexErrorMessage(error, 'Unable to look up this booking.');
		} finally {
			isLookingUp = false;
		}
	}
</script>

<svelte:head>
	<title>Find your booking | {waiver.workspaceName}</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<WaiverDocumentShell workspaceName={waiver.workspaceName}>
		<div class="space-y-6">
			<div class="space-y-2">
				<p class="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
					Booking waiver
				</p>
				<h1 class="text-3xl font-bold tracking-tight">Find your booking</h1>
				<p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Use your booking number, or the email and date on the booking, to open the waiver for your
					group.
				</p>
			</div>

			<form onsubmit={handleLookup} class="space-y-6 border border-border bg-muted/20 p-5">
				<div class="grid gap-2 sm:grid-cols-2">
					<button
						type="button"
						class={`h-10 border text-sm font-semibold transition-colors ${lookupMode === 'bookingNumber' ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-foreground hover:bg-muted/40'}`}
						onclick={() => (lookupMode = 'bookingNumber')}
					>
						Booking number
					</button>
					<button
						type="button"
						class={`h-10 border text-sm font-semibold transition-colors ${lookupMode === 'emailDate' ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-foreground hover:bg-muted/40'}`}
						onclick={() => (lookupMode = 'emailDate')}
					>
						Email and date
					</button>
				</div>

				{#if lookupMode === 'bookingNumber'}
					<div>
						<label
							class="mb-2 block text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase"
							for="booking-number"
						>
							Booking number
						</label>
						<input
							id="booking-number"
							class="h-11 w-full border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
							bind:value={bookingNumber}
							required
						/>
					</div>
				{:else}
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label
								class="mb-2 block text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase"
								for="lead-email"
							>
								Booking email
							</label>
							<input
								id="lead-email"
								type="email"
								class="h-11 w-full border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
								bind:value={leadEmail}
								required
							/>
						</div>
						<div>
							<label
								class="mb-2 block text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase"
								for="service-date"
							>
								Booking date
							</label>
							<input
								id="service-date"
								type="date"
								class="h-11 w-full border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
								bind:value={serviceDate}
								required
							/>
						</div>
					</div>
				{/if}

				{#if lookupError}
					<p class="text-sm text-destructive">{lookupError}</p>
				{/if}

				<button
					type="submit"
					class="h-11 w-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
					disabled={isLookingUp}
				>
					{isLookingUp ? 'Looking up...' : 'Find booking'}
				</button>
			</form>

			{#if matches.length > 0}
				<div class="space-y-3">
					<p class="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">
						Matching bookings
					</p>
					{#each matches as match (match.lookupToken)}
						<a
							href={resolve(`/w/${waiver.slug}/b/${match.lookupToken}` as `/w/${string}`)}
							class="block border border-border bg-background p-4 text-foreground no-underline transition-colors hover:bg-muted/30"
						>
							<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div class="min-w-0">
									<p class="truncate text-base font-semibold">{match.title}</p>
									<p class="mt-1 text-sm text-muted-foreground">
										{formatTimestamp(match.startTime)}
									</p>
								</div>
								<p class="text-xs font-semibold text-muted-foreground">
									{match.signedCount} signed of {match.participantCount} expected
								</p>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</WaiverDocumentShell>
</div>
