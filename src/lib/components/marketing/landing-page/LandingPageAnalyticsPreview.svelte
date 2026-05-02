<script lang="ts">
	import { CalendarCheck, Mail, ScrollText, UsersRound } from '@lucide/svelte';

	import { scrollReveal } from '$lib/actions/scroll-reveal';

	const kpiCards = [
		{
			id: 'bookings',
			label: 'Bookings Today',
			value: 7,
			icon: CalendarCheck,
			color: 'var(--primary)',
			bg: 'color-mix(in oklch, var(--primary) 12%, transparent)',
			comparison: '+18% this week',
			trend: [4, 6, 3, 8, 5, 7, 7],
			weekTotal: 40
		},
		{
			id: 'submissions',
			label: 'Submissions Today',
			value: 37,
			icon: ScrollText,
			color: 'oklch(0.627 0.194 149.21)',
			bg: 'color-mix(in oklch, oklch(0.627 0.194 149.21) 12%, transparent)',
			comparison: '+12% this week',
			trend: [28, 31, 24, 41, 36, 39, 37],
			weekTotal: 236
		},
		{
			id: 'followups',
			label: 'Follow-ups Sent',
			value: 28,
			icon: Mail,
			color: 'oklch(0.7 0.15 60)',
			bg: 'color-mix(in oklch, oklch(0.7 0.15 60) 12%, transparent)',
			comparison: '+8% this week',
			trend: [18, 24, 21, 29, 31, 26, 28],
			weekTotal: 177
		},
		{
			id: 'customers',
			label: 'New Customers',
			value: 14,
			icon: UsersRound,
			color: 'oklch(0.58 0.18 255)',
			bg: 'color-mix(in oklch, oklch(0.58 0.18 255) 12%, transparent)',
			comparison: '+5% this week',
			trend: [9, 11, 8, 15, 13, 12, 14],
			weekTotal: 82
		}
	] as const;

	type SessionTone = 'positive' | 'warning' | 'neutral';

	const sessionRows = [
		{
			session: 'Wilderness Zipline Tour',
			date: 'Apr 2, 2:00 PM',
			provider: 'Bookeo',
			expected: 8,
			signed: 8,
			rate: '100%',
			status: 'Complete',
			tone: 'positive' as SessionTone
		},
		{
			session: 'Urban Axe Throwing',
			date: 'Apr 2, 7:30 PM',
			provider: 'Bookeo',
			expected: 6,
			signed: 4,
			rate: '67%',
			status: 'In Progress',
			tone: 'warning' as SessionTone
		},
		{
			session: 'Harbor Kayak Adventure',
			date: 'Apr 3, 9:00 AM',
			provider: 'Bookeo',
			expected: 10,
			signed: 0,
			rate: '0%',
			status: 'Upcoming',
			tone: 'neutral' as SessionTone
		}
	] as const;

	const sessionToneStyles: Record<SessionTone, string> = {
		positive: 'background: var(--m-green-dim); color: var(--m-green);',
		warning: 'background: var(--m-amber-dim); color: var(--m-amber);',
		neutral: 'background: var(--m-elevated); color: var(--m-text-3);'
	};

	function barHeight(val: number, maxVal: number): number {
		return Math.max(8, Math.round((val / maxVal) * 100));
	}
</script>

