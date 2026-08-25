<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		BarChart3,
		CalendarCheck,
		Check,
		FileClock,
		FileDown,
		MailCheck,
		UsersRound
	} from '@lucide/svelte';

	import bookeoLogo from '$lib/assets/providers/bookeo-icon.webp';
	import mailchimpLogo from '$lib/assets/providers/mailchimp-icon.webp';
	import MarketingMotion from '$lib/components/marketing/MarketingMotion.svelte';
	import MarketingScreenshotFrame from '$lib/components/marketing/MarketingScreenshotFrame.svelte';
	import { Button } from '$lib/components/ui/button';

	const pageTitle = 'Features | Waiver Director';
	const pageDescription =
		'Explore Waiver Director features for waiver creation, Bookeo booking coverage, signed records, customer follow-ups, Mailchimp, and operations analytics.';
	const siteBase = (PUBLIC_APP_URL ?? '').replace(/\/$/, '');
	const canonicalUrl = siteBase ? `${siteBase}/features` : '';
	const roadmapItems = [
		{
			icon: FileDown,
			name: 'PDF exports',
			description: 'Owners can export signed records'
		},
		{
			icon: CalendarCheck,
			name: 'Xola',
			description: 'Connect bookings to waiver activity'
		},
		{
			icon: MailCheck,
			name: 'Constant Contact',
			description: 'Sync customers who agree to marketing'
		}
	] as const;

	const productAreas = [
		{
			id: 'waivers',
			icon: FileClock,
			plan: 'Free to draft, Pro to publish',
			title: 'Waiver builder and public signing',
			description:
				'Draft the complete signing experience for free. Pro workspaces can publish a frozen version and collect signed records without future edits changing what a guest accepted.',
			detail:
				'Publishing creates a durable snapshot of the document and every field in it. Guests receive a focused, branded signing flow while your team keeps drafts and signed versions clearly separated.',
			points: [
				'Rich text editor and branding',
				'Text, date, select, and checkbox fields',
				'Drawn signatures, minors, and consent',
				'Published version history',
				'Public links, embeds, and QR codes'
			],
			src: '/marketing/apex-waiver-builder.png',
			alt: 'Waiver Director waiver builder populated with the fictional Apex Adventures participation waiver',
			label: 'Apex Adventures / Waiver builder'
		},
		{
			id: 'operations',
			icon: CalendarCheck,
			plan: 'Pro',
			title: 'Booking coverage',
			description:
				'Bring Bookeo activity, timing, booking number, lead customer, and participant counts into Waiver Director. Staff can see incomplete coverage before guests arrive.',
			detail:
				'Filter the day, open the booking context, and share a booking-specific signing route when coverage is incomplete. Updates from Bookeo keep the operating view aligned with the source booking.',
			points: [
				'Booking imports and webhook updates',
				'Signed versus expected counts',
				'Complete, partial, and unsigned states',
				'Booking-specific QR codes',
				'Activity and customer context'
			],
			src: '/marketing/apex-bookings.png',
			alt: 'Waiver Director Bookeo booking operations showing fictional activities and participant waiver coverage',
			label: 'Apex Adventures / Booking coverage'
		},
		{
			id: 'customers',
			icon: UsersRound,
			plan: 'Pro',
			title: 'Signed records and customers',
			description:
				'Keep the exact waiver version, signer details, answers, signatures, consent, covered minors, and booking snapshot together as one durable record.',
			detail:
				'Search the workspace by signer or visit, inspect every captured answer, and follow a customer across repeat visits without losing the context of what was signed each time.',
			points: [
				'Immutable signed versions',
				'Answers and signatures',
				'Minor and consent records',
				'Booking snapshots',
				'Customer history and search'
			],
			src: '/marketing/apex-submissions.png',
			alt: 'Waiver Director signed submissions page with fictional Apex Adventures signer records',
			label: 'Apex Adventures / Signed records'
		},
		{
			id: 'follow-ups',
			icon: MailCheck,
			plan: 'Pro',
			title: 'Customer follow-ups',
			description:
				'Create reusable emails, send them immediately, or schedule them relative to booking time. The queue keeps delivery work visible instead of hiding it in automation.',
			detail:
				'Templates and delivery rules stay reusable, while the operational queue makes scheduled, blocked, queued, sent, and failed messages available for staff review.',
			points: [
				'Reusable rich email templates',
				'Send now or schedule later',
				'Booking-relative delivery',
				'Queued, sent, and failed states',
				'Unscheduled message review'
			],
			src: '/marketing/apex-follow-ups.png',
			alt: 'Waiver Director follow-up queue with fictional Apex Adventures signer emails and delivery states',
			label: 'Apex Adventures / Follow-up queue'
		},
		{
			id: 'analytics',
			icon: BarChart3,
			plan: 'Pro',
			title: 'Operations analytics',
			description:
				'Review the operational picture across the date range that matters, with prior-period comparisons for bookings, submissions, customers, and email delivery.',
			detail:
				'Use one reporting surface to understand volume, coverage, audience growth, repeat customers, and follow-up delivery—then change the range without rebuilding the report.',
			points: [
				'Custom date ranges',
				'Prior-period comparisons',
				'Booking and submission trends',
				'New and returning customers',
				'Email delivery status mix'
			],
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
		<p class="marketing-kicker">Product capabilities</p>
		<h1 class="features-hero__title marketing-display mt-7 max-w-5xl text-[clamp(3rem,7vw,6.5rem)]">
			See exactly what Waiver Director does.
		</h1>
		<div class="mt-8 grid max-w-5xl gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
			<p class="marketing-copy max-w-2xl">
				Build waivers, monitor booking coverage, protect signed records, send follow-ups, and report
				from one workspace.
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

<nav class="features-jump border-b" aria-label="Feature categories">
	<div class="mx-auto flex max-w-6xl gap-7 overflow-x-auto px-4 py-4 sm:px-6">
		<a href="#waivers">Waivers</a>
		<a href="#operations">Bookings</a>
		<a href="#customers">Records</a>
		<a href="#follow-ups">Follow-ups</a>
		<a href="#analytics">Analytics</a>
		<a href="#integrations">Integrations</a>
	</div>
</nav>

<section class="features-detail border-b" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
		<div class="max-w-3xl" data-gsap-copy>
			<h2 class="marketing-display text-[clamp(2.6rem,5vw,4.8rem)]">
				Follow the work from waiver to follow-up.
			</h2>
			<p class="marketing-copy mt-6 max-w-2xl">
				Five real product surfaces, populated with fictional Apex Adventures data and shown at a
				scale where the operational details are clear.
			</p>
		</div>

		<div class="mt-16 grid gap-24 md:gap-32">
			{#each productAreas as area, index (area.id)}
				{@const Icon = area.icon}
				<article
					id={area.id}
					class={`features-detail__row ${index % 2 === 1 ? 'features-detail__row--reverse' : ''}`}
				>
					<div class="features-detail__copy" data-gsap-copy>
						<div class="flex items-center justify-between gap-4">
							<span class="features-icon"><Icon size={18} aria-hidden="true" /></span>
							<span class="features-plan">{area.plan}</span>
						</div>
						<h3
							class="mt-6 text-[clamp(2.35rem,4vw,4.4rem)] leading-[0.98] font-semibold tracking-[-0.055em]"
						>
							{area.title}
						</h3>
						<p class="mt-6 text-base leading-7" style="color: var(--m-text-2);">
							{area.description}
						</p>
						<p class="mt-4 text-sm leading-6" style="color: var(--m-text-3);">
							{area.detail}
						</p>
						<ul class="mt-7 grid gap-3 sm:grid-cols-2">
							{#each area.points as point (point)}
								<li class="flex items-center gap-2.5 text-sm" style="color: var(--m-text-2);">
									<Check class="size-4 shrink-0 text-violet-300" aria-hidden="true" />
									{point}
								</li>
							{/each}
						</ul>
					</div>

					<MarketingScreenshotFrame
						src={area.src}
						alt={area.alt}
						label={area.label}
						priority={index === 0}
						class="features-detail__image"
					/>
				</article>
			{/each}
		</div>
	</div>
</section>

<section id="integrations" class="border-b" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
		<div class="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
			<div data-gsap-copy>
				<h2 class="marketing-display text-[clamp(2.5rem,4.5vw,4.4rem)]">
					Integrations available now.
				</h2>
				<div class="features-integrations mt-8 grid gap-4 sm:grid-cols-2">
					<article>
						<img src={bookeoLogo} alt="" width="44" height="44" class="size-11 rounded-xl" />
						<div>
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-xl font-semibold">Bookeo</h3>
								<span class="features-plan">Pro</span>
							</div>
							<p class="mt-3 text-sm leading-6" style="color: var(--m-text-2);">
								Import bookings, receive updates, and connect coverage to activity context.
							</p>
						</div>
					</article>
					<article>
						<img src={mailchimpLogo} alt="" width="44" height="44" class="size-11 rounded-xl" />
						<div>
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-xl font-semibold">Mailchimp</h3>
								<span class="features-plan">Pro</span>
							</div>
							<p class="mt-3 text-sm leading-6" style="color: var(--m-text-2);">
								Sync consenting customers to the audience configured by the workspace owner.
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
	.features-hero,
	.features-jump {
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

	.features-jump {
		position: sticky;
		top: var(--mkt-nav-offset);
		z-index: 20;
		background: oklch(0.07 0.005 286 / 90%);
		backdrop-filter: blur(18px);
	}

	.features-jump > div {
		scrollbar-width: none;
	}

	.features-jump > div::-webkit-scrollbar {
		display: none;
	}

	.features-jump a {
		flex: 0 0 auto;
		font-size: 0.72rem;
		font-weight: 650;
		color: var(--m-text-3);
		text-decoration: none;
		transition: color 0.18s ease;
	}

	.features-jump a:hover {
		color: var(--m-text-1);
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
		scroll-margin-top: calc(var(--mkt-nav-offset) + 3rem);
	}

	.features-detail__copy {
		max-width: 35rem;
	}

	.features-icon,
	.features-roadmap__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--m-accent-border-soft);
		border-radius: 0.7rem;
		background: var(--m-accent-dim);
		color: var(--m-accent-text);
	}

	.features-icon {
		width: 2.3rem;
		height: 2.3rem;
	}

	.features-roadmap__icon {
		width: 2.25rem;
		height: 2.25rem;
	}

	.features-plan {
		font-size: 0.65rem;
		font-weight: 750;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--m-accent-text);
	}

	.features-integrations article {
		display: grid;
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

	@media (prefers-reduced-motion: reduce) {
		.features-jump a {
			transition: none;
		}
	}
</style>
