<script lang="ts">
	import MarketingFooter from '$lib/components/marketing/MarketingFooter.svelte';
	import MarketingNav from '$lib/components/marketing/MarketingNav.svelte';

	import '../(marketing)/marketing-layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800;12..96,900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="mkt flex min-h-screen flex-col">
	<a
		href="#auth-main"
		class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:rounded-lg focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:ring-2 focus:ring-offset-2 focus:ring-offset-[oklch(0.09_0.006_286)] focus:outline-none"
		style="--tw-ring-color: var(--primary); background: var(--primary); color: var(--primary-foreground);"
	>
		Skip to main content
	</a>
	<MarketingNav />
	<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
		<main id="auth-main" class="flex flex-1 flex-col pt-(--mkt-nav-offset)" tabindex="-1">
			{@render children()}
		</main>
		<MarketingFooter />
	</div>
</div>
