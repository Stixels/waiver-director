<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';
	import { resolve } from '$app/paths';
	import type { Component } from 'svelte';
	import { ArrowRight, CalendarCheck, Check, FileDown, MailCheck } from '@lucide/svelte';

	import bookeoLogo from '$lib/assets/providers/bookeo-icon.webp';
	import mailchimpLogo from '$lib/assets/providers/mailchimp-icon.webp';
	import QrPlacementPreview from '$lib/components/marketing/landing-page/previews/QrPlacementPreview.svelte';
	import MarketingMotion from '$lib/components/marketing/MarketingMotion.svelte';
	import MarketingScreenshotFrame from '$lib/components/marketing/MarketingScreenshotFrame.svelte';
	import { Button } from '$lib/components/ui/button';

	/** A product area shows either a workspace capture or a live preview
	 *  component, never both. */
	type ProductArea = {
		id: string;
		plans: readonly ('Free' | 'Pro')[];
		title: string;
		description: string;
		points: readonly string[];
		src?: string;
		alt?: string;
		label?: string;
		/** Intrinsic size of `src`, when it differs from the frame's default. */
		width?: number;
		height?: number;
		crop?: { x: number; y: number; width: number; height: number };
		preview?: Component;
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

	const productAreas: ProductArea[] = [
		{
			id: 'waivers',
			plans: ['Free', 'Pro'],
			title: 'Waiver builder and signing page',
			description:
				'Build the document, the questions, and the branding for free. Publishing freezes that version, so later edits never change a signed record.',
			points: [
				'Rich text, custom fields, branding',
				'Signatures, minors, and consent',
				'Link, QR code, or embed'
			],
			src: '/marketing/apex-waiver-builder.png',
			alt: 'Waiver Director waiver builder populated with the fictional Apex Adventures participation waiver',
			label: 'Apex Adventures / Waiver builder'
		},
		{
			id: 'qr-codes',
			plans: ['Pro'],
			title: 'QR codes for the counter',
			description:
				'Every published waiver has a QR code, and so does every booking. A guest who turns up unsigned scans and signs on the spot.',
			points: [
				'Present a QR code at the front desk',
				'One device signs the whole booking',
				'Copy a plain link instead'
			],
			preview: QrPlacementPreview
		},
		{
			id: 'operations',
			plans: ['Pro'],
			title: 'Booking coverage',
			description:
				'Connect your booking system and every booking lands with the detail your staff need, so gaps show up before guests do. Bookeo today, with Xola and more to follow.',
			points: [
				'Activity, time, and customer details',
				'Signed vs. expected counts',
				'Share a booking link or QR code'
			],
			src: '/marketing/apex-bookings.png',
			alt: 'Waiver Director Bookeo booking operations showing fictional activities and participant waiver coverage',
			label: 'Apex Adventures / Booking coverage'
		},
		{
			id: 'customers',
			plans: ['Pro'],
			title: 'Signed records and customers',
			description:
				'Each signature is stored against the waiver version it was signed on, with the answers given, consent, covered minors, and its booking.',
			points: [
				'Signed version on file',
				'Answers, signatures, and consent',
				'Customer history and search'
			],
			src: '/marketing/apex-submissions.png',
			alt: 'Waiver Director signed submissions page with fictional Apex Adventures signer records',
			label: 'Apex Adventures / Signed records'
		},
		{
			id: 'follow-ups',
			plans: ['Pro'],
			title: 'Customer follow-ups',
			description:
				'Write a template once, then send it now or time it against the booking. The queue shows where every message stands.',
			points: [
				'Reusable email templates',
				'Scheduled from booking time',
				'Queued, sent, and failed states'
			],
			src: '/marketing/apex-follow-ups.png',
			alt: 'Waiver Director follow-up queue with fictional Apex Adventures signer emails and delivery states',
			label: 'Apex Adventures / Follow-up queue'
		},
		{
			id: 'email-ai',
			plans: ['Pro'],
			title: 'AI review for your emails',
			description:
				'Say what the email is meant to do. The review scores your draft out of 100, names what is wrong, and proposes a rewrite you can apply as a diff.',
			points: [
				'Scored out of 100, with specific issues',
				'Reads your copy against send timing',
				'Apply or discard as a line diff'
			],
			src: '/marketing/apex-email-ai-review.png',
			alt: 'Waiver Director AI review panel scoring a follow-up email draft 52 out of 100, listing issues and suggestions beside a line diff of the proposed rewrite',
			label: 'Apex Adventures / AI email review',
			// This capture is the review modal over a dimmed workspace, so it is
			// taller than the 1294x912 workspace screenshots elsewhere on the page.
			width: 1942,
			height: 1609,
			// Crop to the dialog. Uncropped, the modal reads as a postage stamp in a
			// field of dead space and its body text is illegible at column width.
			crop: { x: 150, y: 275, width: 1602, height: 1129 }
		},
		{
			id: 'analytics',
			plans: ['Pro'],
			title: 'Operations analytics',
			description:
				'One report for bookings, submissions, customers, and email delivery — over any date range, measured against the prior period.',
			points: ['Any date range', 'Prior-period comparison', 'New vs. returning customers'],
			src: '/marketing/apex-analytics.png',
			alt: 'Waiver Director analytics showing fictional Apex Adventures submission, booking, customer, and email trends',
			label: 'Apex Adventures / Analytics'
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
				Everything here ships today, shown with fictional Apex Adventures data. Building a waiver is
				free — Pro adds publishing and live operations.
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
				<article
					id={area.id}
					class={`features-detail__row ${index % 2 === 1 ? 'features-detail__row--reverse' : ''}`}
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
						<ul class="mt-7 grid gap-3">
							{#each area.points as point (point)}
								<li class="flex items-center gap-2.5 text-sm" style="color: var(--m-text-2);">
									<Check class="size-4 shrink-0 text-violet-300" aria-hidden="true" />
									{point}
								</li>
							{/each}
						</ul>
					</div>

					{#if area.preview}
						{@const Preview = area.preview}
						<div class="features-detail__image features-detail__preview">
							<Preview />
						</div>
					{:else if area.src && area.alt && area.label}
						<MarketingScreenshotFrame
							src={area.src}
							alt={area.alt}
							label={area.label}
							width={area.width}
							height={area.height}
							crop={area.crop}
							priority={index === 0}
							class="features-detail__image"
						/>
					{/if}
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
