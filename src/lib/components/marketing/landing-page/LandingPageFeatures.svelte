<script lang="ts">
	import { ChartColumn, FileText, Link2, Mail, Plug, Shield, Users } from '@lucide/svelte';

	import MarketingSectionHeading from './MarketingSectionHeading.svelte';
	import { chartBars } from './content';

	type Feature = {
		id: string;
		icon: typeof FileText;
		title: string;
		description: string;
		mdClass: string;
		lgClass: string;
		hero: boolean;
		footer?: 'version' | 'chart';
	};

	const features: Feature[] = [
		{
			id: 'waiver-builder',
			icon: FileText,
			title: 'Waiver Builder',
			description:
				'Build a structured public waiver with rich text, custom fields, required questions, and signature blocks. Versioned so signed waiver records are never altered.',
			mdClass: 'md:col-span-2',
			lgClass: 'lg:col-span-4',
			hero: true,
			footer: 'version'
		},
		{
			id: 'email-automation',
			icon: Mail,
			title: 'Email Automation',
			description:
				'Send follow-ups on demand or trigger them after a booking delay for every participant, not just the lead. Cancel any message before it goes out.',
			mdClass: 'md:col-span-1',
			lgClass: 'lg:col-span-2',
			hero: false
		},
		{
			id: 'booking-sync',
			icon: Link2,
			title: 'Booking Sync',
			description:
				'Connect Bookeo now. Resova, Xola, and other booking integrations are coming soon.',
			mdClass: 'md:col-span-1',
			lgClass: 'lg:col-span-2',
			hero: false
		},
		{
			id: 'marketing-sync',
			icon: Plug,
			title: 'Mailchimp & Constant Contact',
			description: 'Marketing-list integrations are coming soon for the lists you already use.',
			mdClass: 'md:col-span-1',
			lgClass: 'lg:col-span-2',
			hero: false
		},
		{
			id: 'team-access',
			icon: Users,
			title: 'Team Access',
			description:
				'Owner and staff roles per workspace. One account can manage multiple venues or business locations.',
			mdClass: 'md:col-span-1',
			lgClass: 'lg:col-span-2',
			hero: false
		},
		{
			id: 'completion-analytics',
			icon: ChartColumn,
			title: 'Completion Analytics',
			description:
				'See signed vs. expected counts per session, completion rates by campaign and provider, and submission trends over time.',
			mdClass: 'md:col-span-2',
			lgClass: 'lg:col-span-4',
			hero: true,
			footer: 'chart'
		},
		{
			id: 'audit-trail',
			icon: Shield,
			title: 'Audit Trail',
			description:
				'Every open, draft, submit, void, and export is recorded immutably. On-demand PDF exports reference the exact signed version.',
			mdClass: 'md:col-span-1',
			lgClass: 'lg:col-span-2',
			hero: false
		}
	];
</script>

<section
	id="features"
	class="border-t py-20 md:py-24"
	style="border-color: var(--border); background: var(--m-surface);"
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<MarketingSectionHeading
			eyebrow="Everything You Need"
			title="Built for the way you actually run sessions."
			align="center"
			class="mb-12"
		/>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
			{#each features as feature (feature.id)}
				{@const Icon = feature.icon}
				<div
					class={[
						'landing-feature-card relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-6',
						feature.mdClass,
						feature.lgClass
					]}
					style={feature.hero
						? 'background: linear-gradient(135deg, var(--m-accent-soft) 0%, var(--m-surface) 65%); border-color: var(--m-accent-border-soft);'
						: 'background: var(--m-surface); border-color: var(--border);'}
				>
					{#if feature.hero}
						<div
							class="pointer-events-none absolute inset-x-0 top-0 h-px"
							style="background: linear-gradient(90deg, transparent, var(--m-accent-line), transparent);"
							aria-hidden="true"
						></div>
						<div
							class="pointer-events-none absolute top-0 right-0 h-48 w-48 rounded-full blur-[80px]"
							style="background: var(--m-accent-dim);"
							aria-hidden="true"
						></div>
					{/if}

					<div
						class={[
							'relative flex shrink-0 items-center justify-center rounded-xl',
							feature.hero ? 'h-12 w-12' : 'h-9 w-9'
						]}
						style={feature.hero
							? 'background: var(--m-accent-medium); box-shadow: 0 0 16px oklch(0.52 0.22 277 / 18%);'
							: 'background: var(--m-accent-dim);'}
						aria-hidden="true"
					>
						<Icon size={feature.hero ? 22 : 18} style="color: var(--primary);" />
					</div>

					<div class="relative flex flex-1 flex-col gap-2">
						<h3 class={[feature.hero ? 'text-[18px]' : 'text-[15px]', 'font-semibold']}>
							{feature.title}
						</h3>
						<p
							class={[
								'text-muted-foreground',
								feature.hero ? 'text-[14px]' : 'text-[13px]',
								'leading-relaxed'
							]}
						>
							{feature.description}
						</p>
					</div>

					{#if feature.footer === 'version'}
						<div class="mt-auto flex items-center gap-2 opacity-60">
							<span
								class="rounded-md border border-(--m-border-strong) px-2 py-0.5 font-mono text-[9px] text-(--m-text-3)"
								aria-hidden="true"
							>
								v1 locked
							</span>
							<span class="text-[9px] text-(--m-text-3)" aria-hidden="true">→</span>
							<span
								class="rounded-md border px-2 py-0.5 font-mono text-[9px] text-primary"
								style="border-color: var(--m-accent-border);"
								aria-hidden="true"
							>
								v2 current
							</span>
							<span class="text-[9px] text-(--m-text-3)" aria-hidden="true">· 3 changes</span>
						</div>
					{:else if feature.footer === 'chart'}
						<div
							class="mt-auto flex h-9 items-end gap-1 overflow-hidden rounded-lg bg-(--m-elevated) px-2 py-1.5 opacity-80"
							aria-hidden="true"
						>
							{#each chartBars as bar (bar.day)}
								<div
									class="flex-1 rounded-t-sm"
									style={`height: ${bar.pct}%; background: var(--primary); min-height: 2px;`}
								></div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.landing-feature-card {
		transition:
			transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.22s ease;
	}

	.landing-feature-card:hover {
		transform: translateY(-4px);
		box-shadow:
			0 0 0 1px oklch(1 0 0 / 10%),
			0 16px 48px oklch(0 0 0 / 50%),
			0 0 60px var(--m-accent-dim);
	}

	@media (prefers-reduced-motion: reduce) {
		.landing-feature-card {
			transition: none !important;
		}

		.landing-feature-card:hover {
			transform: none;
			box-shadow: none;
		}
	}
</style>
