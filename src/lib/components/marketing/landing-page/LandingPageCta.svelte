<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';

	import { Button } from '$lib/components/ui/button';

	import { scrollReveal } from './scrollReveal';
</script>

<section
	class="landing-reveal relative overflow-hidden border-t py-32"
	style="background: var(--m-bg); border-color: var(--m-border);"
	{@attach scrollReveal}
>
	<div class="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden="true">
		<div
			class="h-px w-3/4 max-w-2xl"
			style="background: linear-gradient(90deg, transparent, var(--m-accent-line), transparent);"
		></div>
	</div>

	<div
		class="mkt-blob-float-a pointer-events-none absolute top-[-10%] left-[5%] h-[500px] w-[500px] rounded-full blur-[130px]"
		style="background: var(--m-accent-border-soft);"
		aria-hidden="true"
	></div>
	<div
		class="mkt-blob-float-b pointer-events-none absolute right-[5%] bottom-[-15%] h-[450px] w-[450px] rounded-full blur-[110px]"
		style="background: var(--m-accent-dim);"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute top-1/2 left-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
		style="background: var(--m-accent-soft);"
		aria-hidden="true"
	></div>

	<div class="relative z-10 flex flex-col items-center gap-6 px-4 text-center sm:px-6">
		<h2 class="landing-cta__title max-w-2xl font-extrabold tracking-tight">
			Stop leaving half your<br />group&apos;s emails behind.
		</h2>
		<p class="mkt-text-2 max-w-[420px] text-[16px] leading-relaxed">
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
		<p class="mkt-text-3 text-[12px]">Free to start · No credit card required</p>
	</div>
</section>

<style>
	.landing-cta__title {
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: clamp(30px, 5vw, 60px);
		letter-spacing: -0.03em;
		line-height: 1.06;
		color: var(--m-text);
	}
</style>
