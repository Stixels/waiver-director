<script lang="ts">
	import { Check } from '@lucide/svelte';

	import { capturedGuests } from './content';
	import type { CapturedGuest } from './content';
	import MarketingSectionHeading from './MarketingSectionHeading.svelte';
	import { scrollReveal } from './scrollReveal';

	const missingContactRows = [1, 2, 3, 4, 5];
</script>

<section
	class="landing-reveal border-t border-b py-20 md:py-24"
	style="background: var(--m-surface); border-color: var(--m-border);"
	{@attach scrollReveal}
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<div class="mx-auto max-w-4xl">
			<MarketingSectionHeading
				eyebrow="The Differentiator"
				title="One booking. Six email addresses."
				description="Most booking systems record only the lead contact. With Waiver Director, every guest who signs is reachable for follow-ups, feedback, reviews, and more, not just the booker. Optional Mailchimp or Constant Contact sync keeps your existing lists aligned."
				class="mb-8 md:mb-10"
			/>

			{#snippet signedGuestRow(person: CapturedGuest)}
				<div
					class="mkt-status-row-signed mb-1.5 flex items-center gap-3 rounded-lg border px-3 py-2"
				>
					<div
						class="mkt-elevated mkt-text-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
						aria-hidden="true"
					>
						{person.name[0]}
					</div>
					<div class="min-w-0 flex-1">
						<p class="mkt-text truncate text-[12px] font-medium">
							{person.name}
						</p>
						<p class="mkt-text-3 truncate text-[11px]">{person.email}</p>
					</div>
					<span
						class="mkt-chip-success flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
					>
						<Check class="size-2.5" aria-hidden="true" /> Signed
					</span>
				</div>
			{/snippet}

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
				<div class="mkt-card-panel flex h-full min-h-0 flex-col rounded-xl border p-5">
					<p class="mkt-text-3 mb-4 text-[10px] font-semibold tracking-widest uppercase">
						Bookeo Booking
					</p>
					<div class="mkt-elevated-panel mb-2 flex items-center gap-3 rounded-lg border px-3 py-2">
						<div
							class="mkt-chip-accent flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
							aria-hidden="true"
						>
							A
						</div>
						<div class="min-w-0 flex-1">
							<p class="mkt-text text-[12px] font-medium">
								Alex Martinez <span class="text-[10px] font-normal opacity-60">(lead)</span>
							</p>
							<p class="mkt-text-3 text-[11px]">alex@email.com</p>
						</div>
					</div>

					<div aria-hidden="true">
						{#each missingContactRows as row (row)}
							<div class="mb-1.5 flex items-center gap-3 rounded-lg px-3 py-2 opacity-25">
								<div class="h-6 w-6 shrink-0 rounded-full bg-[var(--m-border-strong)]"></div>
								<div class="h-3 flex-1 rounded bg-[var(--m-border-strong)]"></div>
								<div class="h-3 w-16 rounded bg-[var(--m-border-strong)]"></div>
							</div>
						{/each}
					</div>

					<p class="mkt-text-3 mt-auto pt-4 text-[11px] leading-snug">
						5 guests have no contact record in your booking system.
					</p>
				</div>

				<div
					class="flex h-full min-h-0 flex-col rounded-xl border p-5"
					style="border-color: var(--m-accent); background: var(--m-card); box-shadow: 0 0 30px var(--m-accent-glow);"
				>
					<p class="mkt-accent mb-4 text-[10px] font-semibold tracking-widest uppercase">
						Waiver Director
					</p>

					{#each capturedGuests as person (person.name)}
						{@render signedGuestRow(person)}
					{/each}

					<p class="mkt-accent mt-auto pt-4 text-[11px] leading-snug font-medium">
						6 guests captured → 6 follow-ups queued.
					</p>
				</div>
			</div>

			<p class="mkt-text-2 mt-10 text-center text-[14px] leading-relaxed font-medium text-pretty">
				Works for any group experience: tours, ziplines, axe throwing, escape rooms, rentals, and
				more.
			</p>
		</div>
	</div>
</section>
