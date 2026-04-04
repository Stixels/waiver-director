<script lang="ts">
	import MarketingSectionHeading from './MarketingSectionHeading.svelte';
	import { scrollReveal } from './scrollReveal';

	const waiverFields = ['Full Name', 'Date of Birth', 'Emergency Contact'];
	const providers = [
		{ name: 'Bookeo', connected: true },
		{ name: 'Resova', connected: true },
		{ name: 'Xola', connected: false }
	];
	const shareMethods = ['Email', 'SMS', 'Booking confirmation'];
</script>

<section id="how-it-works" class="landing-reveal py-20 md:py-24" {@attach scrollReveal}>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<MarketingSectionHeading
			eyebrow="How It Works"
			title="Up and running in three steps."
			align="center"
			class="mb-16"
		/>

		<div class="landing-how-it-works mx-auto flex max-w-4xl flex-col gap-16">
			<div class="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
				<div>
					<div class="landing-how-it-works__step-number" aria-hidden="true">01</div>
					<h3 class="landing-how-it-works__step-title">Build your waiver template once.</h3>
					<p class="text-[15px] leading-relaxed" style="color: var(--m-text-2);">
						Create structured waivers with custom fields, signature blocks, and your branding.
						Publish a version and it&apos;s locked, so past submissions are never altered when you
						make edits.
					</p>
				</div>

				<div
					class="rounded-xl border p-4"
					style="background: var(--m-surface); border-color: var(--m-border-strong);"
				>
					<div class="mb-4 flex items-center justify-between">
						<p class="text-[13px] font-semibold" style="color: var(--m-text);">
							Adventure Waiver — v2
						</p>
						<span
							class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
							style="color: var(--m-amber); background: var(--m-amber-dim);"
						>
							Draft
						</span>
					</div>

					{#each waiverFields as field (field)}
						<div
							class="mb-2 rounded-lg border px-3 py-2.5"
							style="background: var(--m-card); border-color: var(--m-border);"
						>
							<p class="mb-1 text-[9px] tracking-widest uppercase" style="color: var(--m-text-3);">
								{field}
							</p>
							<div
								class="h-3 w-3/4 rounded"
								style="background: var(--m-border-strong);"
								aria-hidden="true"
							></div>
						</div>
					{/each}

					<div
						class="mb-4 rounded-lg border-2 border-dashed px-3 py-4 text-center"
						style="border-color: var(--m-border-strong);"
					>
						<p class="mb-1 text-[11px] font-semibold" style="color: var(--m-text-2);">Signature</p>
						<p class="text-[10px]" style="color: var(--m-text-3);">Draw or type below</p>
					</div>

					<div class="flex items-center gap-3">
						<span
							class="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
							style="background: var(--m-accent); color: var(--m-accent-fg);"
							aria-hidden="true"
						>
							Publish v2
						</span>
						<span class="text-[11px]" style="color: var(--m-text-3);">3 changes since v1</span>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
				<div class="md:order-last">
					<div class="landing-how-it-works__step-number" aria-hidden="true">02</div>
					<h3 class="landing-how-it-works__step-title">Connect your booking system.</h3>
					<p class="text-[15px] leading-relaxed" style="color: var(--m-text-2);">
						Link Bookeo, Resova, or Xola. Sessions and expected participant counts sync
						automatically. Waivers are matched to the right group with no manual setup per session.
					</p>
				</div>

				<div
					class="rounded-xl border p-4"
					style="background: var(--m-surface); border-color: var(--m-border-strong);"
				>
					<p
						class="mb-4 text-[10px] font-semibold tracking-widest uppercase"
						style="color: var(--m-text-3);"
					>
						Booking Integrations
					</p>

					<div class="mb-4 grid grid-cols-3 gap-3">
						{#each providers as provider (provider.name)}
							<div
								class="rounded-lg border p-3 text-center"
								style="background: var(--m-card); border-color: var(--m-border);"
							>
								<div
									class="mx-auto mb-2 h-6 w-6 rounded-md"
									style="background: var(--m-accent-dim);"
									aria-hidden="true"
								></div>
								<p class="mb-1 text-[11px] font-semibold" style="color: var(--m-text);">
									{provider.name}
								</p>
								{#if provider.connected}
									<span class="text-[9px] font-semibold" style="color: var(--m-green);"
										>Connected ✓</span
									>
								{:else}
									<span class="text-[9px] font-medium" style="color: var(--m-amber);"
										>Coming soon</span
									>
								{/if}
							</div>
						{/each}
					</div>

					<p class="text-[11px]" style="color: var(--m-text-3);">
						<span aria-hidden="true">↻</span> Last synced 3 minutes ago · 4 upcoming sessions
					</p>
				</div>
			</div>

			<div class="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
				<div>
					<div class="landing-how-it-works__step-number" aria-hidden="true">03</div>
					<h3 class="landing-how-it-works__step-title">Guests sign before they arrive.</h3>
					<p class="text-[15px] leading-relaxed" style="color: var(--m-text-2);">
						Share a link by email, SMS, or booking confirmation. Anyone in the group can sign from
						their phone. You see real-time completion in your session dashboard.
					</p>
				</div>

				<div
					class="rounded-xl border p-4"
					style="background: var(--m-surface); border-color: var(--m-border-strong);"
				>
					<p
						class="mb-4 text-[10px] font-semibold tracking-widest uppercase"
						style="color: var(--m-text-3);"
					>
						Campaign Link
					</p>

					<div
						class="mb-4 flex items-center gap-2 rounded-lg border px-3 py-2.5"
						style="background: var(--m-card); border-color: var(--m-border);"
					>
						<span class="min-w-0 flex-1 truncate text-[12px]" style="color: var(--m-text-2);">
							waivers.yourvenue.com/adventure-tour
						</span>
						<span
							class="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold"
							style="background: var(--m-accent-dim); color: var(--m-accent);"
							aria-hidden="true"
						>
							Copy
						</span>
					</div>

					<div class="mb-4 flex flex-wrap items-center gap-2">
						{#each shareMethods as method (method)}
							<span
								class="rounded-full border px-3 py-1 text-[11px] font-medium"
								style="color: var(--m-text-2); border-color: var(--m-border-strong); background: var(--m-card);"
							>
								{method}
							</span>
						{/each}
					</div>

					<p class="text-[11px]" style="color: var(--m-text-3);">
						Or share a shortlink · embed in your booking confirmation emails.
					</p>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.landing-how-it-works > div {
		position: relative;
	}

	.landing-how-it-works > div:not(:last-child)::after {
		content: '';
		position: absolute;
		bottom: -4rem;
		left: 2.5rem;
		width: 1px;
		height: 4rem;
		background: linear-gradient(to bottom, oklch(0.52 0.22 277 / 28%), oklch(0.52 0.22 277 / 6%));
	}

	.landing-how-it-works__step-number {
		margin-bottom: 0.75rem;
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: clamp(2.25rem, 11vw, 3.25rem);
		font-weight: 900;
		line-height: 1;
		color: oklch(0.52 0.22 277 / 30%);
	}

	.landing-how-it-works__step-title {
		margin-bottom: 0.75rem;
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: 26px;
		font-weight: 700;
		color: var(--m-text);
	}

	@media (min-width: 768px) {
		.landing-how-it-works__step-number {
			font-size: 4.5rem;
		}
	}
</style>
