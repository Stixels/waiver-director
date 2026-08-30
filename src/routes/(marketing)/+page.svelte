<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';

	import LandingPageCta from '$lib/components/marketing/landing-page/LandingPageCta.svelte';
	import LandingPageFaq from '$lib/components/marketing/landing-page/LandingPageFaq.svelte';
	import LandingPageHero from '$lib/components/marketing/landing-page/LandingPageHero.svelte';
	import LandingPageSigningLine from '$lib/components/marketing/landing-page/LandingPageSigningLine.svelte';
	import MarketingMotion from '$lib/components/marketing/MarketingMotion.svelte';

	const pageTitle = 'Waiver Director - Every guest signed before they arrive';
	const pageDescription =
		'Build a digital waiver, share it by link, QR code, or embed, and see which guests still have not signed. Bookeo booking coverage, signed records, follow-up emails, and Mailchimp sync.';

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
<LandingPageSigningLine />
<LandingPageFaq />
<LandingPageCta />
<MarketingMotion />
