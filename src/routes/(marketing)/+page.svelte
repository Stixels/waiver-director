<script lang="ts">
	import { resolve } from '$app/paths';
	import { PUBLIC_APP_URL } from '$env/static/public';
	import MarketingPricing from '$lib/components/marketing/MarketingPricing.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowRight,
		Check,
		Mail,
		BarChart3,
		Shield,
		Users,
		FileText,
		Link2,
		Plug,
		Zap
	} from '@lucide/svelte';

	const pageTitle = 'Waiver Director — Digital Waivers for Any Booking Experience';
	const pageDescription =
		"Digital waivers for tours & activities: capture every guest's email, sync Bookeo/Resova/Xola, and automate follow-ups for customer feedback, review requests & reminders. Optional Mailchimp & Constant Contact.";

	const siteBase = (PUBLIC_APP_URL ?? '').replace(/\/$/, '');
	const canonicalUrl = siteBase ? `${siteBase}/` : '';

	const features = [
		{
			icon: FileText,
			title: 'Waiver Builder',
			desc: 'Structured templates with rich text, custom fields, and signature blocks. Versioned so past waivers are never altered.'
		},
		{
			icon: Mail,
			title: 'Email Automation',
			desc: 'Rule-based sends around booking time — every participant, not just the lead. Cancel any message before it goes out, and use follow-ups for thank-yous, customer feedback, and review requests after the visit.'
		},
		{
			icon: Link2,
			title: 'Booking Sync',
			desc: 'Connects to Bookeo, Resova, and Xola. Upcoming sessions sync automatically with expected participant counts.'
		},
		{
			icon: Plug,
			title: 'Mailchimp & Constant Contact',
			desc: 'Sync waiver signers into the marketing lists you already use — so broadcasts and automations match who actually showed up.'
		},
		{
			icon: Users,
			title: 'Team Access',
			desc: 'Owner and staff roles per workspace. One account can manage multiple venues or business locations.'
		},
		{
			icon: BarChart3,
			title: 'Completion Analytics',
			desc: 'See signed vs. expected counts per session, completion rates by campaign and provider, and submission trends over time.'
		},
		{
			icon: Shield,
			title: 'Audit Trail',
			desc: 'Every open, draft, submit, void, and export is recorded immutably. On-demand PDF exports reference the exact signed version.'
		}
	];

	const sessionParticipants = [
		{ name: 'Alex Martinez', email: 'alex@email.com', status: 'signed' },
		{ name: 'Jamie Chen', email: 'jchen@email.com', status: 'signed' },
		{ name: 'Sam Wilson', email: 'swilson@email.com', status: 'signed' },
		{ name: 'Taylor Brown', email: 'taylor@email.com', status: 'signed' },
		{ name: 'Morgan Davis', email: 'mdavis@email.com', status: 'signed' },
		{ name: 'Riley Kim', email: 'rileyk@email.com', status: 'signed' },
		{ name: 'Casey Patel', email: '—', status: 'pending' },
		{ name: 'Jordan Lee', email: '—', status: 'pending' }
	];

	const chartBars = [
		{ day: 'Mon', val: 62, pct: 64 },
		{ day: 'Tue', val: 78, pct: 81 },
		{ day: 'Wed', val: 55, pct: 57 },
		{ day: 'Thu', val: 91, pct: 94 },
		{ day: 'Fri', val: 83, pct: 86 },
		{ day: 'Sat', val: 74, pct: 77 },
		{ day: 'Sun', val: 96, pct: 100 }
	];

	const differentiatorRight = [
		{ name: 'Alex Martinez', email: 'alex@email.com' },
		{ name: 'Jamie Chen', email: 'jchen@email.com' },
		{ name: 'Sam Wilson', email: 'swilson@email.com' },
		{ name: 'Taylor Brown', email: 'taylor@email.com' },
		{ name: 'Morgan Davis', email: 'mdavis@email.com' },
		{ name: 'Riley Kim', email: 'rileyk@email.com' }
	];

	const analyticsStats = [
		{ label: 'Total Submissions', value: '1,247', sub: '↑ 12% this week', green: true },
		{ label: 'Avg Completion Rate', value: '91%', sub: 'across all sessions', green: false },
		{ label: 'Emails Sent', value: '3,891', sub: '48 pending', green: false },
		{ label: 'Sessions Synced', value: '148', sub: 'from 3 providers', green: false }
	];

	const sessionRows = [
		{
			session: 'Wilderness Zipline Tour',
			date: 'Apr 2, 2:00 PM',
			provider: 'Bookeo',
			expected: 8,
			signed: 8,
			rate: '100%',
			status: 'Complete',
			color: 'var(--m-green)',
			bg: 'var(--m-green-dim)'
		},
		{
			session: 'Urban Axe Throwing',
			date: 'Apr 2, 7:30 PM',
			provider: 'Resova',
			expected: 6,
			signed: 4,
			rate: '67%',
			status: 'In Progress',
			color: 'var(--m-amber)',
			bg: 'var(--m-amber-dim)'
		},
		{
			session: 'Harbor Kayak Adventure',
			date: 'Apr 3, 9:00 AM',
			provider: 'Xola',
			expected: 10,
			signed: 0,
			rate: '0%',
			status: 'Upcoming',
			color: 'var(--m-text-3)',
			bg: 'var(--m-elevated)'
		}
	];

	const featureConfig = [
		{ lg: 'lg:col-span-4', md: 'md:col-span-2', hero: true },
		{ lg: 'lg:col-span-2', md: 'md:col-span-1', hero: false },
		{ lg: 'lg:col-span-2', md: 'md:col-span-1', hero: false },
		{ lg: 'lg:col-span-2', md: 'md:col-span-1', hero: false },
		{ lg: 'lg:col-span-2', md: 'md:col-span-1', hero: false },
		{ lg: 'lg:col-span-4', md: 'md:col-span-2', hero: true },
		{ lg: 'lg:col-span-2', md: 'md:col-span-1', hero: false }
	];

	function scrollReveal(node: Element): { destroy(): void } {
		if (typeof IntersectionObserver === 'undefined') return { destroy() {} };
		// rootMargin: trigger when element is 80px into the viewport from the bottom.
		// This is better than a percentage threshold for tall sections on mobile,
		// where a percentage threshold requires scrolling deep into the section.
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					node.classList.add('is-revealed');
					observer.disconnect();
				}
			},
			{ rootMargin: '0px 0px -80px 0px', threshold: 0 }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:type" content="website" />
	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
		<meta property="og:url" content={canonicalUrl} />
	{/if}
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<!-- ======================================================= HERO -->
	<section
		class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pb-24 pt-14 sm:px-6 sm:pt-16"
	>
		<!-- Dot grid background -->
		<div class="dot-grid absolute inset-0 opacity-40" aria-hidden="true"></div>

		<!-- Ambient blobs -->
		<div
			class="blob-a pointer-events-none absolute left-[-5%] top-[-10%] h-[600px] w-[600px] rounded-full blur-[120px]"
			style="background: oklch(0.52 0.22 277 / 18%);"
			aria-hidden="true"
		></div>
		<div
			class="blob-b pointer-events-none absolute bottom-[10%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[100px]"
			style="background: oklch(0.65 0.22 155 / 12%);"
			aria-hidden="true"
		></div>
		<div
			class="blob-c pointer-events-none absolute right-[15%] top-[40%] h-[400px] w-[400px] rounded-full blur-[90px]"
			style="background: oklch(0.78 0.18 75 / 8%);"
			aria-hidden="true"
		></div>

		<!-- Content column -->
		<div
			class="relative z-10 mx-auto flex w-full min-w-0 max-w-[680px] flex-col items-center text-center"
		>
			<!-- Badge strip -->
			<div
				class="ani-up mb-6 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border px-3 py-1.5 text-center text-[11px] font-medium sm:px-4 sm:text-[12px]"
				style="background: var(--m-surface); border-color: var(--m-border-strong); color: var(--m-text-2);"
			>
				<span
					class="live-dot h-1.5 w-1.5 shrink-0 rounded-full"
					style="background: var(--m-green);"
					aria-hidden="true"
				></span>
				<Zap class="size-3 shrink-0" style="color: var(--m-accent);" aria-hidden="true" />
				Works with Bookeo · Resova · Xola — and more
			</div>

			<!-- Headline -->
			<h1
				class="ani-up d1 mb-6 max-w-full font-black tracking-tight text-balance"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(32px, 7vw, 80px); letter-spacing: -0.03em; line-height: 1.04;"
			>
				<span style="color: var(--m-text);">Your waiver is your</span><br />
				<span class="accent-shimmer">best customer list.</span>
			</h1>

			<!-- Subheadline -->
		<p
			class="ani-up d2 mx-auto mb-8 max-w-[520px] text-[15px] leading-relaxed sm:text-[17px]"
			style="color: var(--m-text-2);"
		>
				Waiver Director captures every participant's email when they sign — not just the lead
				booker. Automated follow-ups help you gather feedback and reviews after each visit.
			</p>

			<!-- CTAs -->
			<div class="ani-up d3 flex flex-wrap items-center justify-center gap-3">
				<Button
					href={resolve('/sign-up')}
					class="btn-mkt-accent h-11 gap-2 rounded-xl px-8 text-sm font-semibold"
				>
					Start for free
					<ArrowRight size={16} aria-hidden="true" />
				</Button>
				<Button
					href={resolve('/#how-it-works')}
					variant="outline"
					class="btn-mkt-outline h-11 rounded-xl px-8 text-sm font-medium"
				>
					See how it works
				</Button>
			</div>
		</div>

		<!-- Hero mockup -->
		<div class="ani-up d4 relative z-10 mx-auto mt-12 w-full max-w-5xl">
			<div
				class="overflow-hidden rounded-xl border"
				style="border-color: var(--m-border-strong); background: var(--m-surface); box-shadow: 0 40px 80px oklch(0 0 0 / 60%);"
			>
				<!-- Browser chrome -->
				<div
					class="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:h-9 sm:flex-nowrap sm:px-4 sm:py-0"
					style="background: var(--m-card); border-color: var(--m-border);"
				>
					<div class="order-1 flex shrink-0 items-center gap-1.5" aria-hidden="true">
						<div class="h-2.5 w-2.5 rounded-full" style="background: #ff5f57;"></div>
						<div class="h-2.5 w-2.5 rounded-full" style="background: #febc2e;"></div>
						<div class="h-2.5 w-2.5 rounded-full" style="background: #28c840;"></div>
					</div>
					<div
						class="order-3 min-w-0 max-w-full basis-full truncate rounded-md border px-2 py-1 text-center text-[10px] sm:order-2 sm:basis-auto sm:max-w-[min(100%,14rem)] sm:px-3 sm:text-[11px]"
						style="color: var(--m-text-3); background: var(--m-elevated); border-color: var(--m-border);"
						aria-hidden="true"
					>
						/sessions (preview)
					</div>
					<div class="order-2 flex shrink-0 items-center gap-1.5 sm:order-3">
						<span
							class="live-dot h-1.5 w-1.5 rounded-full"
							style="background: var(--m-green);"
							aria-hidden="true"
						></span>
						<span class="text-[11px] font-semibold" style="color: var(--m-green);">LIVE</span>
					</div>
				</div>

				<!-- Dashboard body -->
				<div class="p-5 md:p-6">
					<!-- Session header -->
					<div
						class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
					>
						<div class="min-w-0">
							<p class="mb-1 text-[10px] uppercase tracking-widest" style="color: var(--m-text-3);">
								Active Session
							</p>
						<h3
							class="mb-0.5 text-[15px] font-bold sm:text-[18px]"
							style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
						>
							Wilderness Zipline Tour
						</h3>
							<p class="text-[12px]" style="color: var(--m-text-3);">Today · 2:00 PM · via Bookeo</p>
						</div>
					<div
						class="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3 md:gap-6"
					>
						<div class="text-center">
							<div
								class="mb-1 text-[18px] font-bold leading-none sm:text-[22px]"
								style="color: var(--m-green);"
							>
								6
							</div>
							<div class="text-[10px] uppercase tracking-wide" style="color: var(--m-text-3);">
								Signed
							</div>
						</div>
						<div class="text-center">
							<div
								class="mb-1 text-[18px] font-bold leading-none sm:text-[22px]"
								style="color: var(--m-text);"
							>
								8
							</div>
							<div class="text-[10px] uppercase tracking-wide" style="color: var(--m-text-3);">
								Expected
							</div>
						</div>
						<div class="text-center">
							<div
								class="mb-1 text-[18px] font-bold leading-none sm:text-[22px]"
								style="color: var(--m-amber);"
							>
								2
							</div>
							<div class="text-[10px] uppercase tracking-wide" style="color: var(--m-text-3);">
								Pending
							</div>
						</div>
					</div>
					</div>

					<!-- Progress bar -->
					<div
						class="mb-5 h-1.5 overflow-hidden rounded-full"
						style="background: var(--m-border);"
						role="progressbar"
						aria-valuenow={75}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Waiver completion: 75%"
					>
						<div class="progress-fill h-full rounded-full" style="background: var(--m-green);"></div>
					</div>

					<!-- Participant rows -->
					<div class="flex flex-col">
						{#each sessionParticipants as p (p.name)}
							<div
								class="mb-1.5 flex items-center gap-3 rounded-lg border px-3 py-2"
								style={p.status === 'signed'
									? 'background: oklch(0.65 0.22 155 / 7%); border-color: oklch(0.65 0.22 155 / 20%);'
									: 'background: oklch(0.78 0.18 75 / 7%); border-color: oklch(0.78 0.18 75 / 20%);'}
							>
								<div
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
									style="background: var(--m-elevated); color: var(--m-text-2);"
									aria-hidden="true"
								>
									{p.name[0]}
								</div>
								<span
									class="min-w-0 flex-1 truncate text-[13px] font-medium"
									style="color: var(--m-text);">{p.name}</span
								>
								<span class="hidden text-[11px] sm:block" style="color: var(--m-text-3);"
									>{p.email}</span
								>
								{#if p.status === 'signed'}
									<span
										class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
										style="color: var(--m-green); background: var(--m-green-dim);"
									>
										<Check class="size-2.5" aria-hidden="true" />
										Signed
									</span>
									<span class="hidden shrink-0 text-[11px] md:block" style="color: var(--m-text-3);"
										>2 emails queued</span
									>
								{:else}
									<span
										class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
										style="color: var(--m-amber); background: var(--m-amber-dim);"
									>Pending</span>
									<span
										class="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium"
										style="color: var(--m-accent);"
										aria-hidden="true"
									>
										Send reminder
									</span>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Email automation note -->
					<div
						class="mt-4 flex items-start gap-2.5 rounded-lg border px-4 py-3"
						style="border-color: var(--m-border-strong); background: var(--m-elevated);"
					>
						<Mail
							size={14}
							class="mt-0.5 shrink-0"
							style="color: var(--m-accent);"
							aria-hidden="true"
						/>
						<p class="text-[12px] leading-relaxed" style="color: var(--m-text-2);">
							<strong style="color: var(--m-text);">6 follow-up emails scheduled</strong> — one per
							guest who signed, not just the lead. Use them for thank-yous, feedback, and review
							requests.
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ======================================================= DIFFERENTIATOR -->
	<section
		use:scrollReveal
		class="scroll-reveal border-b border-t py-20 md:py-24"
		style="background: var(--m-surface); border-color: var(--m-border);"
	>
		<div class="mx-auto max-w-6xl px-4 sm:px-6">
			<div class="mx-auto max-w-4xl">
				<header class="mb-8 space-y-3 md:mb-10">
					<p
						class="text-[11px] font-semibold uppercase tracking-widest"
						style="color: var(--m-accent);"
					>
						The Differentiator
					</p>
					<h2
						class="font-extrabold tracking-tight text-balance"
						style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(28px, 4vw, 44px); letter-spacing: -0.02em; color: var(--m-text);"
					>
						One booking. Six email addresses.
					</h2>
					<p class="max-w-2xl text-[16px] leading-relaxed text-pretty" style="color: var(--m-text-2);">
						Most booking systems record only the lead contact. With Waiver Director, every guest who
						signs is reachable for follow-ups — feedback, reviews, and more — not just the booker.
						Optional Mailchimp or Constant Contact sync for the lists you already run.
					</p>
				</header>

			<!-- Two-column visual -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
				<!-- Left: booking system -->
				<div
					class="flex h-full min-h-0 flex-col rounded-xl border p-5"
					style="border-color: var(--m-border-strong); background: var(--m-card);"
				>
					<p
						class="mb-4 text-[10px] font-semibold uppercase tracking-widest"
						style="color: var(--m-text-3);"
					>
						Bookeo Booking
					</p>
					<!-- Lead contact row -->
					<div
						class="mb-2 flex items-center gap-3 rounded-lg border px-3 py-2"
						style="background: var(--m-elevated); border-color: var(--m-border-strong);"
					>
						<div
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
							style="background: var(--m-accent-dim); color: var(--m-accent);"
							aria-hidden="true"
						>
							A
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-[12px] font-medium" style="color: var(--m-text);">
								Alex Martinez <span class="text-[10px] font-normal opacity-60">(lead)</span>
							</p>
							<p class="text-[11px]" style="color: var(--m-text-3);">alex@email.com</p>
						</div>
					</div>
					<!-- Ghost rows -->
					{#each [1, 2, 3, 4, 5] as n (n)}
						<div class="mb-1.5 flex items-center gap-3 rounded-lg px-3 py-2" style="opacity: 0.25;">
							<div
								class="h-6 w-6 shrink-0 rounded-full"
								style="background: var(--m-border-strong);"
							></div>
							<div
								class="h-3 flex-1 rounded"
								style="background: var(--m-border-strong);"
								aria-hidden="true"
							></div>
							<div
								class="h-3 w-16 rounded"
								style="background: var(--m-border-strong);"
								aria-hidden="true"
							></div>
						</div>
					{/each}
					<p class="mt-auto pt-4 text-[11px] leading-snug" style="color: var(--m-text-3);">
						5 guests have no contact record in your booking system.
					</p>
				</div>

				<!-- Right: after waiver signing -->
				<div
					class="flex h-full min-h-0 flex-col rounded-xl border p-5"
					style="border-color: var(--m-accent); background: var(--m-card); box-shadow: 0 0 30px var(--m-accent-glow);"
				>
					<p
						class="mb-4 text-[10px] font-semibold uppercase tracking-widest"
						style="color: var(--m-accent);"
					>
						Waiver Director
					</p>
					{#each differentiatorRight as person (person.name)}
						<div
							class="mb-1.5 flex items-center gap-3 rounded-lg border px-3 py-2"
							style="background: oklch(0.65 0.22 155 / 7%); border-color: oklch(0.65 0.22 155 / 20%);"
						>
							<div
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
								style="background: var(--m-elevated); color: var(--m-text-2);"
								aria-hidden="true"
							>
								{person.name[0]}
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-[12px] font-medium" style="color: var(--m-text);">
									{person.name}
								</p>
								<p class="truncate text-[11px]" style="color: var(--m-text-3);">{person.email}</p>
							</div>
							<span
								class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
								style="color: var(--m-green); background: var(--m-green-dim);"
							>
								<Check class="size-2.5" aria-hidden="true" /> Signed
							</span>
						</div>
					{/each}
					<p class="mt-auto pt-4 text-[11px] font-medium leading-snug" style="color: var(--m-accent);">
						6 guests captured → 6 follow-ups queued.
					</p>
				</div>
			</div>

			<!-- Callout -->
			<p class="mt-10 text-center text-[14px] font-medium leading-relaxed text-pretty" style="color: var(--m-text-2);">
				Works for any group experience — tours, ziplines, axe throwing, escape rooms, rentals, and
				more.
			</p>
			</div>
		</div>
	</section>

	<!-- ======================================================= HOW IT WORKS -->
	<section id="how-it-works" use:scrollReveal class="scroll-reveal py-20 md:py-24">
		<div class="mx-auto max-w-6xl px-4 sm:px-6">
			<div class="mb-16 text-center">
				<p
					class="mb-3 text-[11px] font-semibold uppercase tracking-widest"
					style="color: var(--m-accent);"
				>
					How It Works
				</p>
				<h2
					class="font-extrabold tracking-tight"
					style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(28px, 4vw, 44px); letter-spacing: -0.02em; color: var(--m-text);"
				>
					Up and running in three steps.
				</h2>
			</div>

			<div class="how-steps mx-auto flex max-w-4xl flex-col gap-16">
				<!-- Step 1 -->
				<div class="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
				<div>
						<div
							class="mb-3 font-black leading-none text-[clamp(2.25rem,11vw,3.25rem)] md:text-[4.5rem]"
							style="font-family: 'Bricolage Grotesque', sans-serif; color: oklch(0.52 0.22 277 / 30%);"
							aria-hidden="true"
						>
							01
						</div>
						<h3
							class="mb-3 text-[26px] font-bold"
							style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
						>
							Build your waiver template once.
						</h3>
						<p class="text-[15px] leading-relaxed" style="color: var(--m-text-2);">
							Create structured waivers with custom fields, signature blocks, and your branding.
							Publish a version — it's locked, so past submissions are never altered when you make
							edits.
						</p>
					</div>
					<!-- Waiver builder mockup -->
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
								style="color: var(--m-amber); background: var(--m-amber-dim);">Draft</span
							>
						</div>
						{#each ['Full Name', 'Date of Birth', 'Emergency Contact'] as field (field)}
							<div
								class="mb-2 rounded-lg border px-3 py-2.5"
								style="background: var(--m-card); border-color: var(--m-border);"
							>
								<p class="mb-1 text-[9px] uppercase tracking-widest" style="color: var(--m-text-3);">
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
							>Publish v2</span>
							<span class="text-[11px]" style="color: var(--m-text-3);">3 changes since v1</span>
						</div>
					</div>
				</div>

				<!-- Step 2 -->
				<div class="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
				<div class="md:order-last">
						<div
							class="mb-3 font-black leading-none text-[clamp(2.25rem,11vw,3.25rem)] md:text-[4.5rem]"
							style="font-family: 'Bricolage Grotesque', sans-serif; color: oklch(0.52 0.22 277 / 30%);"
							aria-hidden="true"
						>
							02
						</div>
						<h3
							class="mb-3 text-[26px] font-bold"
							style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
						>
							Connect your booking system.
						</h3>
						<p class="text-[15px] leading-relaxed" style="color: var(--m-text-2);">
							Link Bookeo, Resova, or Xola. Sessions and expected participant counts sync
							automatically. Waivers are matched to the right group — no manual setup per session.
						</p>
					</div>
					<!-- Provider integration mockup -->
					<div
						class="rounded-xl border p-4"
						style="background: var(--m-surface); border-color: var(--m-border-strong);"
					>
						<p
							class="mb-4 text-[10px] font-semibold uppercase tracking-widest"
							style="color: var(--m-text-3);"
						>
							Booking Integrations
						</p>
						<div class="mb-4 grid grid-cols-3 gap-3">
							{#each [
								{ name: 'Bookeo', connected: true },
								{ name: 'Resova', connected: true },
								{ name: 'Xola', connected: false }
							] as provider (provider.name)}
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

				<!-- Step 3 -->
				<div class="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
				<div>
						<div
							class="mb-3 font-black leading-none text-[clamp(2.25rem,11vw,3.25rem)] md:text-[4.5rem]"
							style="font-family: 'Bricolage Grotesque', sans-serif; color: oklch(0.52 0.22 277 / 30%);"
							aria-hidden="true"
						>
							03
						</div>
						<h3
							class="mb-3 text-[26px] font-bold"
							style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
						>
							Guests sign before they arrive.
						</h3>
						<p class="text-[15px] leading-relaxed" style="color: var(--m-text-2);">
							Share a link by email, SMS, or booking confirmation. Anyone in the group can sign from
							their phone. You see real-time completion in your session dashboard.
						</p>
					</div>
					<!-- Link sharing mockup -->
					<div
						class="rounded-xl border p-4"
						style="background: var(--m-surface); border-color: var(--m-border-strong);"
					>
						<p
							class="mb-4 text-[10px] font-semibold uppercase tracking-widest"
							style="color: var(--m-text-3);"
						>
							Campaign Link
						</p>
						<div
							class="mb-4 flex items-center gap-2 rounded-lg border px-3 py-2.5"
							style="background: var(--m-card); border-color: var(--m-border);"
						>
							<span class="min-w-0 flex-1 truncate text-[12px]" style="color: var(--m-text-2);"
								>waivers.yourvenue.com/adventure-tour</span
							>
							<span
								class="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold"
								style="background: var(--m-accent-dim); color: var(--m-accent);"
								aria-hidden="true"
							>Copy</span>
						</div>
						<div class="mb-4 flex flex-wrap items-center gap-2">
							{#each ['Email', 'SMS', 'Booking confirmation'] as method (method)}
								<span
									class="rounded-full border px-3 py-1 text-[11px] font-medium"
									style="color: var(--m-text-2); border-color: var(--m-border-strong); background: var(--m-card);"
									>{method}</span
								>
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

	<!-- ======================================================= FEATURES GRID -->
	<section
		id="features"
		use:scrollReveal
		class="scroll-reveal border-t py-20 md:py-24"
		style="border-color: var(--m-border); background: var(--m-surface);"
	>
		<div class="mx-auto max-w-6xl px-4 sm:px-6">
			<div class="mb-12 text-center">
				<p
					class="mb-3 text-[11px] font-semibold uppercase tracking-widest"
					style="color: var(--m-accent);"
				>
					Everything You Need
				</p>
				<h2
					class="font-extrabold tracking-tight"
					style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(28px, 4vw, 42px); letter-spacing: -0.02em; color: var(--m-text);"
				>
					Built for the way you actually run sessions.
				</h2>
			</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
			{#each features as feat, i (feat.title)}
				{@const Icon = feat.icon}
				{@const cfg = featureConfig[i]}
				<div
					class="feat-card relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-6 {cfg.md} {cfg.lg}"
					style="{cfg.hero
						? 'background: linear-gradient(135deg, oklch(0.52 0.22 277 / 8%) 0%, var(--m-surface) 65%); border-color: oklch(0.52 0.22 277 / 22%);'
						: 'background: var(--m-surface); border-color: var(--m-border);'}"
				>
					{#if cfg.hero}
						<div
							class="pointer-events-none absolute inset-x-0 top-0 h-px"
							style="background: linear-gradient(90deg, transparent, oklch(0.52 0.22 277 / 60%), transparent);"
							aria-hidden="true"
						></div>
						<div
							class="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full blur-[80px]"
							style="background: oklch(0.52 0.22 277 / 10%);"
							aria-hidden="true"
						></div>
					{/if}

					<div
						class="relative flex shrink-0 items-center justify-center rounded-xl {cfg.hero
							? 'h-12 w-12'
							: 'h-9 w-9'}"
						style="{cfg.hero
							? 'background: oklch(0.52 0.22 277 / 16%); box-shadow: 0 0 16px oklch(0.52 0.22 277 / 18%);'
							: 'background: var(--m-accent-dim);'}"
						aria-hidden="true"
					>
						<Icon size={cfg.hero ? 22 : 18} style="color: var(--m-accent);" />
					</div>

					<div class="relative flex flex-1 flex-col gap-2">
						<h3
							class="{cfg.hero ? 'text-[18px]' : 'text-[15px]'} font-semibold"
							style="color: var(--m-text);"
						>{feat.title}</h3>
						<p
							class="{cfg.hero ? 'text-[14px]' : 'text-[13px]'} leading-relaxed"
							style="color: var(--m-text-2);"
						>{feat.desc}</p>
					</div>

					{#if feat.title === 'Waiver Builder'}
						<div class="mt-auto flex items-center gap-2 opacity-60">
							<span
								class="rounded-md border px-2 py-0.5 font-mono text-[9px]"
								style="border-color: var(--m-border-strong); color: var(--m-text-3);"
								aria-hidden="true">v1 locked</span
							>
							<span class="text-[9px]" style="color: var(--m-text-3);" aria-hidden="true">→</span>
							<span
								class="rounded-md border px-2 py-0.5 font-mono text-[9px]"
								style="border-color: oklch(0.52 0.22 277 / 40%); color: var(--m-accent);"
								aria-hidden="true">v2 current</span
							>
							<span class="text-[9px]" style="color: var(--m-text-3);" aria-hidden="true"
								>· 3 changes</span
							>
						</div>
					{:else if feat.title === 'Completion Analytics'}
						<div
							class="mt-auto flex h-9 items-end gap-1 overflow-hidden rounded-lg px-2 py-1.5 opacity-50"
							style="background: var(--m-elevated);"
							aria-hidden="true"
						>
							{#each chartBars as bar (bar.day)}
								<div
									class="flex-1 rounded-t-sm"
									style="height: {bar.pct}%; background: var(--m-accent); min-height: 2px;"
								></div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
		</div>
	</section>

	<!-- ======================================================= ANALYTICS PREVIEW -->
	<section
		use:scrollReveal
		class="scroll-reveal border-b border-t py-24"
		style="background: var(--m-surface); border-color: var(--m-border);"
	>
		<div class="mx-auto max-w-6xl px-4 sm:px-6">
			<p
				class="mb-3 text-[11px] font-semibold uppercase tracking-widest"
				style="color: var(--m-accent);"
			>
				Dashboard
			</p>
			<h2
				class="mb-3 font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(28px, 4vw, 42px); letter-spacing: -0.02em; color: var(--m-text);"
			>
				Know your completion rate for every session.
			</h2>
			<p class="mb-10 max-w-xl text-[15px] leading-relaxed" style="color: var(--m-text-2);">
				See signed, expected, and completion stats at a glance — numbers update as waivers come in,
				so you're not looking at a stale snapshot.
			</p>

			<!-- Analytics mockup -->
			<div
				class="mt-10 overflow-hidden rounded-xl border"
				style="background: var(--m-surface); border-color: var(--m-border-strong);"
			>
				<!-- Header bar -->
				<div
					class="flex min-h-12 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-0"
					style="background: var(--m-card); border-color: var(--m-border);"
				>
					<span class="text-[13px] font-semibold" style="color: var(--m-text);"
						>Analytics Dashboard</span
					>
					<div class="flex flex-wrap items-center gap-2 sm:gap-3">
						<span
							class="rounded-md border px-2.5 py-1 text-[11px]"
							style="color: var(--m-text-2); border-color: var(--m-border-strong); background: var(--m-elevated);"
							>Last 7 days</span
						>
						<span
							class="text-[11px] font-medium"
							style="color: var(--m-accent);"
							aria-hidden="true"
						>Export CSV</span
						>
					</div>
				</div>

			<!-- Stats row -->
			<div class="grid grid-cols-2 md:grid-cols-4">
				{#each analyticsStats as stat (stat.label)}
					<div class="stat-cell min-w-0 p-4 sm:p-5">
							<p
								class="mb-2 text-[10px] uppercase tracking-wide"
								style="color: var(--m-text-3);"
							>
								{stat.label}
							</p>
							<p class="mb-1 text-[26px] font-bold leading-none" style="color: var(--m-text);">
								{stat.value}
							</p>
							<p class="text-[11px]" style="color: {stat.green ? 'var(--m-green)' : 'var(--m-text-3)'};">
								{stat.sub}
							</p>
						</div>
					{/each}
				</div>

				<!-- Chart -->
				<div class="p-5">
					<p class="mb-4 text-[11px] font-semibold" style="color: var(--m-text-2);">
						Submissions — Last 7 Days
					</p>
					<div
						class="flex h-28 items-end gap-2"
						role="img"
						aria-label="Bar chart: daily waiver submissions over the last 7 days"
					>
						{#each chartBars as bar (bar.day)}
							<div class="flex flex-1 flex-col items-center gap-1.5">
								<div
									class="w-full rounded-t-sm"
									style="height: {bar.pct}%; background: var(--m-accent); opacity: 0.85;"
									aria-hidden="true"
								></div>
								<span class="text-[10px] uppercase" style="color: var(--m-text-3);">{bar.day}</span>
							</div>
						{/each}
					</div>

					<!-- Session table (semantic markup; scroll horizontally on narrow viewports) -->
					<div class="mt-5 overflow-x-auto rounded-lg border" style="border-color: var(--m-border);">
						<table
							class="w-full min-w-176 border-collapse text-left text-[12px]"
							style="border-color: var(--m-border);"
						>
							<caption class="sr-only">
								Sample sessions with expected signers, signed counts, completion rate, and status
							</caption>
							<thead>
								<tr
									class="text-[10px] uppercase tracking-wide"
									style="background: var(--m-elevated); color: var(--m-text-3);"
								>
									<th scope="col" class="px-4 py-2.5 font-semibold">Session</th>
									<th scope="col" class="px-4 py-2.5 font-semibold">Date</th>
									<th scope="col" class="px-4 py-2.5 font-semibold">Provider</th>
									<th scope="col" class="px-4 py-2.5 font-semibold">Expected</th>
									<th scope="col" class="px-4 py-2.5 font-semibold">Signed</th>
									<th scope="col" class="px-4 py-2.5 font-semibold">Rate</th>
									<th scope="col" class="px-4 py-2.5 font-semibold">Status</th>
								</tr>
							</thead>
							<tbody>
								{#each sessionRows as row (row.session)}
									<tr class="border-t" style="border-color: var(--m-border);">
										<td class="max-w-48 truncate px-4 py-3 font-medium" style="color: var(--m-text);">
											{row.session}
										</td>
										<td class="whitespace-nowrap px-4 py-3" style="color: var(--m-text-2);">
											{row.date}
										</td>
										<td class="whitespace-nowrap px-4 py-3" style="color: var(--m-text-2);">
											{row.provider}
										</td>
										<td class="whitespace-nowrap px-4 py-3" style="color: var(--m-text-2);">
											{row.expected}
										</td>
										<td class="whitespace-nowrap px-4 py-3" style="color: var(--m-text-2);">
											{row.signed}
										</td>
										<td class="whitespace-nowrap px-4 py-3" style="color: var(--m-text-2);">
											{row.rate}
										</td>
										<td class="px-4 py-3">
											<span
												class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
												style="color: {row.color}; background: {row.bg};">{row.status}</span
											>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</section>

	<div use:scrollReveal class="scroll-reveal">
		<MarketingPricing />
	</div>

	<!-- ======================================================= CTA BANNER -->
	<section
		use:scrollReveal
		class="scroll-reveal relative overflow-hidden border-t py-32"
		style="background: var(--m-bg); border-color: var(--m-border);"
	>
		<!-- Gradient separator at top -->
		<div class="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden="true">
			<div
				class="h-px w-3/4 max-w-2xl"
				style="background: linear-gradient(90deg, transparent, oklch(0.52 0.22 277 / 50%), transparent);"
			></div>
		</div>
		<div
			class="blob-a pointer-events-none absolute left-[5%] top-[-10%] h-[500px] w-[500px] rounded-full blur-[130px]"
			style="background: oklch(0.52 0.22 277 / 22%);"
			aria-hidden="true"
		></div>
		<div
			class="blob-b pointer-events-none absolute bottom-[-15%] right-[5%] h-[450px] w-[450px] rounded-full blur-[110px]"
			style="background: oklch(0.65 0.22 155 / 10%);"
			aria-hidden="true"
		></div>
		<!-- Center glow -->
		<div
			class="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
			style="background: oklch(0.52 0.22 277 / 8%);"
			aria-hidden="true"
		></div>

		<div class="relative z-10 flex flex-col items-center gap-6 px-4 text-center sm:px-6">
			<div
				class="mb-2 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-medium"
				style="background: var(--m-surface); border-color: var(--m-border-strong); color: var(--m-text-2);"
			>
				<span
					class="live-dot h-1.5 w-1.5 shrink-0 rounded-full"
					style="background: var(--m-green);"
					aria-hidden="true"
				></span>
				Now in early access
			</div>
			<h2
				class="max-w-2xl font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(30px, 5vw, 60px); letter-spacing: -0.03em; line-height: 1.06; color: var(--m-text);"
			>
				Stop leaving half your<br />group's emails behind.
			</h2>
			<p class="max-w-[420px] text-[16px] leading-relaxed" style="color: var(--m-text-2);">
				Every person who signs a waiver becomes a contact. Waiver Director turns your
				compliance step into your best email list.
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
			<p class="text-[12px]" style="color: var(--m-text-3);">Free to start · No credit card required</p>
		</div>
	</section>

<style>
	@keyframes floatA {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		33% {
			transform: translate(30px, -40px) scale(1.05);
		}
		66% {
			transform: translate(-20px, 20px) scale(0.97);
		}
	}
	@keyframes floatB {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		33% {
			transform: translate(-40px, 30px) scale(1.04);
		}
		66% {
			transform: translate(25px, -25px) scale(0.98);
		}
	}
	@keyframes floatC {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(20px, 40px) scale(1.06);
		}
	}
	@keyframes aniUp {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes livePulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.8);
		}
	}
	@keyframes progressFill {
		from {
			width: 0%;
		}
		to {
			width: 75%;
		}
	}

	.blob-a {
		animation: floatA 18s ease-in-out infinite;
	}
	.blob-b {
		animation: floatB 22s ease-in-out infinite;
	}
	.blob-c {
		animation: floatC 16s ease-in-out infinite;
	}

	.ani-up {
		animation: aniUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.d1 {
		animation-delay: 0.1s;
	}
	.d2 {
		animation-delay: 0.2s;
	}
	.d3 {
		animation-delay: 0.3s;
	}
	.d4 {
		animation-delay: 0.4s;
	}
	.live-dot {
		animation: livePulse 1.8s ease-in-out infinite;
	}

	.progress-fill {
		animation: progressFill 1.2s 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.dot-grid {
		background-image: radial-gradient(circle, oklch(1 0 0 / 18%) 1px, transparent 1px);
		background-size: 24px 24px;
	}

	.grad-text {
		background: linear-gradient(
			160deg,
			oklch(0.97 0 0) 0%,
			oklch(0.88 0.06 277) 45%,
			oklch(0.70 0.22 277) 100%
		);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}

	.feat-card {
		transition:
			transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.22s ease;
	}
	.feat-card:hover {
		transform: translateY(-4px);
		box-shadow:
			0 0 0 1px oklch(1 0 0 / 10%),
			0 16px 48px oklch(0 0 0 / 50%),
			0 0 60px oklch(0.52 0.22 277 / 12%);
	}

	/* ── Accent headline: solid accent + rare soft glint ─────────── */
	@keyframes hero-text-glint {
		0%,
		85%,
		92%,
		100% {
			background-position: 0% 50%;
		}
		88.5% {
			background-position: 100% 50%;
		}
	}
	.accent-shimmer {
		background: linear-gradient(
			95deg,
			oklch(0.51 0.21 277) 0%,
			oklch(0.52 0.22 277) 42%,
			oklch(0.60 0.16 277) 50%,
			oklch(0.52 0.22 277) 58%,
			oklch(0.51 0.21 277) 100%
		);
		background-size: 220% 100%;
		background-position: 0% 50%;
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		animation: hero-text-glint 11s ease-in-out infinite;
	}

	/* ── Scroll-reveal ───────────────────────────────────────────── */
	.scroll-reveal {
		opacity: 0;
		transform: translateY(22px);
		transition:
			opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1),
			transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.scroll-reveal.is-revealed {
		opacity: 1;
		transform: translateY(0);
	}

	/* ── Analytics stats grid dividers ─────────────────────────── */
	/* Mobile 2-col: right border on col 1, bottom border on row 1  */
	/* Desktop 4-col: right border on cols 1-3, no bottom border    */
	.stat-cell {
		background: var(--m-card);
	}
	.stat-cell:nth-child(odd) {
		border-right: 1px solid var(--m-border);
	}
	.stat-cell:nth-child(-n + 2) {
		border-bottom: 1px solid var(--m-border);
	}
	@media (min-width: 768px) {
		.stat-cell:nth-child(odd) {
			border-right: none;
		}
		.stat-cell:nth-child(-n + 2) {
			border-bottom: none;
		}
		.stat-cell:nth-child(-n + 3) {
			border-right: 1px solid var(--m-border);
		}
	}

	/* ── How-it-works step connectors ───────────────────────────── */
	.how-steps > div {
		position: relative;
	}
	.how-steps > div:not(:last-child)::after {
		content: '';
		position: absolute;
		bottom: -4rem;
		left: 2.5rem;
		width: 1px;
		height: 4rem;
		background: linear-gradient(
			to bottom,
			oklch(0.52 0.22 277 / 28%),
			oklch(0.52 0.22 277 / 6%)
		);
	}

	@media (prefers-reduced-motion: reduce) {
		.blob-a,
		.blob-b,
		.blob-c,
		.ani-up,
		.live-dot,
		.feat-card {
			animation: none !important;
			transition: none !important;
		}
		.progress-fill {
			animation: none !important;
			width: 75%;
		}
		.accent-shimmer {
			animation: none;
			background: none;
			background-size: auto;
			-webkit-text-fill-color: var(--m-accent);
			color: var(--m-accent);
		}
		.scroll-reveal {
			opacity: 1 !important;
			transform: none !important;
			transition: none !important;
		}
	}
</style>
