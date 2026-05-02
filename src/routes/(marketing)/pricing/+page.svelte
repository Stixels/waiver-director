<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';
	import { resolve } from '$app/paths';
	import { ArrowRight, ChevronDown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { scrollReveal } from '$lib/actions/scroll-reveal';
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
			q: "What counts as a submission?",
			a: 'A submission is one completed, signed waiver from one participant. If a group of 6 signs, that counts as 6 submissions. On the Free plan, you get 25 per month. Pro gives you unlimited.'
		},
		{
			id: 'guest-accounts',
			q: 'Do guests need to create an account to sign?',
			a: 'No. Guests follow a link (email, SMS, or booking confirmation) and sign directly from their phone or browser. No account required — just their name, signature, and any required fields.'
		},
		{
			id: 'integrations',
			q: 'How do the booking system integrations work?',
			a: "Connect Bookeo or Resova once from your integrations settings. After that, upcoming sessions sync automatically — with expected participant counts. Waivers are matched to the right session without any per-session setup."
		},
		{
			id: 'free-trial',
			q: 'Is there a free trial for the Pro plan?',
			a: 'Yes. The Pro plan includes a free trial so you can test all features — unlimited submissions, automation, analytics — before your card is charged. No credit card required to start.'
		},
		{
			id: 'data',
			q: 'Who owns the signed waiver data?',
			a: 'You do. Signed records belong to your workspace. You can export any submission as a PDF at any time. If you ever leave, you keep your exports.'
		}
	] as const;

	let openFaq = $state<string | null>(null);

	function toggleFaq(id: string) {
		openFaq = openFaq === id ? null : id;
	}
</script>

<svelte:head>
	<title>Pricing — Waiver Director</title>
	<meta
		name="description"
		content="Simple, transparent pricing for Waiver Director. Start free with 25 submissions per month. Upgrade to Pro for unlimited submissions, automation, and analytics."
	/>
	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
	{/if}
</svelte:head>

<!-- Page hero -->
<section class="border-b px-4 pb-28 pt-36 text-center sm:px-6 md:pb-36 md:pt-48" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-3xl" use:scrollReveal={{ delay: 0 }}>
		<p
			class="mb-4 text-[11px] font-semibold tracking-widest uppercase"
			style="color: var(--primary);"
		>
			Pricing
		</p>
		<h1
			class="mb-5 font-extrabold tracking-tight text-balance"
			style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2.2rem, 5.5vw, 3.75rem); letter-spacing: -0.035em; line-height: 1.06;"
		>
			Simple pricing, no surprises.
		</h1>
		<p class="text-[17px] leading-relaxed" style="color: var(--m-text-2);">
			Start free and upgrade as you grow. Every plan includes core waiver functionality.
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
<section
	class="border-t px-4 py-28 sm:px-6 md:py-36"
	style="border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-3xl" use:scrollReveal={{ delay: 0 }}>
		<p
			class="mb-4 text-[11px] font-semibold tracking-widest uppercase"
			style="color: var(--primary);"
		>
			FAQ
		</p>
		<h2
			class="mb-12 font-extrabold tracking-tight"
			style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.5rem); letter-spacing: -0.025em; line-height: 1.1;"
		>
			Frequently asked questions.
		</h2>

		<div class="flex flex-col" use:scrollReveal={{ delay: 80 }}>
			{#each faqs as faq, i (faq.id)}
				<div
					class="faq-item border-t"
					style="border-color: var(--m-border-soft);"
					class:border-b={i === faqs.length - 1}
				>
					<button
						type="button"
						class="faq-trigger flex w-full items-center justify-between gap-4 py-5 text-left"
						onclick={() => toggleFaq(faq.id)}
						aria-expanded={openFaq === faq.id}
					>
						<span class="text-[15px] font-semibold leading-snug">{faq.q}</span>
						<span
							class="faq-chevron shrink-0"
							class:faq-chevron--open={openFaq === faq.id}
							aria-hidden="true"
						>
							<ChevronDown
								size={16}
								style="color: var(--m-text-3);"
							/>
						</span>
					</button>

					{#if openFaq === faq.id}
						<div class="pb-5">
							<p class="text-[14px] leading-relaxed" style="color: var(--m-text-2);">{faq.a}</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- CTA -->
<section
	class="border-t px-4 py-20 sm:px-6 md:py-28"
	style="border-color: var(--m-border-soft);"
>
	<div
		class="mx-auto max-w-2xl text-center"
		use:scrollReveal={{ delay: 0 }}
	>
		<h2
			class="mb-5 font-extrabold tracking-tight"
			style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.9rem, 4vw, 2.75rem); letter-spacing: -0.03em; line-height: 1.1;"
		>
			Start capturing every guest today.
		</h2>
		<p class="mb-8 text-[16px] leading-relaxed" style="color: var(--m-text-2);">
			Free to start. No credit card required. See how much of your guest list you've been leaving behind.
		</p>
		<div class="flex flex-wrap items-center justify-center gap-3">
			<Button
				href={resolve('/sign-up')}
				class="btn-mkt-accent h-11 gap-2 rounded-xl px-8 text-sm font-semibold"
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
		<p class="mt-4 text-[12px]" style="color: var(--m-text-3);">
			Free to start · No credit card required · Cancel anytime
		</p>
	</div>
</section>

<style>
	.faq-trigger {
		background: none;
		border: none;
		cursor: pointer;
		color: inherit;
		font-family: inherit;
		transition: color 0.15s ease;
	}

	@media (hover: hover) {
		.faq-trigger:hover span:first-child {
			color: oklch(0.97 0 0);
		}
	}

	.faq-trigger:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px oklch(0.07 0.005 286),
			0 0 0 4px oklch(0.52 0.22 277 / 40%);
		border-radius: var(--radius-md);
	}

	.faq-chevron {
		display: flex;
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.faq-chevron--open {
		transform: rotate(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.faq-chevron {
			transition: none;
		}
	}
</style>
