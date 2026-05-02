<script lang="ts">
	import { resolve } from '$app/paths';
	import { BarChart3, FileText, Link2, Mail, Plug, Shield, Users, ArrowRight } from '@lucide/svelte';
	import { scrollReveal } from '$lib/actions/scroll-reveal';

	const features = [
		{
			id: 'waiver-builder',
			icon: FileText,
			title: 'Waiver Builder',
			description: 'Versioned waivers with locked records — past signatures are never altered.',
			hero: true
		},
		{
			id: 'email-automation',
			icon: Mail,
			title: 'Email Automation',
			description: 'Individually timed follow-ups for every signer, not just the lead.',
			hero: false
		},
		{
			id: 'booking-sync',
			icon: Link2,
			title: 'Booking Sync',
			description: 'Bookeo, Resova, and Xola sync sessions and participant counts automatically.',
			hero: false
		},
		{
			id: 'completion-analytics',
			icon: BarChart3,
			title: 'Completion Analytics',
			description: 'Signed vs. expected counts and submission trends across every session.',
			hero: false
		},
		{
			id: 'marketing-sync',
			icon: Plug,
			title: 'Mailchimp & Constant Contact',
			description: 'Keep your marketing lists in sync with who actually showed up.',
			hero: false
		},
		{
			id: 'team-access',
			icon: Users,
			title: 'Team Access',
			description: 'Owner and staff roles per workspace, with multi-venue support.',
			hero: false
		},
		{
			id: 'audit-trail',
			icon: Shield,
			title: 'Audit Trail',
			description: 'Every action on every record is logged immutably. PDF export on demand.',
			hero: false
		}
	];
</script>

<section
	id="features"
	class="border-t py-28 md:py-36"
	style="border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<div class="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" use:scrollReveal={{ delay: 0 }}>
			<div>
				<p
					class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
					style="color: var(--primary);"
				>
					Features
				</p>
				<h2
					class="font-extrabold tracking-tight text-balance"
					style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.75rem); letter-spacing: -0.03em; line-height: 1.06;"
				>
					Built for the way you actually run sessions.
				</h2>
			</div>
			<a
				href={resolve('/features')}
				class="feature-teaser-link inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium no-underline"
				style="color: var(--primary);"
			>
				All features
				<ArrowRight size={14} aria-hidden="true" />
			</a>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" use:scrollReveal={{ delay: 80 }}>
			{#each features as feature, i (feature.id)}
				{@const Icon = feature.icon}
				<div
					class={[
						'feature-teaser-card flex flex-col gap-4 rounded-xl border p-5',
						feature.hero && 'sm:col-span-2'
					]}
					style={feature.hero
						? 'background: linear-gradient(145deg, var(--m-accent-soft) 0%, var(--m-card) 65%); border-color: var(--m-accent-border-soft);'
						: 'background: var(--m-card); border-color: var(--m-border-soft);'}
				>
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
						style={feature.hero ? 'background: var(--m-accent-medium);' : 'background: var(--m-accent-dim);'}
						aria-hidden="true"
					>
						<Icon size={15} style="color: var(--primary);" />
					</div>
					<div>
						<p class="mb-1 text-[14px] font-semibold">{feature.title}</p>
						<p class="text-[13px] leading-relaxed" style="color: var(--m-text-3);">{feature.description}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.feature-teaser-card {
		transition:
			transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.18s ease;
	}

	@media (hover: hover) {
		.feature-teaser-card:hover {
			transform: translateY(-2px);
			border-color: oklch(1 0 0 / 14%) !important;
		}
	}

	.feature-teaser-link {
		transition: opacity 0.15s ease;
	}

	@media (hover: hover) {
		.feature-teaser-link:hover {
			opacity: 0.75;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.feature-teaser-card {
			transition: none !important;
		}
		.feature-teaser-card:hover {
			transform: none;
		}
	}
</style>
