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
	class="mkt-hero relative flex flex-col items-center justify-start overflow-hidden px-4 pb-32 sm:px-6"
>
	<div class="landing-hero__grid absolute inset-0 opacity-40" aria-hidden="true"></div>

	<div
		class="landing-hero__blob mkt-blob-float-a pointer-events-none absolute top-[-10%] left-[-5%] h-[420px] w-[420px] rounded-full blur-[84px] md:h-[520px] md:w-[520px] md:blur-[100px]"
		style="background: oklch(0.52 0.22 277 / 18%);"
		aria-hidden="true"
	></div>
	<div
		class="landing-hero__blob mkt-blob-float-b pointer-events-none absolute right-[-10%] bottom-[10%] h-[380px] w-[380px] rounded-full blur-[72px] md:h-[460px] md:w-[460px] md:blur-[92px]"
		style="background: oklch(0.52 0.22 277 / 12%);"
		aria-hidden="true"
	></div>
	<div
		class="relative z-10 mx-auto flex w-full max-w-[680px] min-w-0 flex-col items-center text-center"
	>
		<h1
			class="landing-hero__animate landing-hero__delay-1 mb-8 max-w-full font-black tracking-tight text-balance"
		>
			Your waiver is your
			<span class="landing-hero__accent">best customer list.</span>
		</h1>

		<p
			class="landing-hero__animate landing-hero__delay-2 mx-auto mb-10 max-w-[520px] text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]"
		>
			Waiver Director captures every participant&apos;s email when they sign, not just the lead
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
				<ArrowRight size={16} aria-hidden="true" />
			</Button>
			<Button
				href={resolve('/#how-it-works')}
				variant="outline"
				class="btn-mkt-outline h-11 rounded-xl px-8 text-sm font-medium"
			>
				See how it works
			</Button>
		</div>
	</div>

	<div
		class="landing-hero__animate landing-hero__delay-4 relative z-10 mx-auto mt-24 w-full max-w-5xl"
	>
		<div
			class="overflow-hidden rounded-xl border border-(--m-border-strong) bg-(--m-surface)"
			style="box-shadow: 0 18px 40px oklch(0 0 0 / 42%);"
		>
			<div
				class="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-(--m-border-soft) bg-(--m-card) px-3 py-2 sm:h-9 sm:flex-nowrap sm:px-4 sm:py-0"
			>
				<div class="order-1 flex shrink-0 items-center gap-1.5" aria-hidden="true">
					<div class="h-2.5 w-2.5 rounded-full" style="background: #ff5f57;"></div>
					<div class="h-2.5 w-2.5 rounded-full" style="background: #febc2e;"></div>
					<div class="h-2.5 w-2.5 rounded-full" style="background: #28c840;"></div>
				</div>
				<div
					class="order-3 max-w-full min-w-0 basis-full truncate rounded-md border border-(--m-border-soft) bg-(--m-elevated) px-2 py-1 text-center text-[10px] text-(--m-text-3) sm:order-2 sm:max-w-[min(100%,14rem)] sm:basis-auto sm:px-3 sm:text-[11px]"
					aria-hidden="true"
				>
					/sessions (preview)
				</div>
				<div class="order-2 flex shrink-0 items-center gap-1.5 sm:order-3">
					<span
						class="landing-hero__live-dot h-1.5 w-1.5 rounded-full bg-(--m-green)"
						aria-hidden="true"
					></span>
					<span class="text-[11px] font-semibold text-(--m-green)">LIVE</span>
				</div>
			</div>

			<div class="p-5 md:p-6">
				<div
					class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
				>
					<div class="min-w-0">
						<p class="mb-1 text-[10px] tracking-widest text-(--m-text-3) uppercase">
							Active Session
						</p>
						<h2 class="landing-hero__session-title mb-0.5 text-[15px] font-bold sm:text-[18px]">
							Wilderness Zipline Tour
						</h2>
						<p class="text-[12px] text-(--m-text-3)">Today · 2:00 PM · via Bookeo</p>
					</div>
					<div
						class="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3 md:gap-6"
					>
						<div class="text-center">
							<div class="mb-1 text-[18px] leading-none font-bold text-(--m-green) sm:text-[22px]">
								{totalSigned}
							</div>
							<div class="text-[10px] tracking-wide text-(--m-text-3) uppercase">Signed</div>
						</div>
						<div class="text-center">
							<div class="mb-1 text-[18px] leading-none font-bold sm:text-[22px]">
								{totalExpected}
							</div>
							<div class="text-[10px] tracking-wide text-(--m-text-3) uppercase">Expected</div>
						</div>
						<div class="text-center">
							<div class="mb-1 text-[18px] leading-none font-bold text-(--m-amber) sm:text-[22px]">
								{totalPending}
							</div>
							<div class="text-[10px] tracking-wide text-(--m-text-3) uppercase">Pending</div>
						</div>
					</div>
				</div>

				<div
					class="mb-5 h-1.5 overflow-hidden rounded-full bg-border"
					role="progressbar"
					aria-valuenow={completionPercent}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label={`Waiver completion: ${completionPercent}%`}
				>
					<div
						class="landing-hero__progress-fill h-full rounded-full bg-(--m-green)"
						style={`--landing-hero-completion: ${completionPercent}%;`}
					></div>
				</div>

				<div class="flex flex-col">
					{#each sessionParticipants as participant (participant.id)}
						<div
							class={[
								'mb-1.5 flex items-center gap-3 rounded-lg border px-3 py-2',
								participant.status === 'signed'
									? 'border-(--m-green-border) bg-(--m-green-soft)'
									: 'border-(--m-amber-border) bg-(--m-amber-soft)'
							]}
						>
							<div
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--m-elevated) text-[10px] font-bold text-muted-foreground"
								aria-hidden="true"
							>
								{participant.name[0]}
							</div>
							<span class="min-w-0 flex-1 truncate text-[13px] font-medium">
								{participant.name}
							</span>
							<span class="hidden text-[11px] text-(--m-text-3) sm:block">
								{participant.email}
							</span>
							{#if participant.status === 'signed'}
								<span
									class="flex shrink-0 items-center gap-1 rounded-full bg-(--m-green-dim) px-2 py-0.5 text-[10px] font-semibold text-(--m-green)"
								>
									<Check class="size-2.5" aria-hidden="true" />
									Signed
								</span>
								<span class="hidden shrink-0 text-[11px] text-(--m-text-3) md:block">
									2 emails queued
								</span>
							{:else}
								<span
									class="shrink-0 rounded-full bg-(--m-amber-dim) px-2 py-0.5 text-[10px] font-medium text-(--m-amber)"
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
					class="mt-4 flex items-start gap-2.5 rounded-lg border border-(--m-border-strong) bg-(--m-elevated) px-4 py-3"
				>
					<Mail size={14} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
					<p class="text-[12px] leading-relaxed text-muted-foreground">
						<strong>{totalSigned ?? 0} follow-up emails scheduled</strong> one per guest who
						signed, not just the lead.
						Use them for thank-yous, feedback, and review requests.
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
			transform: translateY(24px);
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
		85%,
		92%,
		100% {
			background-position: 0% 50%;
		}

		88.5% {
			background-position: 100% 50%;
		}
	}

	.landing-hero__grid {
		background-image: radial-gradient(circle, oklch(1 0 0 / 18%) 1px, transparent 1px);
		background-size: 24px 24px;
	}

	.landing-hero__animate {
		animation: landing-hero-entrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.landing-hero__delay-1 {
		animation-delay: 0.1s;
	}

	.landing-hero__delay-2 {
		animation-delay: 0.2s;
	}

	.landing-hero__delay-3 {
		animation-delay: 0.3s;
	}

	.landing-hero__delay-4 {
		animation-delay: 0.4s;
	}

	h1 {
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: clamp(46px, 7vw, 80px);
		letter-spacing: -0.03em;
		line-height: 1.06;
	}

	.landing-hero__session-title {
		font-family: 'Bricolage Grotesque', sans-serif;
	}

	.landing-hero__accent {
		background: linear-gradient(
			95deg,
			oklch(0.51 0.21 277) 0%,
			oklch(0.52 0.22 277) 42%,
			oklch(0.6 0.16 277) 50%,
			oklch(0.52 0.22 277) 58%,
			oklch(0.51 0.21 277) 100%
		);
		background-size: 220% 100%;
		background-position: 0% 50%;
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		animation: landing-hero-glint 11s ease-in-out infinite;
	}

	.landing-hero__live-dot {
		animation: landing-hero-pulse 1.8s ease-in-out infinite;
	}

	.landing-hero__progress-fill {
		animation: landing-hero-progress 1.2s 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
		--landing-hero-completion: 0%;
		width: var(--landing-hero-completion);
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
