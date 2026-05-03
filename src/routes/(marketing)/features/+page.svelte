<script lang="ts">
	import { PUBLIC_APP_URL } from '$env/static/public';
	import { resolve } from '$app/paths';
	import {
		ChartColumn,
		Clock,
		FileText,
		Link2,
		Mail,
		Plug,
		Shield,
		Users,
		ArrowRight
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { scrollReveal } from '$lib/actions/scroll-reveal';
	import { chartBars } from '$lib/components/marketing/landing-page/content';

	const siteBase = (PUBLIC_APP_URL ?? '').replace(/\/$/, '');
	const canonicalUrl = siteBase ? `${siteBase}/features` : '';

	type Feature = {
		id: string;
		icon: typeof FileText;
		title: string;
		description: string;
		detail: string;
		hero: boolean;
	};

	const features: Feature[] = [
		{
			id: 'waiver-builder',
			icon: FileText,
			title: 'Waiver Builder',
			description:
				'Build a structured public waiver with rich text, custom fields, required questions, and signature blocks.',
			detail:
				'Use custom fields for the details your operation actually needs, then version each publish: once a version is locked, every signature references that exact document. When you update your waiver, past records stay intact.',
			hero: true
		},
		{
			id: 'email-automation',
			icon: Mail,
			title: 'Email Automation',
			description:
				'Send emails on demand or trigger them after a booking delay for every participant.',
			detail:
				'Configure booking delays and templates once, or send a message manually when the moment calls for it. Verify your reply-to email to finish setup and send thank-yous, feedback, and review asks.',
			hero: false
		},
		{
			id: 'booking-sync',
			icon: Link2,
			title: 'Booking Sync',
			description:
				'Connect Bookeo now. Resova, Xola, and other booking integrations are coming soon.',
			detail:
				'Link one booking provider per workspace so upcoming sessions appear in your dashboard with expected guest counts. Waivers are automatically matched to the correct session — no per-session setup required.',
			hero: false
		},
		{
			id: 'marketing-sync',
			icon: Plug,
			title: 'Mailchimp & Constant Contact',
			description: 'Marketing-list integrations are coming soon for the tools you already use.',
			detail:
				'Mailchimp and Constant Contact are planned so your broadcasts can reflect who actually showed up — not just who booked.',
			hero: false
		},
		{
			id: 'team-access',
			icon: Users,
			title: 'Team Access',
			description: 'Owner and staff roles per workspace. Manage multiple venues from one account.',
			detail:
				'Invite team members with the right permission level. Staff can view sessions and submissions. Owners control waiver settings, integrations, and billing. A single account can manage multiple business locations.',
			hero: false
		},
		{
			id: 'completion-analytics',
			icon: ChartColumn,
			title: 'Completion Analytics',
			description:
				'See signed vs. expected counts per session, completion rates, and submission trends.',
			detail:
				'Know your real completion rate at a glance. Track how many guests signed before arrival vs. at the door. Trend charts show you how follow-up performance changes over time across all your sessions.',
			hero: true
		},
		{
			id: 'audit-trail',
			icon: Shield,
			title: 'Audit Trail',
			description: 'Every open, draft, submit, void, and export is recorded immutably.',
			detail:
				'Every action taken on a signed record is logged with a timestamp and user reference. On-demand PDF exports always reference the exact version of the waiver that was signed — not the current draft.',
			hero: false
		}
	];

	const waiverBuilderFeature = features.find((f) => f.id === 'waiver-builder')!;
	const analyticsFeature = features.find((f) => f.id === 'completion-analytics')!;
	const supportingFeatures = features.filter((f) => !f.hero);

	const integrations = [
		{ name: 'Bookeo', status: 'live', description: 'Session sync + participant counts' },
		{ name: 'Resova', status: 'soon', description: 'Coming soon' },
		{ name: 'Xola', status: 'soon', description: 'Coming soon' },
		{ name: 'Mailchimp', status: 'soon', description: 'Coming soon' },
		{ name: 'Constant Contact', status: 'soon', description: 'Coming soon' }
	];
</script>

<svelte:head>
	<title>Features — Waiver Director</title>
	<meta
		name="description"
		content="Waiver builder, email automation, booking sync, analytics, team access, and audit trail — everything you need to run compliant, automated waivers for tours and activities."
	/>
	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
	{/if}
</svelte:head>

<!-- Page hero -->
<section
	class="border-b px-4 pt-36 pb-28 sm:px-6 md:pt-48 md:pb-36"
	style="border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-6xl" use:scrollReveal={{ delay: 0 }}>
		<p
			class="mb-4 text-[11px] font-semibold tracking-widest uppercase"
			style="color: var(--primary);"
		>
			Features
		</p>
		<h1
			class="mb-5 max-w-3xl font-extrabold tracking-tight text-balance"
			style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2.2rem, 5.5vw, 4rem); letter-spacing: -0.03em; line-height: 1.06;"
		>
			Everything you need to run compliant, automated waivers.
		</h1>
		<p class="max-w-2xl text-[17px] leading-relaxed" style="color: var(--m-text-2);">
			From building your first waiver to syncing Bookeo sessions and sending follow-up emails —
			Waiver Director handles the waiver flow.
		</p>
	</div>
