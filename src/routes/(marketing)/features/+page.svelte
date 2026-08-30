<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';
	import { resolve } from '$app/paths';
	import type { Component } from 'svelte';
	import { ArrowRight, CalendarCheck, FileDown, MailCheck } from '@lucide/svelte';

	import bookeoLogo from '$lib/assets/providers/bookeo-icon.webp';
	import mailchimpLogo from '$lib/assets/providers/mailchimp-icon.webp';
	import AnalyticsPreview from '$lib/components/marketing/features/previews/AnalyticsPreview.svelte';
	import BookingCoveragePreview from '$lib/components/marketing/features/previews/BookingCoveragePreview.svelte';
	import EmailQueuePreview from '$lib/components/marketing/features/previews/EmailQueuePreview.svelte';
	import EmailReviewPreview from '$lib/components/marketing/features/previews/EmailReviewPreview.svelte';
	import SignedRecordsPreview from '$lib/components/marketing/features/previews/SignedRecordsPreview.svelte';
	import WaiverStudioPreview from '$lib/components/marketing/features/previews/WaiverStudioPreview.svelte';
	import QrPlacementPreview from '$lib/components/marketing/landing-page/previews/QrPlacementPreview.svelte';
	import MarketingMotion from '$lib/components/marketing/MarketingMotion.svelte';
	import { Button } from '$lib/components/ui/button';

	/** Every product area renders a built preview rather than a screen capture,
	 *  so the page stays legible on a phone and never goes stale against the
	 *  app's own UI. */
	type ProductArea = {
		id: string;
		plans: readonly ('Free' | 'Pro')[];
		title: string;
		description: string;
		preview: Component;
		/** Give the copy the wide column. For areas whose preview is a single
		 *  small card, where the default split starves the text of measure. */
		wideCopy?: boolean;
	};

	const pageTitle = 'Features | Waiver Director';
	const pageDescription =
		'Waiver building, QR codes, Bookeo booking coverage, signed records, follow-up emails, and analytics — every Waiver Director feature in one place.';
	const siteBase = (PUBLIC_APP_URL ?? '').replace(/\/$/, '');
	const canonicalUrl = siteBase ? `${siteBase}/features` : '';
	const roadmapItems = [
		{
			icon: FileDown,
			name: 'PDF exports',
			description: 'Export signed records'
		},
		{
			icon: CalendarCheck,
			name: 'Xola',
			description: 'A second booking provider'
		},
		{
			icon: MailCheck,
			name: 'Constant Contact',
			description: 'A second marketing list'
		}
	] as const;

	const productAreas: readonly ProductArea[] = [
		{
			id: 'waivers',
			plans: ['Free', 'Pro'],
			title: 'Waiver builder and signing page',
			description:
				'Build the document, the questions, and the branding for free. Publishing freezes that version, so later edits never change a signed record.',
			preview: WaiverStudioPreview
		},
		{
			id: 'qr-codes',
			plans: ['Pro'],
			title: 'QR codes for the counter',
			description:
				'Every published waiver has a QR code. A guest who turns up unsigned scans it and signs on the spot, and opening that code from a booking puts the booking details on the form they sign.',
			preview: QrPlacementPreview,
			wideCopy: true
		},
		{
			id: 'operations',
			plans: ['Pro'],
			title: 'Booking coverage',
			description:
				'Connect your booking system and every booking lands with the detail your staff need, so gaps show up before guests do. Bookeo today, with Xola and more to follow.',
			preview: BookingCoveragePreview
		},
		{
			id: 'customers',
			plans: ['Pro'],
			title: 'Signed records and customers',
			description:
				'Each signature is stored against the waiver version it was signed on, with the answers given, consent, covered minors, and its booking.',
			preview: SignedRecordsPreview
		},
		{
			id: 'follow-ups',
			plans: ['Pro'],
			title: 'Customer follow-ups',
			description:
				'Write a template once, then send it now or time it against the booking. The queue shows where every message stands.',
			preview: EmailQueuePreview
		},
		{
			id: 'analytics',
			plans: ['Pro'],
			title: 'Operations analytics',
			description:
				'One report for bookings, submissions, customers, and email delivery — over any date range, measured against the prior period.',
			preview: AnalyticsPreview
		},
		{
			id: 'email-ai',
			plans: ['Pro'],
			title: 'AI review for your emails',
			description:
				'Say what the email is meant to do. The review scores your draft out of 100, names what is wrong, and proposes a rewrite you can apply as a diff.',
			preview: EmailReviewPreview
		}
	] as const;
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:type" content="website" />
	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
		<meta property="og:url" content={canonicalUrl} />
	{/if}
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<section class="features-hero relative overflow-hidden border-b px-4 sm:px-6">
	<div class="features-hero__grid absolute inset-0" aria-hidden="true"></div>
	<div class="features-hero__glow absolute" aria-hidden="true"></div>
	<div class="relative mx-auto w-full max-w-6xl pt-28 pb-20 md:pt-32 md:pb-24">
		<h1 class="features-hero__title marketing-display mt-7 max-w-5xl text-[clamp(3rem,7vw,6.5rem)]">
			See exactly what Waiver Director does.
		</h1>
		<div class="mt-8 grid max-w-5xl gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
			<p class="marketing-copy max-w-2xl">
				The product areas below ship today, shown with fictional Apex Adventures data. Building a
				waiver is free — Pro adds publishing and live operations.
			</p>
			<Button
				href={resolve('/sign-up')}
				class="btn-mkt-accent h-11 gap-2 rounded-xl px-7 text-sm font-semibold"
			>
				Start for free <ArrowRight size={15} aria-hidden="true" />
			</Button>
		</div>
	</div>
