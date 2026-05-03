<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Check } from '@lucide/svelte';
	import { scrollReveal } from '$lib/actions/scroll-reveal';

	const tiers = [
		{
			id: 'free',
			name: 'Free',
			price: '$0',
			description: 'For getting started.',
			features: [
				'1 workspace',
				'25 submissions / month',
				'1 public waiver',
				'Basic dashboard',
				'Email support'
			],
			cta: 'Get started free',
			ctaVariant: 'outline' as const,
			ctaClass: 'btn-mkt-outline',
			popular: false,
			disabled: false
		},
		{
			id: 'pro',
			name: 'Pro',
			price: '$29',
			description: 'For serious operators.',
			features: [
				'Unlimited submissions',
				'Version history',
				'Bookeo sync',
				'More integrations coming soon',
				'On-demand and delayed emails',
				'Full analytics',
				'Team access',
				'PDF export',
				'Audit trail'
			],
			cta: 'Start free trial',
			ctaVariant: 'default' as const,
			ctaClass: 'btn-mkt-accent',
			popular: true,
			disabled: false
		},
		{
			id: 'business',
			name: 'Business',
			price: '$79',
			description: 'For multi-location operators.',
			features: [
				'Everything in Pro',
				'Multiple workspaces',
				'Priority support',
				'Custom email sender domain',
				'SLA guarantee',
				'Dedicated onboarding'
			],
			cta: 'Contact sales',
			ctaVariant: 'outline' as const,
			ctaClass: '',
			popular: false,
			disabled: true
		}
	] as const;
</script>

<div class="mx-auto max-w-5xl" use:scrollReveal={{ delay: 80 }}>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each tiers as tier (tier.id)}
			<div
				class="pricing-card relative flex flex-col gap-6 rounded-2xl border p-7"
				class:pricing-card--popular={tier.popular}
				style={tier.popular
					? 'border-color: oklch(0.52 0.22 277 / 40%); background: var(--m-card);'
					: 'border-color: var(--m-border-strong); background: var(--m-card);'}
			>
				{#if tier.popular}
					<!-- Top accent line on popular card -->
					<div
						class="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl"
						style="background: linear-gradient(90deg, transparent 10%, oklch(0.52 0.22 277 / 70%) 50%, transparent 90%);"
						aria-hidden="true"
					></div>
					<div
						class="absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
						style="background: var(--m-accent-dim); color: var(--primary); border: 1px solid var(--m-accent-border-soft);"
					>
						Popular
					</div>
				{/if}

				<div>
					<p
						class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
						style={tier.popular ? 'color: var(--primary);' : 'color: var(--m-text-3);'}
					>
						{tier.name}
					</p>
					<p
						class="mb-2 leading-none font-black tabular-nums"
						style="font-family: 'Bricolage Grotesque', sans-serif; font-size: 2.25rem; letter-spacing: -0.03em;"
					>
						{tier.price}
						<span class="text-[14px] font-medium tracking-normal" style="color: var(--m-text-3);"
							>/ mo</span
						>
					</p>
					<p class="text-[13px]" style="color: var(--m-text-2);">
						{tier.description}
					</p>
				</div>

				<ul class="flex flex-1 flex-col gap-2">
					{#each tier.features as item (item)}
						<li class="flex items-start gap-2.5 text-[13px]" style="color: var(--m-text-2);">
							<Check
								class="mt-0.5 size-3.5 shrink-0"
								style="color: var(--m-green);"
								aria-hidden="true"
							/>
							{item}
						</li>
					{/each}
				</ul>

				{#if tier.disabled}
					<button
						type="button"
						disabled
						class="flex min-h-10 w-full flex-col items-center justify-center rounded-xl border px-2 py-2 text-center leading-tight"
						style="border-color: var(--m-border-strong); color: var(--m-text-3); cursor: not-allowed;"
						aria-label="Contact sales, coming soon"
					>
						<span class="text-sm font-semibold">Contact sales</span>
						<span class="text-[11px] font-medium" style="color: var(--m-text-3);">Coming soon</span>
					</button>
				{:else}
					<Button
						href={resolve('/sign-up')}
						variant={tier.ctaVariant}
						class="{tier.ctaClass} h-10 w-full rounded-xl text-sm font-semibold"
					>
						{tier.cta}
					</Button>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.pricing-card {
		transition:
			transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (hover: hover) {
		.pricing-card:hover {
			transform: translateY(-2px);
			box-shadow:
				0 0 0 1px oklch(1 0 0 / 8%),
				0 16px 48px oklch(0 0 0 / 40%);
		}

		.pricing-card--popular:hover {
			box-shadow:
				0 0 0 1px oklch(0.52 0.22 277 / 35%),
				0 16px 48px oklch(0 0 0 / 40%),
				0 0 60px oklch(0.52 0.22 277 / 10%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pricing-card {
			transition: none !important;
		}
		.pricing-card:hover {
			transform: none;
		}
	}
</style>