</section>

<!-- Hero Feature: Waiver Builder -->
<section class="border-b px-4 py-28 sm:px-6 md:py-36" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-6xl">
		<div class="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
			<!-- Prose -->
			<div use:scrollReveal={{ delay: 0 }}>
				<p
					class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
					style="color: var(--primary);"
				>
					{waiverBuilderFeature.title}
				</p>
				<h2
					class="mb-4 font-extrabold tracking-tight text-balance"
					style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.5rem); letter-spacing: -0.025em; line-height: 1.1;"
				>
					Build once. Version forever.
				</h2>
				<p class="mb-3 text-[16px] leading-relaxed" style="color: var(--m-text-2);">
					{waiverBuilderFeature.description}
				</p>
				<p class="text-[14px] leading-relaxed" style="color: var(--m-text-3);">
					{waiverBuilderFeature.detail}
				</p>
				<div class="mt-6 flex flex-wrap items-center gap-2">
					<span
						class="rounded-md border px-2 py-0.5 font-mono text-[11px]"
						style="border-color: var(--m-border-strong); color: var(--m-text-3);">v1 locked</span
					>
					<span class="text-[11px]" style="color: var(--m-text-3);">→</span>
					<span
						class="rounded-md border px-2 py-0.5 font-mono text-[11px]"
						style="border-color: var(--m-accent-border); color: var(--primary);">v2 current</span
					>
					<span class="text-[11px]" style="color: var(--m-text-3);">· 3 changes</span>
				</div>
			</div>

			<!-- Mockup card -->
			<div
				class="features-hero-mockup overflow-hidden rounded-2xl border"
				style="background: var(--m-card); border-color: var(--m-border-strong); box-shadow: 0 24px 64px oklch(0 0 0 / 45%), inset 0 1px 0 oklch(1 0 0 / 5%);"
				use:scrollReveal={{ delay: 100 }}
				aria-hidden="true"
			>
				<!-- Title bar -->
				<div
					class="flex items-center gap-2 border-b px-4 py-3"
					style="background: var(--m-elevated); border-color: var(--m-border-soft);"
				>
					<span class="h-2.5 w-2.5 rounded-full" style="background: #ff5f57;"></span>
					<span class="h-2.5 w-2.5 rounded-full" style="background: #febc2e;"></span>
					<span class="h-2.5 w-2.5 rounded-full" style="background: #28c840;"></span>
					<span class="ml-3 text-[13px] font-semibold">Adventure Waiver — v2</span>
					<span
						class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
						style="background: var(--m-amber-dim); color: var(--m-amber);">Draft</span
					>
				</div>

				<!-- Body -->
				<div class="p-5">
					<p
						class="mb-3 text-[10px] font-semibold tracking-widest uppercase"
						style="color: var(--m-text-3);"
					>
						Waiver Fields
					</p>

					{#each ['Full Name', 'Date of Birth', 'Phone Number', 'Emergency Contact'] as field (field)}
						<div
							class="mb-2 rounded-lg border px-3 py-2.5"
							style="border-color: var(--m-border-soft); background: var(--m-elevated);"
						>
							<p
								class="mb-1.5 text-[9px] tracking-widest uppercase"
								style="color: var(--m-text-3);"
							>
								{field}
							</p>
							<div class="h-2.5 w-3/4 rounded" style="background: var(--m-border-strong);"></div>
						</div>
					{/each}

					<!-- Rich text field -->
					<div
						class="mb-2 rounded-lg border px-3 py-2.5"
						style="border-color: var(--m-border-soft); background: var(--m-elevated);"
					>
						<p class="mb-1.5 text-[9px] tracking-widest uppercase" style="color: var(--m-text-3);">
							Liability Terms
						</p>
						<div class="flex flex-col gap-1.5">
							<div class="h-2 w-full rounded" style="background: var(--m-border-strong);"></div>
							<div class="h-2 w-5/6 rounded" style="background: var(--m-border-strong);"></div>
							<div class="h-2 w-2/3 rounded" style="background: var(--m-border-strong);"></div>
						</div>
					</div>

					<!-- Signature block -->
					<div
						class="mb-4 rounded-lg border-2 border-dashed px-3 py-4 text-center"
						style="border-color: var(--m-border-strong);"
					>
						<p class="mb-1 text-[11px] font-semibold" style="color: var(--m-text-2);">Signature</p>
						<p class="text-[10px]" style="color: var(--m-text-3);">Draw or type below</p>
					</div>

					<!-- Action row -->
					<div class="flex items-center gap-2">
						<span
							class="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
							style="background: var(--primary); color: var(--primary-foreground);">Publish v2</span
						>
						<span
							class="rounded-lg border px-3 py-1.5 text-[12px] font-medium"
							style="background: var(--m-elevated); border-color: var(--m-border-strong); color: var(--m-text-2);"
							>Save draft</span
						>
						<span class="ml-auto text-[11px]" style="color: var(--m-text-3);"
							>3 changes since v1</span
						>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Hero Feature: Completion Analytics -->
<section class="border-b px-4 py-28 sm:px-6 md:py-36" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-6xl">
		<div class="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
			<!-- Mockup card (left on lg) -->
			<div
				class="features-hero-mockup overflow-hidden rounded-2xl border lg:order-first"
				style="background: var(--m-card); border-color: var(--m-border-strong); box-shadow: 0 24px 64px oklch(0 0 0 / 45%), inset 0 1px 0 oklch(1 0 0 / 5%);"
				use:scrollReveal={{ delay: 100 }}
				aria-hidden="true"
			>
				<!-- Title bar -->
				<div
					class="flex items-center gap-2 border-b px-4 py-3"
					style="background: var(--m-elevated); border-color: var(--m-border-soft);"
				>
					<span class="h-2.5 w-2.5 rounded-full" style="background: #ff5f57;"></span>
					<span class="h-2.5 w-2.5 rounded-full" style="background: #febc2e;"></span>
					<span class="h-2.5 w-2.5 rounded-full" style="background: #28c840;"></span>
					<span class="ml-3 text-[13px] font-semibold">Completion Overview</span>
					<span
						class="ml-auto rounded-lg border px-2.5 py-1 text-[11px]"
						style="background: var(--m-elevated); border-color: var(--m-border-strong); color: var(--m-text-2);"
						>Last 7 days</span
					>
				</div>

				<!-- Body -->
				<div class="p-5">
					<!-- Stat tiles -->
					<div class="mb-4 grid grid-cols-2 gap-3">
						<div
							class="rounded-xl border p-4"
							style="background: var(--m-elevated); border-color: var(--m-border-soft);"
						>
							<p class="mb-2 text-[11px] leading-snug font-medium" style="color: var(--m-text-2);">
								Avg. Completion Rate
							</p>
							<p
								class="text-[30px] leading-none font-bold tracking-tight"
								style="color: var(--m-green);"
							>
								84%
							</p>
							<p class="mt-1.5 text-[11px]" style="color: var(--m-text-3);">sessions this week</p>
						</div>
						<div
							class="rounded-xl border p-4"
							style="background: var(--m-elevated); border-color: var(--m-border-soft);"
						>
							<p class="mb-2 text-[11px] leading-snug font-medium" style="color: var(--m-text-2);">
								Signed Before Arrival
							</p>
							<p class="text-[30px] leading-none font-bold tracking-tight">71%</p>
							<p class="mt-1.5 text-[11px]" style="color: var(--m-text-3);">arrived pre-signed</p>
						</div>
					</div>

					<!-- Bar chart -->
					<div
						class="mb-4 rounded-xl border p-4"
						style="background: var(--m-elevated); border-color: var(--m-border-soft);"
					>
						<div class="mb-3 flex items-center justify-between">
							<span class="text-[11px] font-semibold">Daily Completions</span>
							<span class="text-[11px]" style="color: var(--m-text-3);">Mon–Sun</span>
						</div>
						<div
							class="flex items-end gap-1.5"
							style="height: 64px;"
							role="img"
							aria-label="Bar chart showing daily completion rates ranging from 57% to 100%"
						>
							{#each chartBars as bar (bar.day)}
								<div
									class="flex-1 rounded-t-[3px]"
									style="height: {bar.pct}%; background: var(--primary); min-height: 2px;"
								></div>
							{/each}
						</div>
						<div class="mt-2 flex justify-between">
							{#each chartBars as bar (bar.day)}
								<span class="text-[9px]" style="color: var(--m-text-3);">{bar.day}</span>
							{/each}
						</div>
					</div>

					<!-- Session table -->
					<div
						class="overflow-hidden rounded-xl border"
						style="background: var(--m-elevated); border-color: var(--m-border-soft);"
					>
						<div class="px-4 py-2.5" style="background: var(--m-card);">
							<p
								class="text-[10px] font-semibold tracking-wide uppercase"
								style="color: var(--m-text-2);"
							>
								Recent Sessions
							</p>
						</div>
						{#each [{ name: 'Zipline Tour', count: '8/8', label: 'Complete', bg: 'var(--m-green-dim)', color: 'var(--m-green)' }, { name: 'Axe Throwing', count: '4/6', label: 'In Progress', bg: 'var(--m-amber-dim)', color: 'var(--m-amber)' }, { name: 'Kayak Adventure', count: '0/10', label: 'Upcoming', bg: 'var(--m-elevated)', color: 'var(--m-text-3)' }] as row (row.name)}
							<div
								class="flex items-center justify-between border-t px-4 py-2.5"
								style="border-color: var(--m-border-soft);"
							>
								<span class="text-[12px] font-medium">{row.name}</span>
								<span class="text-[12px] font-medium" style="color: var(--m-text-2);"
									>{row.count}</span
								>
								<span
									class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
									style="background: {row.bg}; color: {row.color};">{row.label}</span
								>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Prose (right on lg) -->
			<div use:scrollReveal={{ delay: 0 }}>
				<p
					class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
					style="color: var(--primary);"
				>
					{analyticsFeature.title}
				</p>
				<h2
					class="mb-4 font-extrabold tracking-tight text-balance"
					style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.5rem); letter-spacing: -0.025em; line-height: 1.1;"
				>
					Know your numbers before they arrive.
				</h2>
				<p class="mb-3 text-[16px] leading-relaxed" style="color: var(--m-text-2);">
					{analyticsFeature.description}
				</p>
				<p class="text-[14px] leading-relaxed" style="color: var(--m-text-3);">
					{analyticsFeature.detail}
				</p>
				<div class="mt-6 flex flex-wrap gap-2">
					<span
						class="rounded-full px-2.5 py-1 text-[11px] font-semibold"
						style="background: var(--m-green-dim); color: var(--m-green);">84% avg. completion</span
					>
					<span
						class="rounded-full px-2.5 py-1 text-[11px] font-semibold"
						style="background: var(--m-accent-dim); color: var(--primary);">↑ 12% this week</span
					>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Supporting Features Grid -->
<section class="border-b px-4 py-28 sm:px-6 md:py-36" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-6xl">
		<div class="mb-12" use:scrollReveal={{ delay: 0 }}>
			<p
				class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
				style="color: var(--primary);"
			>
				More Features
			</p>
			<h2
				class="font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.5rem); letter-spacing: -0.025em; line-height: 1.1;"
			>
				Everything else you need.
			</h2>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each supportingFeatures as feature, i (feature.id)}
				{@const Icon = feature.icon}
				<div
					class="features-card flex flex-col gap-5 overflow-hidden rounded-2xl border p-7"
					style="background: var(--m-card); border-color: var(--m-border-soft);"
					use:scrollReveal={{ delay: (i % 3) * 60 }}
				>
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
						style="background: var(--m-accent-dim);"
						aria-hidden="true"
					>
						<Icon size={16} style="color: var(--primary);" />
					</div>

					<div class="flex flex-1 flex-col gap-1.5">
						<h3 class="text-[15px] leading-snug font-semibold">{feature.title}</h3>
						<p class="text-[14px] leading-relaxed" style="color: var(--m-text-2);">
							{feature.description}
						</p>
						<p class="mt-0.5 text-[13px] leading-relaxed" style="color: var(--m-text-3);">
							{feature.detail}
						</p>
					</div>

					<!-- Visual accent -->
					{#if feature.id === 'email-automation'}
						<div
							class="mt-auto flex items-center gap-2 rounded-lg border px-3 py-2"
							style="background: var(--m-elevated); border-color: var(--m-border-strong);"
							aria-hidden="true"
						>
							<Clock size={12} style="color: var(--m-amber); flex-shrink: 0;" />
							<span class="min-w-0 flex-1 truncate text-[11px]" style="color: var(--m-text-2);">
								2 days after signing → Send review request
							</span>
							<span class="ml-auto shrink-0 text-[11px]" style="color: var(--m-text-3);">×</span>
						</div>
					{:else if feature.id === 'booking-sync'}
						<div class="mt-auto flex flex-wrap gap-2" aria-hidden="true">
							{#each [{ name: 'Bookeo ✓', live: true }, { name: 'Resova (soon)', live: false }, { name: 'Xola (soon)', live: false }] as chip (chip.name)}
								<span
									class="rounded-full border px-2.5 py-1 text-[11px] font-medium"
									style="background: var(--m-elevated); border-color: var(--m-border-strong); color: {chip.live
										? 'var(--m-green)'
										: 'var(--m-text-3)'};"
								>
									{#if chip.live}<span
											class="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
											style="background: var(--m-green);"
										></span>{/if}{chip.name}
								</span>
							{/each}
						</div>
					{:else if feature.id === 'marketing-sync'}
						<div class="mt-auto flex flex-col gap-1.5" aria-hidden="true">
							{#each ['Mailchimp', 'Constant Contact'] as platform (platform)}
								<div
									class="flex items-center justify-between rounded-lg border px-3 py-1.5"
									style="background: var(--m-elevated); border-color: var(--m-border-soft);"
								>
									<span class="text-[12px] font-medium">{platform}</span>
									<span class="text-[10px] font-semibold" style="color: var(--m-amber);"
										>Coming soon</span
									>
								</div>
							{/each}
						</div>
					{:else if feature.id === 'team-access'}
						<div class="mt-auto" aria-hidden="true">
							<div class="flex gap-2">
								<span
									class="rounded-lg border px-3 py-1.5 text-[11px] font-semibold"
									style="background: var(--m-accent-dim); border-color: var(--m-accent-border); color: var(--primary);"
									>Owner</span
								>
								<span
									class="rounded-lg border px-3 py-1.5 text-[11px] font-medium"
									style="background: var(--m-elevated); border-color: var(--m-border-strong); color: var(--m-text-2);"
									>Staff</span
								>
							</div>
							<p class="mt-2 text-[11px]" style="color: var(--m-text-3);">
								Multiple venues, one account.
							</p>
						</div>
					{:else if feature.id === 'audit-trail'}
						<div
							class="mt-auto flex items-center gap-2 rounded-lg border px-3 py-2"
							style="background: var(--m-elevated); border-color: var(--m-border-soft);"
							aria-hidden="true"
						>
							<Shield size={11} style="color: var(--m-text-3); flex-shrink: 0;" />
							<span class="text-[11px]" style="color: var(--m-text-2);">PDF export</span>
							<span class="text-[11px]" style="color: var(--m-text-3);"
								>by matt@venue.com · just now</span
							>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Integrations section -->
<section class="border-b px-4 py-28 sm:px-6 md:py-36" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-6xl">
		<div use:scrollReveal={{ delay: 0 }}>
			<p
				class="mb-4 text-[11px] font-semibold tracking-widest uppercase"
				style="color: var(--primary);"
			>
				Integrations
			</p>
			<h2
				class="mb-4 font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.5rem); letter-spacing: -0.025em; line-height: 1.1;"
			>
				Connects to your existing stack.
			</h2>
			<p class="mb-12 max-w-xl text-[16px] leading-relaxed" style="color: var(--m-text-2);">
				Bookeo is available now. Other booking providers and marketing-list integrations are coming
				soon.
			</p>
		</div>

		<div
			class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
			use:scrollReveal={{ delay: 80 }}
		>
			{#each integrations as intg (intg.name)}
				<div
					class="flex flex-col gap-3 rounded-xl border p-5"
					style="background: var(--m-card); border-color: var(--m-border-soft);"
				>
					<div
						class="flex h-9 w-9 items-center justify-center rounded-lg"
						style="background: var(--m-accent-dim);"
						aria-hidden="true"
					>
						<Link2 size={16} style="color: var(--primary);" />
					</div>
					<div>
						<p class="mb-0.5 text-[14px] font-semibold">{intg.name}</p>
						<p class="text-[12px]" style="color: var(--m-text-3);">{intg.description}</p>
					</div>
					{#if intg.status === 'live'}
						<span
							class="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
							style="background: var(--m-green-dim); color: var(--m-green);"
						>
							<span
								class="size-1.5 rounded-full"
								style="background: var(--m-green);"
								aria-hidden="true"
							></span>
							Connected
						</span>
					{:else}
						<span
							class="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
							style="background: var(--m-elevated); color: var(--m-text-3);"
						>
							Coming soon
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- CTA -->
<section class="px-4 py-20 sm:px-6 md:py-28">
	<div class="mx-auto max-w-3xl text-center" use:scrollReveal={{ delay: 0 }}>
		<h2
			class="mb-5 font-extrabold tracking-tight"
			style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.9rem, 4vw, 3rem); letter-spacing: -0.03em; line-height: 1.1;"
		>
			Ready to capture every guest?
		</h2>
		<p class="mb-8 text-[16px] leading-relaxed" style="color: var(--m-text-2);">
			Start free. No credit card required. See how much of your guest list you're currently missing.
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
				href={resolve('/pricing')}
				variant="outline"
				class="btn-mkt-outline h-11 rounded-xl px-8 text-sm font-medium"
			>
				View pricing
			</Button>
		</div>
	</div>
</section>

<style>
	.features-card {
		transition:
			transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.2s ease;
	}

	@media (hover: hover) {
		.features-card:hover {
			transform: translateY(-3px);
			box-shadow:
				0 0 0 1px oklch(1 0 0 / 8%),
				0 16px 40px oklch(0 0 0 / 40%);
			border-color: oklch(1 0 0 / 14%) !important;
		}
	}

	.features-hero-mockup {
		transition:
			transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (hover: hover) {
		.features-hero-mockup:hover {
			transform: translateY(-4px);
			box-shadow:
				0 32px 80px oklch(0 0 0 / 55%),
				inset 0 1px 0 oklch(1 0 0 / 7%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.features-card,
		.features-hero-mockup {
			transition: none !important;
		}
		.features-card:hover,
		.features-hero-mockup:hover {
			transform: none;
			box-shadow: none;
		}
	}
</style>
