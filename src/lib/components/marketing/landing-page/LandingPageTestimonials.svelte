<script lang="ts">
	import { scrollReveal } from '$lib/actions/scroll-reveal';

	const testimonials = [
		{
			id: 'jordan',
			quote:
				"We used to see one email per booking — the lead's. Now we see every guest. The difference in our follow-up open rates was immediate, and we actually know who came back for a second visit.",
			name: 'Jordan T.',
			role: 'Owner',
			business: 'Apex Zipline Co.',
			activity: 'Zip Line Tours',
			initials: 'JT'
		},
		{
			id: 'maya',
			quote:
				'Our review count doubled within the first month of automated follow-ups. We set up one thank-you template and a review ask two days later. Completely hands-off after the first setup.',
			name: 'Maya R.',
			role: 'Co-owner',
			business: 'Iron & Oak Axe',
			activity: 'Axe Throwing',
			initials: 'MR'
		},
		{
			id: 'sam',
			quote:
				"We finally know our actual completion rate — not just 'did the booking sync?' Seeing signed vs. expected per session in real time means we're never scrambling at the door.",
			name: 'Sam L.',
			role: 'Ops Manager',
			business: 'Puzzle District',
			activity: 'Escape Rooms',
			initials: 'SL'
		}
	] as const;
</script>

<section
	class="border-t py-28 md:py-36"
	style="background: var(--m-bg); border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<div use:scrollReveal={{ delay: 0 }}>
			<p
				class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
				style="color: var(--primary);"
			>
				What Operators Say
			</p>
			<h2
				class="mb-14 max-w-xl font-extrabold tracking-tight"
				style="font-family: var(--m-font-display); font-size: clamp(1.75rem, 3.5vw, 2.75rem); letter-spacing: -0.03em; line-height: 1.06;"
			>
				Real results from real sessions.
			</h2>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-3" use:scrollReveal={{ delay: 80 }}>
			{#each testimonials as t (t.id)}
				<div
					class="testimonial-card flex flex-col gap-5 rounded-xl border p-6"
					style="background: var(--m-card); border-color: var(--m-border-soft);"
				>
					<!-- Opening quote mark -->
					<span
						class="text-[1.1rem] leading-none font-semibold select-none"
						style="color: var(--primary); font-family: Georgia, serif; letter-spacing: -0.01em;"
						aria-hidden="true">"</span
					>

					<blockquote
						class="flex-1 text-[14px] leading-relaxed"
						style="color: oklch(0.82 0.006 286);"
					>
						{t.quote}
					</blockquote>

					<div
						class="flex items-center gap-3 border-t pt-5"
						style="border-color: var(--m-border-soft);"
					>
						<div
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
							style="background: var(--m-accent-medium); color: var(--primary); border: 1px solid var(--m-accent-border);"
							aria-hidden="true"
						>
							{t.initials}
						</div>
						<div class="min-w-0">
							<p class="text-[13px] leading-snug font-semibold">
								{t.name}
								<span class="font-normal" style="color: var(--m-text-3);">· {t.role}</span>
							</p>
							<p class="text-[11px] leading-snug" style="color: var(--m-text-3);">
								{t.business}
								<span
									class="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
									style="background: var(--m-elevated);"
								>
									{t.activity}
								</span>
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.testimonial-card {
		transition:
			transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.2s ease;
	}

	@media (hover: hover) {
		.testimonial-card:hover {
			transform: translateY(-3px);
			border-color: oklch(1 0 0 / 14%) !important;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.testimonial-card {
			transition: none !important;
		}
		.testimonial-card:hover {
			transform: none;
		}
	}
</style>
