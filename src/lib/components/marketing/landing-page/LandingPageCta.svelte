<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';

	import { scrollReveal } from '$lib/actions/scroll-reveal';
	import { Button } from '$lib/components/ui/button';
</script>

<section
	class="relative border-t py-28 md:py-36"
	style="background: var(--m-bg); border-color: var(--m-border-soft);"
>
	<!-- Thin gradient line at top -->
	<div
		class="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
		aria-hidden="true"
	>
		<div
			class="h-px w-2/3 max-w-xl"
			style="background: linear-gradient(90deg, transparent, var(--m-accent-line), transparent);"
		></div>
	</div>

	<div
		class="relative z-10 flex flex-col items-center px-4 text-center sm:px-6"
		use:scrollReveal={{ delay: 0 }}
	>
		<h2 class="landing-cta__title mb-5 max-w-2xl font-extrabold tracking-tight text-balance">
			Stop leaving half your<br />group&apos;s emails behind.
		</h2>
		<p class="mb-9 max-w-[420px] text-[16px] leading-relaxed" style="color: var(--m-text-2);">
			Every person who signs a waiver becomes a contact. Waiver Director turns your compliance step
			into your best email list.
		</p>
		<div class="flex flex-wrap items-center justify-center gap-3">
			<Button
				href={resolve('/sign-up')}
				class="btn-mkt-accent h-11 gap-2 rounded-xl px-10 text-sm font-semibold"
			>
				Get early access
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
		<p class="mt-5 text-[12px]" style="color: var(--m-text-3);">Free to start · No credit card required</p>
	</div>
</section>

<style>
	.landing-cta__title {
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: clamp(2rem, 5vw, 3.5rem);
		letter-spacing: -0.035em;
		line-height: 1.06;
	}
</style>
