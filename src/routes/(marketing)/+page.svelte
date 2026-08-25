<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';

	import LandingPageBuyerGuide from '$lib/components/marketing/landing-page/LandingPageBuyerGuide.svelte';
	import LandingPageCta from '$lib/components/marketing/landing-page/LandingPageCta.svelte';
	import LandingPageHero from '$lib/components/marketing/landing-page/LandingPageHero.svelte';
	import LandingPageProductStory from '$lib/components/marketing/landing-page/LandingPageProductStory.svelte';
	import MarketingMotion from '$lib/components/marketing/MarketingMotion.svelte';

	const pageTitle = 'Waiver Director - Digital Waiver Operations, Connected';
	const pageDescription =
		'Build, publish, and share digital waivers. Manage bookings, signed records, customers, follow-up emails, integrations, and analytics from one workspace.';

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
<LandingPageBuyerGuide />
<LandingPageProductStory />
<LandingPageCta />
<MarketingMotion />
