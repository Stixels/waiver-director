<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';

	import MarketingScreenshotFrame from '$lib/components/marketing/MarketingScreenshotFrame.svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<section class="mkt-hero landing-hero relative overflow-hidden px-4 pb-28 sm:px-6 md:pb-44">
	<div class="landing-hero__grid absolute inset-0" aria-hidden="true"></div>
	<div class="landing-hero__orb landing-hero__orb--one" aria-hidden="true"></div>
	<div class="landing-hero__orb landing-hero__orb--two" aria-hidden="true"></div>

	<div class="relative z-10 mx-auto w-full max-w-6xl">
		<div class="landing-hero__copy max-w-6xl">
			<p class="marketing-kicker landing-hero__animate landing-hero__delay-1">
				Built for experience operators
			</p>
			<h1 class="marketing-display landing-hero__animate landing-hero__delay-1 mt-7 max-w-[58rem]">
				Run every waiver operation.
				<span>One connected workspace.</span>
			</h1>

			<div
				class="landing-hero__animate landing-hero__delay-2 mt-8 grid max-w-4xl gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
			>
				<p class="marketing-copy max-w-2xl">
					Build waivers, connect Bookeo bookings, organize signed records, send follow-ups, and
					monitor the operation.
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<Button
						href={resolve('/sign-up')}
						class="btn-mkt-accent h-11 gap-2 rounded-xl px-7 text-sm font-semibold"
					>
						Start for free
						<ArrowRight size={15} aria-hidden="true" />
					</Button>
					<Button
						href={resolve('/features')}
						variant="outline"
						class="btn-mkt-outline h-11 rounded-xl px-7 text-sm font-medium"
					>
						See the product
					</Button>
				</div>
			</div>
		</div>

		<div class="landing-hero__visual landing-hero__animate landing-hero__delay-3 mt-16 lg:ml-24">
			<MarketingScreenshotFrame
				src="/marketing/apex-dashboard.png"
				alt="Waiver Director dashboard showing Apex Adventures bookings, signed waiver completion, submissions, and follow-up status"
				label="Apex Adventures / Live dashboard"
				priority
			/>
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

	.landing-hero__grid {
		background-image: radial-gradient(circle, oklch(1 0 0 / 8%) 1px, transparent 1px);
		background-size: 30px 30px;
		mask-image: linear-gradient(to bottom, black 0%, transparent 88%);
	}

	.landing-hero__orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(90px);
		pointer-events: none;
	}

	.landing-hero__orb--one {
		width: 34rem;
		height: 34rem;
		right: -4%;
		top: 18%;
		background: oklch(0.52 0.22 277 / 15%);
	}

	.landing-hero__orb--two {
		width: 24rem;
		height: 24rem;
		left: 4%;
		top: 6%;
		background: oklch(0.58 0.18 255 / 7%);
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

	h1 {
		font-size: clamp(3.25rem, 6vw, 5.7rem);
	}

	h1 span {
		display: block;
		background: linear-gradient(100deg, oklch(0.62 0.2 280), oklch(0.76 0.13 280));
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.landing-hero__visual {
		width: min(100%, 68rem);
	}

	@media (max-width: 767px) {
		h1 {
			font-size: 2.75rem;
		}

		.landing-hero__visual {
			width: 118%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.landing-hero__animate {
			animation: none;
		}
	}
</style>