</section>

<section class="features-detail border-b" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
		<div class="grid gap-20 md:gap-24">
			{#each productAreas as area, index (area.id)}
				{@const Preview = area.preview}
				<article
					id={area.id}
					class={[
						'features-detail__row',
						index % 2 === 1 && 'features-detail__row--reverse',
						area.wideCopy && 'features-detail__row--wide-copy'
					]}
				>
					<div class="features-detail__copy" data-gsap-copy>
						<div class="flex flex-wrap items-center gap-2">
							{#each area.plans as plan (plan)}
								<span class={['features-chip', plan === 'Pro' && 'features-chip--pro']}>{plan}</span
								>
							{/each}
						</div>
						<h3
							class="mt-5 text-[clamp(2.35rem,4vw,4.4rem)] leading-[0.98] font-semibold tracking-[-0.055em]"
						>
							{area.title}
						</h3>
						<p class="mt-6 text-base leading-7" style="color: var(--m-text-2);">
							{area.description}
						</p>
					</div>

					<div class="features-detail__image">
						<Preview />
					</div>
				</article>
			{/each}
		</div>
	</div>
</section>

<section id="integrations" class="border-b" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
		<div class="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
			<div class="features-integrations__col" data-gsap-copy>
				<h2 class="marketing-display text-[clamp(2.5rem,4.5vw,4.4rem)]">
					Integrations available now.
				</h2>
				<div class="features-integrations mt-8 grid gap-4 sm:grid-cols-2">
					<article>
						<img src={bookeoLogo} alt="" width="44" height="44" class="size-11 rounded-xl" />
						<div>
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-xl font-semibold">Bookeo</h3>
								<span class="features-chip features-chip--pro">Pro</span>
							</div>
							<p class="mt-3 text-sm leading-6" style="color: var(--m-text-2);">
								Import bookings, receive updates, and see coverage per activity.
							</p>
						</div>
					</article>
					<article>
						<img src={mailchimpLogo} alt="" width="44" height="44" class="size-11 rounded-xl" />
						<div>
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-xl font-semibold">Mailchimp</h3>
								<span class="features-chip features-chip--pro">Pro</span>
							</div>
							<p class="mt-3 text-sm leading-6" style="color: var(--m-text-2);">
								Sync consenting customers to the audience you choose.
							</p>
						</div>
					</article>
				</div>
			</div>

			<aside class="features-roadmap" data-gsap-copy>
				<div>
					<p class="features-plan">Roadmap</p>
					<h2 class="mt-2 text-2xl font-semibold tracking-[-0.035em]">Planned extensions</h2>
				</div>
				<ul class="features-roadmap__list mt-5">
					{#each roadmapItems as item (item.name)}
						{@const Icon = item.icon}
						<li>
							<span class="features-roadmap__icon">
								<Icon size={17} aria-hidden="true" />
							</span>
							<div>
								<strong>{item.name}</strong>
								<p>{item.description}</p>
							</div>
						</li>
					{/each}
				</ul>
				<p class="features-roadmap__note pt-4 text-xs leading-5">
					Roadmap timing and availability may change.
				</p>
			</aside>
		</div>
	</div>
</section>

<section class="relative overflow-hidden px-4 py-24 text-center sm:px-6 md:py-32">
	<div class="features-cta__glow absolute" aria-hidden="true"></div>
	<div class="relative z-10 mx-auto flex max-w-3xl flex-col items-center">
		<h2 class="marketing-display text-[clamp(2.8rem,6vw,5.5rem)]">Build the waiver for free.</h2>
		<p class="marketing-copy mt-6 max-w-xl">
			Upgrade when you are ready to publish, collect signatures, and run live operations.
		</p>
		<div class="mt-8 flex flex-wrap justify-center gap-3">
			<Button
				href={resolve('/sign-up')}
				class="btn-mkt-accent h-11 gap-2 rounded-xl px-8 text-sm font-semibold"
			>
				Start for free <ArrowRight size={15} aria-hidden="true" />
			</Button>
			<Button
				href={resolve('/pricing')}
				variant="outline"
				class="btn-mkt-outline h-11 rounded-xl px-8 text-sm font-medium"
			>
				View pricing
			</Button>
		</div>
	</div>
</section>

<MarketingMotion />

<style>
	.features-hero {
		border-color: var(--m-border-soft);
	}

	.features-hero__grid {
		background-image: radial-gradient(circle, oklch(1 0 0 / 7%) 1px, transparent 1px);
		background-size: 30px 30px;
		mask-image: linear-gradient(to bottom, black, transparent 94%);
	}

	.features-hero__glow {
		width: 34rem;
		height: 34rem;
		right: -8rem;
		top: 0;
		border-radius: 999px;
		background: oklch(0.52 0.22 277 / 12%);
		filter: blur(100px);
	}

	.features-integrations article,
	.features-roadmap {
		border: 1px solid var(--m-border-soft);
		border-radius: 1rem;
		background: var(--m-card);
	}

	.features-detail {
		background:
			radial-gradient(circle at 72% 38%, oklch(0.42 0.18 277 / 9%), transparent 32rem), var(--m-bg);
	}

	.features-detail__row {
		display: grid;
		gap: 3rem;
		scroll-margin-top: calc(var(--mkt-nav-offset) + 2.5rem);
	}

	.features-detail__copy {
		max-width: 35rem;
	}

	.features-roadmap__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid var(--m-accent-border-soft);
		border-radius: 0.7rem;
		background: var(--m-accent-dim);
		color: var(--m-accent-text);
	}

	.features-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.65rem;
		border: 1px solid var(--m-border-soft);
		border-radius: 999px;
		background: var(--m-elevated);
		font-size: 0.72rem;
		font-weight: 650;
		color: var(--m-text-3);
	}

	.features-chip--pro {
		border-color: var(--m-accent-border-soft);
		background: var(--m-accent-dim);
		color: var(--m-accent-text);
	}

	.features-plan {
		font-size: 0.65rem;
		font-weight: 750;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--m-accent-text);
	}

	/* The roadmap card is the taller of the two columns, so the provider cards
	   grow to meet its bottom edge rather than stopping short of it. */
	.features-integrations__col {
		display: flex;
		flex-direction: column;
	}

	.features-integrations {
		flex: 1;
	}

	.features-integrations article {
		display: grid;
		align-content: start;
		gap: 1.25rem;
		padding: 1.5rem;
	}

	.features-roadmap {
		align-self: start;
		padding: 1.5rem;
		background:
			radial-gradient(circle at 5% 10%, var(--m-accent-medium), transparent 42%), var(--m-card);
	}

	.features-roadmap__list {
		border-top: 1px solid var(--m-border-soft);
	}

	.features-roadmap__list li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 0;
		border-bottom: 1px solid var(--m-border-soft);
	}

	.features-roadmap__list strong {
		font-size: 0.875rem;
		font-weight: 650;
		color: var(--m-text-1);
	}

	.features-roadmap__list p {
		margin-top: 0.15rem;
		font-size: 0.78rem;
		line-height: 1.25rem;
		color: var(--m-text-3);
	}

	.features-roadmap__note {
		color: var(--m-text-3);
	}

	.features-cta__glow {
		width: 40rem;
		height: 20rem;
		left: 50%;
		bottom: -12rem;
		transform: translateX(-50%);
		border-radius: 999px;
		background: oklch(0.52 0.22 277 / 18%);
		filter: blur(90px);
	}

	@media (min-width: 64rem) {
		.features-detail__row {
			grid-template-columns: minmax(20rem, 0.82fr) minmax(0, 1.38fr);
			align-items: center;
			gap: clamp(3rem, 5vw, 5.75rem);
		}

		.features-detail__row--reverse {
			grid-template-columns: minmax(0, 1.38fr) minmax(20rem, 0.82fr);
		}

		/* A single QR card does not need 728px, and the copy beside it was running
		   at a 40-character measure. This trades the surplus back to the text. */
		.features-detail__row--wide-copy {
			grid-template-columns: minmax(20rem, 1.35fr) minmax(0, 1fr);
		}

		.features-detail__row--wide-copy.features-detail__row--reverse {
			grid-template-columns: minmax(0, 1fr) minmax(20rem, 1.35fr);
		}

		.features-detail__row--wide-copy .features-detail__copy {
			max-width: 44rem;
		}

		.features-detail__row--reverse .features-detail__copy {
			order: 2;
		}

		.features-detail__row :global(.features-detail__image) {
			min-width: 0;
		}

		.features-detail__row--reverse :global(.features-detail__image) {
			order: 1;
		}
	}

	@media (max-width: 30rem) {
		.features-hero__title {
			font-size: 2.75rem;
		}
	}
</style>
