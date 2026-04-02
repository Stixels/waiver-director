<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Check } from '@lucide/svelte';
</script>

<section
	id="pricing"
	class="border-t py-24"
	style="background: var(--m-bg); border-color: var(--m-border);"
>
	<div class="mx-auto max-w-6xl px-6">
		<div class="mb-12 text-center">
			<p
				class="mb-3 text-[11px] font-semibold uppercase tracking-widest"
				style="color: var(--m-accent);"
			>
				Pricing
			</p>
			<h2
				class="mb-3 font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(28px, 4vw, 42px); letter-spacing: -0.02em; color: var(--m-text);"
			>
				Simple pricing for every venue.
			</h2>
			<p class="text-[16px]" style="color: var(--m-text-2);">Start free. Upgrade as you grow.</p>
		</div>

		<div class="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
			<!-- Free -->
			<div
				class="flex flex-col gap-5 rounded-xl border p-6"
				style="border-color: var(--m-border-strong); background: var(--m-surface);"
			>
				<div>
					<p
						class="mb-1 text-[20px] font-bold"
						style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
					>
						Free
					</p>
					<p
						class="text-[28px] font-black"
						style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
					>
						$0 <span class="text-[14px] font-medium" style="color: var(--m-text-3);">/ mo</span>
					</p>
					<p class="mt-1 text-[13px]" style="color: var(--m-text-2);">For getting started.</p>
				</div>
				<ul class="flex flex-1 flex-col gap-2.5">
					{#each ['1 workspace', '25 waivers / month', '1 waiver template', 'Basic dashboard', 'Email support'] as item (item)}
						<li class="flex items-center gap-2 text-[13px]" style="color: var(--m-text-2);">
							<Check class="size-3.5 shrink-0" style="color: var(--m-green);" aria-hidden="true" />
							{item}
						</li>
					{/each}
				</ul>
				<Button
					href={resolve('/sign-up')}
					variant="outline"
					class="h-10 w-full rounded-lg text-sm font-semibold"
					style="border-color: var(--m-border-strong); color: var(--m-text-2);"
					>Get started free</Button
				>
			</div>

			<!-- Pro -->
			<div
				class="relative flex flex-col gap-5 rounded-xl border p-6"
				style="border-color: var(--m-accent); background: var(--m-surface); box-shadow: 0 0 40px var(--m-accent-glow);"
			>
				<div
					class="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-semibold"
					style="background: var(--m-accent-dim); color: var(--m-accent);"
				>
					Most popular
				</div>
				<div>
					<p
						class="mb-1 text-[20px] font-bold"
						style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
					>
						Pro
					</p>
					<p
						class="text-[28px] font-black"
						style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
					>
						$29 <span class="text-[14px] font-medium" style="color: var(--m-text-3);">/ mo</span>
					</p>
					<p class="mt-1 text-[13px]" style="color: var(--m-text-2);">For serious operators.</p>
				</div>
				<ul class="flex flex-1 flex-col gap-2.5">
					{#each [
						'Unlimited waivers',
						'Unlimited templates',
						'Bookeo · Resova · Xola sync',
						'Email automation (all participants)',
						'Full analytics',
						'Team access',
						'PDF export',
						'Audit trail'
					] as item (item)}
						<li class="flex items-center gap-2 text-[13px]" style="color: var(--m-text-2);">
							<Check class="size-3.5 shrink-0" style="color: var(--m-green);" aria-hidden="true" />
							{item}
						</li>
					{/each}
				</ul>
				<Button
					href={resolve('/sign-up')}
					class="h-10 w-full rounded-lg border-0 text-sm font-semibold"
					style="background: var(--m-accent); color: var(--m-accent-fg); box-shadow: 0 0 20px var(--m-accent-glow);"
					>Start free trial</Button
				>
			</div>

			<!-- Business -->
			<div
				class="flex flex-col gap-5 rounded-xl border p-6"
				style="border-color: var(--m-border-strong); background: var(--m-surface);"
			>
				<div>
					<p
						class="mb-1 text-[20px] font-bold"
						style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
					>
						Business
					</p>
					<p
						class="text-[28px] font-black"
						style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
					>
						$79 <span class="text-[14px] font-medium" style="color: var(--m-text-3);">/ mo</span>
					</p>
					<p class="mt-1 text-[13px]" style="color: var(--m-text-2);">
						For multi-location operators.
					</p>
				</div>
				<ul class="flex flex-1 flex-col gap-2.5">
					{#each [
						'Everything in Pro',
						'Multiple workspaces',
						'Priority support',
						'Custom email sender domain',
						'SLA guarantee',
						'Dedicated onboarding'
					] as item (item)}
						<li class="flex items-center gap-2 text-[13px]" style="color: var(--m-text-2);">
							<Check class="size-3.5 shrink-0" style="color: var(--m-green);" aria-hidden="true" />
							{item}
						</li>
					{/each}
				</ul>
				<!-- No dedicated sales route yet; non-interactive CTA -->
				<div
					class="flex min-h-10 w-full flex-col items-center justify-center rounded-lg border px-2 py-2 text-center leading-tight"
					style="border-color: var(--m-border-strong); color: var(--m-text-2);"
					aria-label="Contact sales, coming soon"
				>
					<span class="text-sm font-semibold" style="color: var(--m-text);">Contact sales</span>
					<span class="text-[11px] font-medium" style="color: var(--m-text-3);">Coming soon</span>
				</div>
			</div>
		</div>
	</div>
</section>
