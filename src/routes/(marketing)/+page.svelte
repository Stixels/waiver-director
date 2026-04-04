<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';

	import MarketingPricing from '$lib/components/marketing/MarketingPricing.svelte';
	import LandingPageAnalyticsPreview from '$lib/components/marketing/landing-page/LandingPageAnalyticsPreview.svelte';
	import LandingPageCta from '$lib/components/marketing/landing-page/LandingPageCta.svelte';
	import LandingPageDifferentiator from '$lib/components/marketing/landing-page/LandingPageDifferentiator.svelte';
	import LandingPageFeatures from '$lib/components/marketing/landing-page/LandingPageFeatures.svelte';
	import LandingPageHero from '$lib/components/marketing/landing-page/LandingPageHero.svelte';
	import LandingPageHowItWorks from '$lib/components/marketing/landing-page/LandingPageHowItWorks.svelte';

	const pageTitle = 'Waiver Director — Digital Waivers for Any Booking Experience';
	const pageDescription =
		"Digital waivers for tours & activities: capture every guest's email, sync Bookeo/Resova/Xola, and automate follow-ups for customer feedback, review requests & reminders. Optional Mailchimp & Constant Contact.";

	const siteBase = (PUBLIC_APP_URL ?? '').replace(/\/$/, '');
	const canonicalUrl = siteBase ? `${siteBase}/` : '';
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

<LandingPageHero />
<LandingPageDifferentiator />
<LandingPageHowItWorks />
<LandingPageFeatures />
<LandingPageAnalyticsPreview />
<MarketingPricing />

<LandingPageCta />