<section
	class="border-t border-b py-28 md:py-36"
	style="background: var(--m-surface); border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<div use:scrollReveal={{ delay: 0 }}>
			<p
				class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
				style="color: var(--primary);"
			>
				Dashboard
			</p>
			<h2
				class="mb-4 max-w-xl font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.75rem); letter-spacing: -0.03em; line-height: 1.06;"
			>
				Know your completion rate for every session.
			</h2>
			<p class="mb-10 max-w-xl text-[15px] leading-relaxed" style="color: var(--m-text-2);">
				Signed, expected, and completion stats in one view. Numbers update as waivers come in — not
				a stale snapshot.
			</p>
		</div>

		<div
			class="overflow-hidden rounded-2xl border"
			style="background: var(--m-bg); border-color: var(--m-border-strong); box-shadow: 0 24px 64px oklch(0 0 0 / 45%), inset 0 1px 0 oklch(1 0 0 / 4%);"
			use:scrollReveal={{ delay: 80 }}
		>
			<!-- Title bar -->
			<div
				class="flex items-center justify-between border-b px-5 py-3"
				style="background: var(--m-card); border-color: var(--m-border-soft);"
			>
				<span class="text-[13px] font-semibold">Dashboard</span>
				<span
					class="rounded-lg border px-2.5 py-1 text-[11px]"
					style="border-color: var(--m-border-strong); background: var(--m-elevated); color: var(--m-text-2);"
				>
					Today · May 2
				</span>
			</div>

			<!-- KPI cards -->
			<div class="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
				{#each kpiCards as card, i (card.id)}
					{@const Icon = card.icon}
					{@const maxTrend = Math.max(...card.trend)}
					<div
						class="flex flex-col justify-between rounded-xl border p-4"
						style="border-color: var(--m-border-soft); background: var(--m-card);"
						use:scrollReveal={{ delay: 140 + i * 50 }}
					>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="text-[11px] font-medium" style="color: var(--m-text-2);">{card.label}</p>
								<p class="mt-1 text-[26px] leading-none font-bold tracking-tight tabular-nums">
									{card.value}
								</p>
							</div>
							<div
								class="shrink-0 rounded-lg p-2.5"
								style="color: {card.color}; background: {card.bg};"
								aria-hidden="true"
							>
								<Icon class="size-4" />
							</div>
						</div>

						<!-- Sparkline -->
						<div class="mt-3 space-y-1.5">
							<div
								class="flex h-10 items-end gap-0.5"
								role="img"
								aria-label="{card.label} 7-day trend"
							>
								{#each card.trend as val, di (di)}
									<div class="flex h-full flex-1 flex-col justify-end" aria-hidden="true">
										<div
											class="w-full rounded-t-[2px]"
											style="height: {barHeight(
												val,
												maxTrend
											)}%; background: {card.color}; opacity: {di === card.trend.length - 1
												? '1'
												: '0.35'};"
										></div>
									</div>
								{/each}
							</div>
							<div class="flex items-center justify-between text-[0.6rem] leading-none">
								<span style="color: var(--m-text-2);"
									>{card.weekTotal.toLocaleString()} this week</span
								>
								<span style="color: var(--m-text-3);">{card.comparison}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Sessions table -->
			<div class="border-t px-4 pt-0 pb-4" style="border-color: var(--m-border-soft);">
				<div
					class="overflow-hidden rounded-xl border"
					style="border-color: var(--m-border-soft); background: var(--m-card);"
					use:scrollReveal={{ delay: 200 }}
				>
					<div
						class="flex items-center justify-between border-b px-4 py-2.5"
						style="border-color: var(--m-border-soft); background: var(--m-elevated);"
					>
						<span
							class="text-[10px] font-semibold tracking-wide uppercase"
							style="color: var(--m-text-2);">Upcoming Sessions</span
						>
						<span class="text-[11px] font-medium" style="color: var(--primary);" aria-hidden="true"
							>View all →</span
						>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full border-collapse text-left text-[12px]">
							<caption class="sr-only">Sessions with signed vs expected counts</caption>
							<thead>
								<tr style="background: var(--m-bg);">
									{#each ['Session', 'Date', 'Provider', 'Signed / Expected', 'Rate', 'Status'] as col (col)}
										<th
											scope="col"
											class="px-4 py-2.5 text-[10px] font-semibold tracking-wide uppercase"
											style="color: var(--m-text-3);"
										>
											{col}
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each sessionRows as row (row.session)}
									<tr class="border-t" style="border-color: var(--m-border-soft);">
										<td class="max-w-44 truncate px-4 py-3 font-medium">{row.session}</td>
										<td class="px-4 py-3 whitespace-nowrap" style="color: var(--m-text-2);"
											>{row.date}</td
										>
										<td class="px-4 py-3 whitespace-nowrap" style="color: var(--m-text-2);"
											>{row.provider}</td
										>
										<td class="px-4 py-3 font-medium whitespace-nowrap">
											{row.signed}
											<span style="color: var(--m-text-2);">/ {row.expected}</span>
										</td>
										<td class="px-4 py-3 font-semibold whitespace-nowrap">{row.rate}</td>
										<td class="px-4 py-3">
											<span
												class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
												style={sessionToneStyles[row.tone]}
											>
												{row.status}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
