<script lang="ts">
	import MarketingFooter from '$lib/components/marketing/MarketingFooter.svelte';
	import MarketingNav from '$lib/components/marketing/MarketingNav.svelte';

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
	<MarketingNav />
	<main id="marketing-main" class="flex flex-1 flex-col">
		{@render children()}
	</main>
	<MarketingFooter />
</div>

<style>
	.mkt {
		--m-bg: oklch(0.09 0.006 286);
		--m-surface: oklch(0.13 0.008 286);
		--m-elevated: oklch(0.17 0.01 286);
		--m-card: oklch(0.15 0.009 286);
		--m-border: oklch(1 0 0 / 8%);
		--m-border-strong: oklch(1 0 0 / 14%);
		--m-accent: oklch(0.52 0.22 277);
		--m-accent-fg: oklch(0.97 0.01 277);
		--m-accent-glow: oklch(0.52 0.22 277 / 28%);
		--m-accent-dim: oklch(0.52 0.22 277 / 12%);
		--m-green: oklch(0.65 0.22 155);
		--m-green-dim: oklch(0.65 0.22 155 / 15%);
		--m-amber: oklch(0.78 0.18 75);
		--m-amber-dim: oklch(0.78 0.18 75 / 15%);
		--m-text: oklch(0.97 0 0);
		--m-text-2: oklch(0.72 0.012 286);
		--m-text-3: oklch(0.48 0.016 286);
		background: var(--m-bg);
		color: var(--m-text);
	}
</style>
