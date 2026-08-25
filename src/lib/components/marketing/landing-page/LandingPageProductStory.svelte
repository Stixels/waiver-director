<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, BarChart3, CalendarCheck, MailCheck, UsersRound } from '@lucide/svelte';

	import MarketingScreenshotFrame from '$lib/components/marketing/MarketingScreenshotFrame.svelte';

	const views = [
		{
			icon: CalendarCheck,
			plan: 'Pro',
			title: 'Know who is ready before check-in.',
			description:
				'Bookeo bookings arrive with their activity, time, lead customer, and expected participant count. Waiver Director puts signed coverage beside that context so staff can act before guests arrive.',
			points: [
				'Signed versus expected counts',
				'Complete, partial, and unsigned states',
				'Booking-specific signing routes'
			],
			src: '/marketing/apex-bookings.png',
			alt: 'Waiver Director bookings page showing fictional Apex Adventures activities and signed versus expected participant counts',
			label: 'Apex Adventures / Booking coverage'
		},
		{
			icon: UsersRound,
			plan: 'Pro',
			title: 'Keep the exact record that was signed.',
			description:
				'Every submission stays connected to its frozen waiver version, signer answers, signature, consent, covered minors, and the booking snapshot captured at signing.',
			points: [
				'Immutable signed versions',
				'Customer and visit history',
				'Workspace-wide record search'
			],
			src: '/marketing/apex-submissions.png',
			alt: 'Waiver Director submissions page showing fictional Apex Adventures signed records and customer visits',
			label: 'Apex Adventures / Signed records'
		},
		{
			icon: MailCheck,
			plan: 'Pro',
			title: 'See every follow-up, including the exceptions.',
			description:
				'Send reusable email immediately or schedule it from booking time. The operational queue keeps unscheduled, queued, sent, failed, and blocked delivery states available for review.',
			points: [
				'Reusable rich email templates',
				'Booking-relative scheduling',
				'Visible delivery states'
			],
			src: '/marketing/apex-follow-ups.png',
			alt: 'Waiver Director follow-up page showing fictional Apex Adventures customer email scheduling and delivery states',
			label: 'Apex Adventures / Follow-up delivery'
		},
		{
			icon: BarChart3,
			plan: 'Pro',
			title: 'Read the operation across the range that matters.',
			description:
				'Compare bookings, submissions, customer activity, and email delivery with the prior period. Change the date range without rebuilding the report or exporting a spreadsheet.',
			points: [
				'Prior-period comparisons',
				'New and returning customers',
				'Email delivery status mix'
			],
			src: '/marketing/apex-analytics.png',
			alt: 'Waiver Director analytics showing fictional Apex Adventures booking, submission, customer, and email trends',
			label: 'Apex Adventures / Operations analytics'
		}
	] as const;
</script>

<section
	class="home-story border-b"
	style="border-color: var(--m-border-soft);"
	data-gsap-pin-section
>
	<div
		class="mx-auto grid max-w-7xl gap-16 px-4 py-24 sm:px-6 md:py-32 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-20"
	>
		<div class="home-story__intro h-fit" data-gsap-pin data-gsap-copy>
			<h2 class="marketing-display text-[clamp(2.7rem,4.5vw,4.5rem)]">
				The operation stays connected as the day moves.
			</h2>
			<p class="marketing-copy mt-6">
				Bookings, signed records, follow-ups, and analytics remain in one workspace.
			</p>
			<a
				href={resolve('/features')}
				class="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-violet-300 no-underline transition-opacity hover:opacity-70"
			>
				Explore every feature <ArrowRight size={15} aria-hidden="true" />
			</a>
		</div>

		<div class="home-story__gallery">
			{#each views as view, index (view.title)}
				{@const Icon = view.icon}
				<article class="home-story__chapter">
					<MarketingScreenshotFrame
						src={view.src}
						alt={view.alt}
						label={view.label}
						priority={index === 0}
					/>

					<div class="home-story__chapter-copy" data-gsap-copy>
						<div class="flex items-center justify-between gap-4">
							<span class="home-story__icon"><Icon size={18} aria-hidden="true" /></span>
							<span class="home-story__plan">{view.plan}</span>
						</div>
						<h3
							class="mt-6 max-w-2xl text-[clamp(2rem,3.5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.05em]"
						>
							{view.title}
						</h3>
						<p class="mt-5 max-w-2xl text-base leading-7" style="color: var(--m-text-2);">
							{view.description}
						</p>
						<ul class="mt-6 grid gap-3 sm:grid-cols-3">
							{#each view.points as point (point)}
								<li class="flex items-center gap-2.5 text-sm" style="color: var(--m-text-2);">
									<span class="home-story__check" aria-hidden="true"></span>
									{point}
								</li>
							{/each}
						</ul>
					</div>
				</article>
			{/each}
		</div>
	</div>
</section>

<style>
	.home-story {
		background:
			radial-gradient(circle at 72% 38%, oklch(0.42 0.18 277 / 10%), transparent 34rem), var(--m-bg);
	}

	.home-story__intro {
		max-width: 29rem;
	}

	.home-story__gallery {
		display: grid;
		gap: clamp(7rem, 12vw, 11rem);
		min-width: 0;
	}

	.home-story__chapter {
		display: grid;
		gap: 2rem;
		min-width: 0;
	}

	.home-story__chapter-copy {
		max-width: 52rem;
	}

	.home-story__icon {
		display: inline-flex;
		width: 2.5rem;
		height: 2.5rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--m-accent-border-soft);
		border-radius: 0.75rem;
		background: var(--m-accent-dim);
		color: var(--m-accent-text);
	}

	.home-story__plan {
		font-size: 0.65rem;
		font-weight: 750;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--m-accent-text);
	}

	.home-story__check {
		width: 0.38rem;
		height: 0.38rem;
		flex: 0 0 auto;
		border-radius: 999px;
		background: var(--m-accent-text);
		box-shadow: 0 0 0 4px var(--m-accent-dim);
	}
</style>
