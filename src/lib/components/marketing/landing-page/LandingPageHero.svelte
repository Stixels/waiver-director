<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';

	import MarketingScreenshotFrame from '$lib/components/marketing/MarketingScreenshotFrame.svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<section class="mkt-hero landing-hero relative overflow-hidden px-4 sm:px-6">
	<div class="landing-hero__grid absolute inset-0" aria-hidden="true"></div>
	<div class="landing-hero__orb landing-hero__orb--one" aria-hidden="true"></div>
	<div class="landing-hero__orb landing-hero__orb--two" aria-hidden="true"></div>

	<div class="landing-hero__inner relative z-10">
		<div class="landing-hero__lede">
			<h1 class="marketing-display landing-hero__animate landing-hero__delay-1">
				More signatures before arrival. <span>More relationships after.</span>
			</h1>

			<div class="landing-hero__aside landing-hero__animate landing-hero__delay-2">
				<p class="landing-hero__deck">
					Share waivers by link or QR code, track every booking live, and automatically follow up
					with participants for feedback and reviews.
				</p>
				<div class="landing-hero__cta">
					<div class="landing-hero__actions">
						<Button
							href={resolve('/sign-up')}
							class="btn-mkt-accent h-12 gap-2 rounded-xl px-7 text-[0.95rem] font-semibold"
						>
							Start building free
							<ArrowRight size={16} aria-hidden="true" />
						</Button>
						<Button
							href={resolve('/features')}
							variant="outline"
							class="btn-mkt-outline h-12 rounded-xl px-6 text-[0.95rem] font-medium"
						>
							See all features
						</Button>
					</div>
					<p class="landing-hero__meta">No credit card required.</p>
				</div>
			</div>
		</div>

		<!-- The workspace deliberately meets the fold, so the first screen invites the scroll. -->
		<div class="landing-hero__visual landing-hero__animate landing-hero__delay-3">
			<div class="landing-hero__stage">
				<MarketingScreenshotFrame
					src="/marketing/apex-dashboard.png"
					alt="Waiver Director workspace for the fictional Apex Adventures demo, showing today's bookings, signed waiver completion, submissions, and follow-up status"
					label="Apex Adventures / Live workspace"
					width={1694}
					height={908}
					mobileCrop={{ x: 200, y: 8, width: 1295, height: 895 }}
					priority
				/>
			</div>
		</div>
	</div>
</section>

<style>
	@keyframes landing-hero-entrance {
		from {
			opacity: 0;
			transform: translateY(22px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.landing-hero {
		--mkt-hero-top: 5rem;

		display: flex;
		flex-direction: column;
		min-height: auto;
		padding-bottom: 0;
	}

	@media (min-width: 768px) {
		.landing-hero {
			--mkt-hero-top: 6.5rem;
		}
	}

	.landing-hero__inner {
		display: flex;
		flex: 1;
		flex-direction: column;
		width: 100%;
	}

	.landing-hero__grid {
		background-image: radial-gradient(circle, oklch(1 0 0 / 7%) 1px, transparent 1px);
		background-size: 32px 32px;
		mask-image: linear-gradient(to bottom, black 0%, transparent 82%);
	}

	.landing-hero__orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(110px);
		pointer-events: none;
	}

	.landing-hero__orb--one {
		width: 46rem;
		height: 46rem;
		right: -10%;
		top: -16%;
		background: oklch(0.52 0.22 277 / 18%);
	}

	.landing-hero__orb--two {
		width: 28rem;
		height: 28rem;
		left: -2%;
		top: 16%;
		background: oklch(0.58 0.18 255 / 9%);
	}

	/* Capped to the stage width below it so the headline, the deck, and the
	   workspace all break on the same left and right edges. */
	.landing-hero__lede {
		display: grid;
		gap: clamp(1.75rem, 3.2vw, 3.25rem);
		width: 100%;
		max-width: 78rem;
		margin-inline: auto;
	}

	/* Sized so each sentence holds its own line from 1000px up: the longest of
	   the two runs 12.92em, which clears the 78rem stage at the 5.75rem cap. */
	h1 {
		font-size: clamp(2.75rem, 7.2vw, 5.75rem);
		text-wrap: balance;
	}

	/* Blocks rather than an inline run, so the colour change always lands on a
	   line start instead of mid-sentence when the headline wraps. */
	h1 span {
		display: block;
		color: var(--m-accent-text);
	}

	.landing-hero__aside {
		display: grid;
		gap: 1.9rem;
	}

	@media (min-width: 1000px) {
		.landing-hero__aside {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: start;
			gap: clamp(2.5rem, 4vw, 4rem);
		}
	}

	.landing-hero__deck {
		color: var(--m-text-2);
		font-size: clamp(1.08rem, 1.5vw, 1.3rem);
		line-height: 1.62;
		max-width: 52ch;
	}

	.landing-hero__cta {
		display: grid;
		gap: 1.15rem;
	}

	@media (min-width: 1000px) {
		.landing-hero__cta {
			position: relative;
			padding-left: 2.15rem;
			justify-items: start;
		}

		.landing-hero__cta::before {
			content: '';
			position: absolute;
			left: 0;
			top: 0.35rem;
			bottom: 0.35rem;
			width: 1px;
			background: linear-gradient(to bottom, var(--m-accent-line), oklch(1 0 0 / 4%));
		}
	}

	.landing-hero__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.landing-hero__meta {
		color: var(--m-text-3);
		font-size: 0.8125rem;
		line-height: 1.5;
	}

	.landing-hero__visual {
		display: flex;
		align-items: flex-end;
		width: 100%;
		margin-top: clamp(1.75rem, 3vw, 3rem);
	}

	/* Capped below the source capture's intrinsic width (1694px) so the workspace
	   is never upscaled. Going wider than this is what made it look soft. */
	.landing-hero__stage {
		position: relative;
		width: 100%;
		max-width: 78rem;
		margin-inline: auto;
	}

	.landing-hero__stage :global(.marketing-shot) {
		width: 100%;
	}

	.landing-hero__animate {
		animation: landing-hero-entrance 0.72s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.landing-hero__delay-1 {
		animation-delay: 0.06s;
	}

	.landing-hero__delay-2 {
		animation-delay: 0.16s;
	}

	.landing-hero__delay-3 {
		animation-delay: 0.28s;
	}

	@media (prefers-reduced-motion: reduce) {
		.landing-hero__animate {
			animation: none;
		}
	}
</style>
