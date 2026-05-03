<script lang="ts">
	import { Check } from '@lucide/svelte';

	import { scrollReveal } from '$lib/actions/scroll-reveal';
	import { capturedGuests } from './content';
	import type { CapturedGuest } from './content';

	const missingContactRows = [1, 2, 3, 4, 5];
</script>

{#snippet signedGuestRow(person: CapturedGuest)}
	<div
		class="flex items-center gap-3 rounded-lg border px-3 py-2"
		style="border-color: var(--m-green-border); background: var(--m-green-soft);"
	>
		<div
			class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
			style="background: var(--m-elevated); color: var(--m-text-3);"
			aria-hidden="true"
		>
			{person.name[0]}
		</div>
		<div class="min-w-0 flex-1">
			<p class="truncate text-[12px] font-medium">{person.name}</p>
			<p class="truncate text-[11px]" style="color: var(--m-text-3);">{person.email}</p>
		</div>
		<span
			class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
			style="background: var(--m-green-dim); color: var(--m-green);"
		>
			<Check class="size-2.5" aria-hidden="true" /> Signed
		</span>
	</div>
{/snippet}

<section
	class="border-t border-b py-28 md:py-36"
	style="background: var(--m-surface); border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<div use:scrollReveal={{ delay: 0 }}>
				<p
					class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
					style="color: var(--primary);"
				>
					The Differentiator
				</p>
				<h2
					class="mb-4 font-extrabold tracking-tight text-balance"
					style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.75rem); letter-spacing: -0.03em; line-height: 1.06;"
				>
					One booking. Six email addresses.
				</h2>
				<p class="mb-10 max-w-2xl text-[15px] leading-relaxed" style="color: var(--m-text-2);">
					Most booking systems record only the lead contact. With Waiver Director, every guest who
					signs is reachable — not just the booker. Optional Mailchimp or Constant Contact sync keeps
					your existing lists aligned.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2" use:scrollReveal={{ delay: 80 }}>
				<!-- Booking system (before) -->
				<div
					class="flex h-full min-h-0 flex-col rounded-xl border p-5"
					style="border-color: var(--m-border-soft); background: var(--m-card);"
				>
					<p
						class="mb-4 text-[10px] font-semibold tracking-widest uppercase"
						style="color: var(--m-text-3);"
					>
						Bookeo Booking
					</p>
					<!-- Lead contact -->
					<div
						class="mb-1.5 flex items-center gap-3 rounded-lg border px-3 py-2"
						style="border-color: var(--m-border-strong); background: var(--m-elevated);"
					>
						<div
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
							style="background: var(--m-accent-dim); color: var(--primary);"
							aria-hidden="true"
						>
							A
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-[12px] font-medium">
								Alex Martinez <span class="text-[10px] font-normal" style="opacity: 0.55;"
									>(lead)</span
								>
							</p>
							<p class="text-[11px]" style="color: var(--m-text-3);">alex@email.com</p>
						</div>
					</div>

					<!-- Missing rows -->
					<div aria-hidden="true" class="flex flex-col gap-1.5">
						{#each missingContactRows as row (row)}
							<div class="flex items-center gap-3 rounded-lg px-3 py-2 opacity-20">
								<div
									class="h-5 w-5 shrink-0 rounded-full"
									style="background: var(--m-border-strong);"
								></div>
								<div class="h-2.5 flex-1 rounded" style="background: var(--m-border-strong);"></div>
								<div
									class="h-2.5 w-14 rounded"
									style="background: var(--m-border-strong);"
								></div>
							</div>
						{/each}
					</div>

					<p class="mt-auto pt-4 text-[11px] leading-snug" style="color: var(--m-text-3);">
						5 guests have no contact record in your booking system.
					</p>
				</div>

				<!-- Waiver Director (after) -->
				<div
					class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border p-5"
					style="border-color: oklch(0.52 0.22 277 / 35%); background: var(--m-card);"
				>
					<!-- Top accent line -->
					<div
						class="pointer-events-none absolute inset-x-0 top-0 h-px"
						style="background: linear-gradient(90deg, transparent, oklch(0.52 0.22 277 / 55%), transparent);"
						aria-hidden="true"
					></div>

					<p
						class="mb-4 text-[10px] font-semibold tracking-widest uppercase"
						style="color: var(--primary);"
					>
						Waiver Director
					</p>

					<div class="flex flex-1 flex-col gap-1.5">
						{#each capturedGuests as person (person.email)}
							{@render signedGuestRow(person)}
						{/each}
					</div>

					<p class="mt-auto pt-4 text-[11px] leading-snug font-medium" style="color: var(--primary);">
						6 guests captured → 6 follow-ups queued.
					</p>
				</div>
			</div>

			<p
				class="mt-8 text-center text-[14px] leading-relaxed text-pretty"
				style="color: var(--m-text-2);"
				use:scrollReveal={{ delay: 140 }}
			>
				Works for any group experience: tours, ziplines, axe throwing, escape rooms, rentals, and
				more.
			</p>
	</div>
</section>
