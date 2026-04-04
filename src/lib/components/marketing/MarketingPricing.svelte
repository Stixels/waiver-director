<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Check } from '@lucide/svelte';
</script>

<section
	id="pricing"
	class="border-t py-24"
	style="background: var(--m-bg); border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<div class="mb-12 text-center">
			<p
				class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
				style="color: var(--primary);"
			>
				Pricing
			</p>
			<h2
				class="mb-3 font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(28px, 4vw, 42px); letter-spacing: -0.02em;"
			>
				Simple pricing for every venue.
			</h2>
			<p class="text-[16px]" style="color: var(--muted-foreground);">
				Start free. Upgrade as you grow.
			</p>
		</div>

		<div class="relative mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
			<!-- Free -->
			<div
				class="pricing-card flex flex-col gap-5 rounded-2xl border p-6"
				style="border-color: var(--m-border-strong); background: var(--m-surface);"
			>
				<div>
					<p
						class="mb-1 text-[11px] font-semibold tracking-widest uppercase"
						style="color: var(--m-text-3);"
					>
						Free
					</p>
					<p
						class="text-[32px] leading-none font-black"
						style="font-family: 'Bricolage Grotesque', sans-serif;"
					>
						$0 <span class="text-[15px] font-medium" style="color: var(--m-text-3);">/ mo</span>
					</p>
					<p class="mt-2 text-[13px]" style="color: var(--muted-foreground);">
						For getting started.
					</p>
				</div>
				<ul class="flex flex-1 flex-col gap-2.5">
					{#each ['1 workspace', '25 waivers / month', '1 waiver template', 'Basic dashboard', 'Email support'] as item (item)}
						<li class="flex items-center gap-2 text-[13px]" style="color: var(--muted-foreground);">
							<Check class="size-3.5 shrink-0" style="color: var(--m-green);" aria-hidden="true" />
							{item}
						</li>
					{/each}
				</ul>
				<Button
					href={resolve('/sign-up')}
					variant="outline"
					class="btn-mkt-outline h-10 w-full rounded-lg text-sm font-semibold"
					>Get started free</Button
				>
			</div>

			<!-- Pro -->
			<div
				class="pricing-card pricing-pro relative flex flex-col gap-5 rounded-2xl border p-6"
				style="border-color: oklch(0.52 0.22 277 / 45%); background: var(--m-surface); box-shadow: 0 0 0 1px oklch(0.52 0.22 277 / 18%), 0 12px 40px oklch(0 0 0 / 35%);"
			>
				<div
					class="absolute top-4 right-4 rounded-full px-2.5 py-1 text-[10px] font-semibold"
					style="background: var(--m-accent-dim); color: var(--primary); border: 1px solid oklch(0.52 0.22 277 / 25%);"
				>
					Most popular
				</div>
				<div>
					<p
						class="mb-1 text-[11px] font-semibold tracking-widest uppercase"
						style="color: var(--primary);"
					>
						Pro
					</p>
					<p
						class="text-[32px] leading-none font-black"
						style="font-family: 'Bricolage Grotesque', sans-serif;"
					>
						$29 <span class="text-[15px] font-medium" style="color: var(--m-text-3);">/ mo</span>
					</p>
					<p class="mt-2 text-[13px]" style="color: var(--muted-foreground);">
						For serious operators.
					</p>
				</div>
				<ul class="flex flex-1 flex-col gap-2.5">
					{#each ['Unlimited waivers', 'Unlimited templates', 'Bookeo · Resova · Xola sync', 'Follow-up email automation', 'Full analytics', 'Team access', 'PDF export', 'Audit trail'] as item (item)}
						<li class="flex items-center gap-2 text-[13px]" style="color: var(--muted-foreground);">
							<Check class="size-3.5 shrink-0" style="color: var(--m-green);" aria-hidden="true" />
							{item}
						</li>
					{/each}
				</ul>
				<Button
					href={resolve('/sign-up')}
					class="btn-mkt-accent h-10 w-full rounded-lg text-sm font-semibold"
					>Start free trial</Button
				>
			</div>

			<!-- Business -->
			<div
				class="pricing-card flex flex-col gap-5 rounded-2xl border p-6"
				style="border-color: var(--m-border-strong); background: var(--m-surface);"
			>
				<div>
					<p
						class="mb-1 text-[11px] font-semibold tracking-widest uppercase"
						style="color: var(--m-text-3);"
					>
						Business
					</p>
					<p
						class="text-[32px] leading-none font-black"
						style="font-family: 'Bricolage Grotesque', sans-serif;"
					>
						$79 <span class="text-[15px] font-medium" style="color: var(--m-text-3);">/ mo</span>
					</p>
					<p class="mt-2 text-[13px]" style="color: var(--muted-foreground);">
						For multi-location operators.
					</p>
				</div>
				<ul class="flex flex-1 flex-col gap-2.5">
					{#each ['Everything in Pro', 'Multiple workspaces', 'Priority support', 'Custom email sender domain', 'SLA guarantee', 'Dedicated onboarding'] as item (item)}
						<li class="flex items-center gap-2 text-[13px]" style="color: var(--muted-foreground);">
							<Check class="size-3.5 shrink-0" style="color: var(--m-green);" aria-hidden="true" />
							{item}
						</li>
					{/each}
				</ul>
				<!-- No dedicated sales route yet; non-interactive CTA -->
				<div
					class="flex min-h-10 w-full flex-col items-center justify-center rounded-lg border px-2 py-2 text-center leading-tight"
					style="border-color: var(--m-border-strong); color: var(--muted-foreground);"
					aria-label="Contact sales, coming soon"
				>
					<span class="text-sm font-semibold">Contact sales</span>
					<span class="text-[11px] font-medium" style="color: var(--m-text-3);">Coming soon</span>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.pricing-card {
		transition:
			transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.22s ease;
	}
	.pricing-card:hover {
		transform: translateY(-3px);
		box-shadow:
			0 0 0 1px oklch(1 0 0 / 10%),
			0 16px 40px oklch(0 0 0 / 45%);
	}
	.pricing-pro {
		transition:
			transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.pricing-pro:hover {
		transform: translateY(-3px);
		box-shadow:
			0 0 0 1px oklch(0.52 0.22 277 / 30%),
			0 16px 44px oklch(0 0 0 / 45%);
	}
</style>
