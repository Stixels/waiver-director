<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { scrollReveal } from '$lib/actions/scroll-reveal';
	import MarketingFaq from '$lib/components/marketing/MarketingFaq.svelte';
	import MarketingPricing from '$lib/components/marketing/MarketingPricing.svelte';

	const siteBase = (PUBLIC_APP_URL ?? '').replace(/\/$/, '');
	const canonicalUrl = siteBase ? `${siteBase}/pricing` : '';

	const faqs = [
		{
			id: 'change-plans',
			q: 'Can I change plans at any time?',
			a: "Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period. You'll never be locked in."
		},
		{
			id: 'submissions',
			q: 'Can I collect submissions on Free?',
			a: 'Free is for setup and preview. Upgrade to Pro or start a Pro trial to publish a live waiver and accept signed submissions.'
		},
		{
			id: 'guest-accounts',
			q: 'Do guests need to create an account to sign?',
			a: 'No. Guests follow a link (email, SMS, or booking confirmation) and sign directly from their phone or browser. No account required — just their name, signature, and any required fields.'
		},
		{
			id: 'integrations',
			q: 'How do the booking system integrations work?',
			a: 'Connect Bookeo once from your integrations settings. After that, upcoming bookings sync with expected participant counts. Each workspace connects one booking provider at a time. Additional providers remain roadmap items.'
		},
		{
			id: 'email-verification',
			q: 'Do I need to verify my email to send follow-ups?',
			a: 'Yes. Verify your reply-to email to finish email setup and send on-demand or delayed follow-up messages from your workspace.'
		},
		{
			id: 'free-trial',
			q: 'Is there a free trial for the Pro plan?',
			a: 'Yes. The Pro plan includes a free trial so you can test all features — unlimited submissions, automation, analytics — before your card is charged. No credit card required to start.'
		},
		{
			id: 'data',
			q: 'Who owns the signed waiver data?',
			a: 'You do. Signed records belong to your workspace and remain tied to the published waiver version that was signed. Owner-only PDF exports are planned but are not available yet.'
		}
	] as const;
</script>

<svelte:head>
	<title>Pricing — Waiver Director</title>
	<meta
		name="description"
		content="Simple, transparent pricing for Waiver Director. Start free for setup and preview. Upgrade to Pro for live waiver publishing, automation, and analytics."
	/>
	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
	{/if}
</svelte:head>

<!-- Page hero -->
<section
	class="border-b px-4 pt-36 pb-28 text-center sm:px-6 md:pt-48 md:pb-36"
	style="border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-3xl" use:scrollReveal={{ delay: 0 }}>
		<p
			class="mb-4 text-[11px] font-semibold tracking-widest uppercase"
			style="color: var(--primary);"
		>
			Pricing
		</p>
		<h1
			class="mb-5 font-extrabold tracking-tight text-balance"
			style="font-family: var(--m-font-display); font-size: clamp(2.2rem, 5.5vw, 3.75rem); letter-spacing: -0.035em; line-height: 1.06;"
		>
			Simple pricing, no surprises.
		</h1>
		<p class="text-[17px] leading-relaxed" style="color: var(--m-text-2);">
			Start free to build your waiver, then upgrade when you're ready to go live.
		</p>
	</div>
</section>

<!-- Pricing tiers -->
<section class="px-4 py-28 sm:px-6 md:py-36">
	<div class="mx-auto max-w-5xl">
		<MarketingPricing />
	</div>
</section>

<!-- FAQ section -->
<div use:scrollReveal={{ delay: 0 }}>
	<MarketingFaq {faqs} name="pricing-faq" />
</div>

<!-- CTA -->
<section class="border-t px-4 py-20 sm:px-6 md:py-28" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-2xl text-center" use:scrollReveal={{ delay: 0 }}>
		<h2
			class="mb-5 font-extrabold tracking-tight"
			style="font-family: var(--m-font-display); font-size: clamp(1.9rem, 4vw, 2.75rem); letter-spacing: -0.03em; line-height: 1.1;"
		>
			Start capturing every guest today.
		</h2>
		<p class="mb-8 text-[16px] leading-relaxed" style="color: var(--m-text-2);">
			Draft and preview your waiver for free, then upgrade when you are ready to publish.
		</p>
		<div class="flex flex-wrap items-center justify-center gap-3">
			<Button
				href={resolve('/sign-up')}
				class="btn-mkt-accent h-11 gap-2 rounded-xl px-8 text-sm font-semibold"
			>
				Start for free
				<ArrowRight size={15} aria-hidden="true" />
			</Button>
			<Button
				href={resolve('/features')}
				variant="outline"
				class="btn-mkt-outline h-11 rounded-xl px-8 text-sm font-medium"
			>
				Explore features
			</Button>
		</div>
		<p class="mt-4 text-[12px]" style="color: var(--m-text-3);">
			Free to start · No credit card required · Cancel anytime
		</p>
	</div>
</section>
