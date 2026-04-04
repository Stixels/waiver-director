<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';

	import { Button } from '$lib/components/ui/button';

	import { scrollReveal } from './scrollReveal';
</script>

<section
	class="landing-reveal landing-cta relative overflow-hidden border-t py-32"
	style="background: var(--m-bg); border-color: var(--m-border);"
	{@attach scrollReveal}
>
	<div class="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden="true">
		<div
			class="h-px w-3/4 max-w-2xl"
			style="background: linear-gradient(90deg, transparent, oklch(0.52 0.22 277 / 50%), transparent);"
		></div>
	</div>

	<div
		class="landing-cta__blob landing-cta__blob--a pointer-events-none absolute top-[-10%] left-[5%] h-[500px] w-[500px] rounded-full blur-[130px]"
		style="background: oklch(0.52 0.22 277 / 22%);"
		aria-hidden="true"
	></div>
	<div
		class="landing-cta__blob landing-cta__blob--b pointer-events-none absolute right-[5%] bottom-[-15%] h-[450px] w-[450px] rounded-full blur-[110px]"
		style="background: oklch(0.52 0.22 277 / 10%);"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute top-1/2 left-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
		style="background: oklch(0.52 0.22 277 / 8%);"
		aria-hidden="true"
	></div>

	<div class="relative z-10 flex flex-col items-center gap-6 px-4 text-center sm:px-6">
		<h2 class="landing-cta__title max-w-2xl font-extrabold tracking-tight">
			Stop leaving half your<br />group&apos;s emails behind.
		</h2>
		<p class="max-w-[420px] text-[16px] leading-relaxed" style="color: var(--m-text-2);">
			Every person who signs a waiver becomes a contact. Waiver Director turns your compliance step
			into your best email list.
		</p>
		<div class="flex flex-col items-center gap-3 sm:flex-row">
			<Button
				href={resolve('/sign-up')}
				class="btn-mkt-accent h-12 gap-2 rounded-xl px-10 text-sm font-semibold"
			>
				Get early access
				<ArrowRight size={16} aria-hidden="true" />
			</Button>
		</div>
		<p class="text-[12px]" style="color: var(--m-text-3);">
			Free to start · No credit card required
		</p>
	</div>
</section>

<style>
	@keyframes landing-cta-float-a {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}

		33% {
			transform: translate(30px, -40px) scale(1.05);
		}

		66% {
			transform: translate(-20px, 20px) scale(0.97);
		}
	}

	@keyframes landing-cta-float-b {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}

		33% {
			transform: translate(-40px, 30px) scale(1.04);
		}

		66% {
			transform: translate(25px, -25px) scale(0.98);
		}
	}

	.landing-cta__blob--a {
		animation: landing-cta-float-a 18s ease-in-out infinite;
	}

	.landing-cta__blob--b {
		animation: landing-cta-float-b 22s ease-in-out infinite;
	}

	.landing-cta__title {
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: clamp(30px, 5vw, 60px);
		letter-spacing: -0.03em;
		line-height: 1.06;
		color: var(--m-text);
	}

	@media (prefers-reduced-motion: reduce) {
		.landing-cta__blob {
			animation: none !important;
		}
	}
</style>
