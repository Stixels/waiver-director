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
	<div class="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden="true">
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
			Write your waiver today.
		</h2>
		<p class="landing-cta__deck mb-9 max-w-[430px]">
			Set it up, brand it, and preview the guest page before you publish.
		</p>
		<div class="landing-cta__actions">
			<Button
				href={resolve('/sign-up')}
				class="btn-mkt-accent h-11 gap-2 rounded-xl px-10 text-sm font-semibold"
			>
				Start building free
				<ArrowRight size={15} aria-hidden="true" />
			</Button>
			<a href={resolve('/pricing')} class="landing-cta__pricing">
				See pricing
				<ArrowRight size={15} aria-hidden="true" />
			</a>
		</div>
	</div>
</section>

<style>
	.landing-cta__title {
		font-family: var(--m-font-display);
		font-size: clamp(2.2rem, 4.8vw, 3.6rem);
		letter-spacing: -0.045em;
		line-height: 1.04;
	}

	.landing-cta__deck {
		color: var(--m-text-2);
		font-size: 1rem;
		line-height: 1.7;
	}

	.landing-cta__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.7rem 1.4rem;
	}

	.landing-cta__pricing {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--m-accent-text);
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: -0.012em;
		text-decoration: none;
		transition: gap 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.landing-cta__pricing:hover {
		gap: 0.72rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.landing-cta__pricing {
			transition: none;
		}
	}
</style>
