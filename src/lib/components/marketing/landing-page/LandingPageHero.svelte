<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, Check, Mail } from '@lucide/svelte';

	import { Button } from '$lib/components/ui/button';

	import { sessionParticipants } from './content';

	const totalExpected = sessionParticipants.length;
	const totalSigned = sessionParticipants.filter(
		(participant) => participant.status === 'signed'
	).length;
	const totalPending = totalExpected - totalSigned;
	const completionPercent =
		totalExpected === 0 ? 0 : Math.round((totalSigned / totalExpected) * 100);
</script>

<section
	class="mkt-hero relative flex flex-col items-center justify-start overflow-hidden px-4 pb-36 sm:px-6"
>
	<!-- Subtle dot grid -->
	<div class="landing-hero__grid absolute inset-0" aria-hidden="true"></div>

	<div
		class="relative z-10 mx-auto flex w-full max-w-[680px] min-w-0 flex-col items-center text-center"
	>
		<h1
			class="landing-hero__animate landing-hero__delay-1 mb-7 max-w-full font-black tracking-tight text-balance"
		>
			Your waiver is your
			<span class="landing-hero__accent">best customer list.</span>
		</h1>

		<p
			class="landing-hero__animate landing-hero__delay-2 mx-auto mb-9 max-w-[500px] text-[17px] leading-relaxed"
			style="color: var(--m-text-2);"
		>
			Waiver Director captures every participant&apos;s email when they sign — not just the lead
			booker. Automated follow-ups help you gather feedback and reviews after each visit.
		</p>

		<div
			class="landing-hero__animate landing-hero__delay-3 flex flex-wrap items-center justify-center gap-3"
		>
			<Button
				href={resolve('/sign-up')}
				class="btn-mkt-accent h-11 gap-2 rounded-xl px-8 text-sm font-semibold"
			>
				Start for free
				<ArrowRight size={15} aria-hidden="true" />
			</Button>
			<Button
				href={resolve('/#how-it-works')}
				variant="outline"
				class="btn-mkt-outline h-11 rounded-xl px-8 text-sm font-medium"
			>
				See how it works
			</Button>
		</div>
		<p
			class="landing-hero__animate landing-hero__delay-3 mt-4 text-[12px]"
			style="color: var(--m-text-3);"
		>
			Free to start · No credit card required · Cancel anytime
		</p>
	</div>

	<!-- Ambient glow ring behind the mockup -->
	<div
		class="landing-hero__animate landing-hero__delay-4 pointer-events-none relative z-10 mx-auto mt-16 w-full max-w-5xl"
	>
		<div class="landing-hero__mockup-glow" aria-hidden="true"></div>

		<!-- Mockup card -->
		<div
			class="landing-hero__mockup-card relative overflow-hidden rounded-2xl border"
			style="background: var(--m-surface); border-color: var(--m-border-strong); box-shadow: 0 24px 64px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 6%);"
		>
			<!-- Title bar -->
			<div
				class="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:h-9 sm:flex-nowrap sm:px-4 sm:py-0"
				style="background: var(--m-card); border-color: var(--m-border-soft);"
			>
				<div class="order-1 flex shrink-0 items-center gap-1.5" aria-hidden="true">
					<div class="h-2.5 w-2.5 rounded-full" style="background: #ff5f57;"></div>
					<div class="h-2.5 w-2.5 rounded-full" style="background: #febc2e;"></div>
					<div class="h-2.5 w-2.5 rounded-full" style="background: #28c840;"></div>
				</div>
				<div
					class="order-3 max-w-full min-w-0 basis-full truncate rounded-md border px-2 py-1 text-center text-[10px] sm:order-2 sm:max-w-[min(100%,14rem)] sm:basis-auto sm:px-3 sm:text-[11px]"
					style="border-color: var(--m-border-soft); background: var(--m-elevated); color: var(--m-text-3);"
					aria-hidden="true"
				>
					/sessions (preview)
				</div>
				<div class="order-2 flex shrink-0 items-center gap-1.5 sm:order-3">
					<span
						class="landing-hero__live-dot h-1.5 w-1.5 rounded-full"
						style="background: var(--m-green);"
						aria-hidden="true"
					></span>
					<span class="text-[11px] font-semibold" style="color: var(--m-green);">LIVE</span>
				</div>
			</div>

			<div class="p-5 md:p-6">
				<div
					class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
				>
					<div class="min-w-0">
						<p class="mb-1 text-[10px] tracking-widest uppercase" style="color: var(--m-text-3);">
							Active Session
						</p>
						<h2 class="landing-hero__session-title mb-0.5 text-[15px] font-bold sm:text-[17px]">
							Wilderness Zipline Tour
						</h2>
						<p class="text-[12px]" style="color: var(--m-text-3);">Today · 2:00 PM · via Bookeo</p>
					</div>
					<div
						class="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-4 md:gap-8"
					>
						<div class="text-center">
							<div
								class="mb-1 text-[18px] leading-none font-bold sm:text-[22px]"
								style="color: var(--m-green);"
							>
								{totalSigned}
							</div>
							<div class="text-[10px] tracking-wide uppercase" style="color: var(--m-text-3);">
								Signed
							</div>
						</div>
						<div class="text-center">
							<div class="mb-1 text-[18px] leading-none font-bold sm:text-[22px]">
								{totalExpected}
							</div>
							<div class="text-[10px] tracking-wide uppercase" style="color: var(--m-text-3);">
								Expected
							</div>
						</div>
						<div class="text-center">
							<div
								class="mb-1 text-[18px] leading-none font-bold sm:text-[22px]"
								style="color: var(--m-amber);"
							>
								{totalPending}
							</div>
							<div class="text-[10px] tracking-wide uppercase" style="color: var(--m-text-3);">
								Pending
							</div>
						</div>
					</div>
				</div>

				<div
					class="mb-5 h-1.5 overflow-hidden rounded-full"
					style="background: var(--m-elevated);"
					role="progressbar"
					aria-valuenow={completionPercent}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label={`Waiver completion: ${completionPercent}%`}
				>
					<div
						class="landing-hero__progress-fill h-full rounded-full"
						style="background: var(--m-green); --landing-hero-completion: {completionPercent}%;"
					></div>
				</div>

				<div class="flex flex-col gap-1.5">
					{#each sessionParticipants as participant (participant.id)}
						<div
							class={[
								'flex items-center gap-3 rounded-lg border px-3 py-2',
								participant.status === 'signed'
									? 'border-(--m-green-border) bg-(--m-green-soft)'
									: 'border-(--m-amber-border) bg-(--m-amber-soft)'
							]}
						>
							<div
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
								style="background: var(--m-elevated); color: var(--m-text-3);"
								aria-hidden="true"
							>
								{participant.name[0]}
							</div>
							<span class="min-w-0 flex-1 truncate text-[13px] font-medium">
								{participant.name}
							</span>
							<span class="hidden text-[11px] sm:block" style="color: var(--m-text-3);">
								{participant.email}
							</span>
							{#if participant.status === 'signed'}
								<span
									class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
									style="background: var(--m-green-dim); color: var(--m-green);"
								>
									<Check class="size-2.5" aria-hidden="true" />
									Signed
								</span>
								<span class="hidden shrink-0 text-[11px] md:block" style="color: var(--m-text-3);">
									2 emails queued
								</span>
							{:else}
								<span
									class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
									style="background: var(--m-amber-dim); color: var(--m-amber);"
								>
									Pending
								</span>
								<span class="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold">
									Send reminder
								</span>
							{/if}
						</div>
					{/each}
				</div>

				<div
					class="mt-4 flex items-start gap-2.5 rounded-lg border px-4 py-3"
					style="border-color: var(--m-border-strong); background: var(--m-elevated);"
				>
					<Mail
						size={14}
						class="mt-0.5 shrink-0"
						style="color: var(--primary);"
						aria-hidden="true"
					/>
					<p class="text-[12px] leading-relaxed" style="color: var(--m-text-2);">
						<strong>{totalSigned ?? 0} follow-up emails scheduled</strong> — one per guest who signed,
						not just the lead. Use them for thank-yous, feedback, and review requests.
					</p>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	@keyframes landing-hero-entrance {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes landing-hero-pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.8);
		}
	}

	@keyframes landing-hero-progress {
		from {
			width: 0%;
		}
		to {
			width: var(--landing-hero-completion);
		}
	}

	@keyframes landing-hero-glint {
		0%,
		82%,
		90%,
		100% {
			background-position: 0% 50%;
		}
		86% {
			background-position: 100% 50%;
		}
	}

	.landing-hero__grid {
		background-image: radial-gradient(circle, oklch(1 0 0 / 9%) 1px, transparent 1px);
		background-size: 28px 28px;
		mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 100%);
	}

	.landing-hero__animate {
		animation: landing-hero-entrance 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.landing-hero__delay-1 {
		animation-delay: 0.05s;
	}
	.landing-hero__delay-2 {
		animation-delay: 0.15s;
	}
	.landing-hero__delay-3 {
		animation-delay: 0.25s;
	}
	.landing-hero__delay-4 {
		animation-delay: 0.35s;
	}

	h1 {
		font-family: var(--m-font-display);
		font-size: clamp(44px, 7vw, 82px);
		letter-spacing: -0.035em;
		line-height: 1.05;
	}

	.landing-hero__session-title {
		font-family: var(--m-font-display);
	}

	.landing-hero__accent {
		background: linear-gradient(
			98deg,
			oklch(0.51 0.21 277) 0%,
			oklch(0.6 0.18 277) 42%,
			oklch(0.68 0.14 277) 50%,
			oklch(0.6 0.18 277) 58%,
			oklch(0.51 0.21 277) 100%
		);
		background-size: 220% 100%;
		background-position: 0% 50%;
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		animation: landing-hero-glint 13s ease-in-out infinite;
	}

	.landing-hero__live-dot {
		animation: landing-hero-pulse 1.8s ease-in-out infinite;
	}

	.landing-hero__progress-fill {
		animation: landing-hero-progress 1.2s 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
		--landing-hero-completion: 0%;
		width: var(--landing-hero-completion);
	}

	.landing-hero__mockup-glow {
		position: absolute;
		top: -20%;
		left: 50%;
		transform: translateX(-50%);
		width: 70%;
		height: 60%;
		border-radius: 50%;
		background: radial-gradient(ellipse at center, oklch(0.52 0.22 277 / 22%) 0%, transparent 70%);
		filter: blur(40px);
		pointer-events: none;
		z-index: -1;
	}

	.landing-hero__mockup-card {
		position: relative;
	}

	@media (prefers-reduced-motion: reduce) {
		.landing-hero__animate,
		.landing-hero__live-dot {
			animation: none !important;
			transition: none !important;
		}

		.landing-hero__progress-fill {
			animation: none !important;
			width: var(--landing-hero-completion);
		}

		.landing-hero__accent {
			animation: none;
			background: none;
			background-size: auto;
			-webkit-text-fill-color: var(--primary);
			color: var(--primary);
		}
	}
</style>
