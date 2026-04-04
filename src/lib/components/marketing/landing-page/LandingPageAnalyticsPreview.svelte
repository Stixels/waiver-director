<script lang="ts">
	import { chartBars } from './content';
	import MarketingSectionHeading from './MarketingSectionHeading.svelte';
	import { scrollReveal } from './scrollReveal';

	type Tone = 'positive' | 'muted' | 'warning' | 'neutral';
	type SessionTone = 'positive' | 'warning' | 'neutral';

	const analyticsStats = [
		{ label: 'Total Submissions', value: '1,247', subtitle: '↑ 12% this week', tone: 'positive' },
		{ label: 'Avg Completion Rate', value: '91%', subtitle: 'across all sessions', tone: 'muted' },
		{ label: 'Emails Sent', value: '3,891', subtitle: '48 pending', tone: 'muted' },
		{ label: 'Sessions Synced', value: '148', subtitle: 'from 3 providers', tone: 'muted' }
	] as const;

	const sessionRows = [
		{
			session: 'Wilderness Zipline Tour',
			date: 'Apr 2, 2:00 PM',
			provider: 'Bookeo',
			expected: 8,
			signed: 8,
			rate: '100%',
			status: 'Complete',
			tone: 'positive'
		},
		{
			session: 'Urban Axe Throwing',
			date: 'Apr 2, 7:30 PM',
			provider: 'Resova',
			expected: 6,
			signed: 4,
			rate: '67%',
			status: 'In Progress',
			tone: 'warning'
		},
		{
			session: 'Harbor Kayak Adventure',
			date: 'Apr 3, 9:00 AM',
			provider: 'Xola',
			expected: 10,
			signed: 0,
			rate: '0%',
			status: 'Upcoming',
			tone: 'neutral'
		}
	] as const;

	const statToneClasses: Record<Tone, string> = {
		positive: 'mkt-success',
		muted: 'mkt-text-3',
		warning: 'mkt-warning',
		neutral: 'mkt-text-3'
	};

	const sessionToneClasses: Record<SessionTone, string> = {
		positive: 'mkt-chip-success',
		warning: 'mkt-chip-warning',
		neutral: 'mkt-elevated mkt-text-3'
	};
</script>

<section
	class="landing-reveal border-t border-b py-24"
	style="background: var(--m-surface); border-color: var(--m-border);"
	{@attach scrollReveal}
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<MarketingSectionHeading
			eyebrow="Dashboard"
			title="Know your completion rate for every session."
			description="See signed, expected, and completion stats at a glance. Numbers update as waivers come in, so you&apos;re not looking at a stale snapshot."
			class="mb-10"
		/>

		<div class="mkt-panel mt-10 overflow-hidden rounded-xl border">
			<div
				class="mkt-card mkt-border flex min-h-12 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-0"
			>
				<span class="mkt-text text-[13px] font-semibold">Analytics Dashboard</span>
				<div class="flex flex-wrap items-center gap-2 sm:gap-3">
					<span
						class="mkt-elevated mkt-border-strong mkt-text-2 rounded-md border px-2.5 py-1 text-[11px]"
					>
						Last 7 days
					</span>
					<span class="mkt-accent text-[11px] font-medium" aria-hidden="true">Export CSV</span>
				</div>
			</div>

			<div class="grid grid-cols-2 md:grid-cols-4">
				{#each analyticsStats as stat (stat.label)}
					<div class="landing-analytics__stat-cell min-w-0 p-4 sm:p-5">
						<p class="mkt-text-3 mb-2 text-[10px] tracking-wide uppercase">
							{stat.label}
						</p>
						<p class="mkt-text mb-1 text-[26px] leading-none font-bold">{stat.value}</p>
						<p class={[statToneClasses[stat.tone], 'text-[11px]']}>{stat.subtitle}</p>
					</div>
				{/each}
			</div>

			<div class="p-5">
				<p class="mkt-text-2 mb-4 text-[11px] font-semibold">Submissions — Last 7 Days</p>
				<div
					class="flex h-28 items-end gap-2"
					role="img"
					aria-label="Bar chart: daily waiver submissions over the last 7 days"
				>
					{#each chartBars as bar (bar.day)}
						<div class="flex flex-1 flex-col items-center gap-1.5">
							<div
								class="w-full rounded-t-sm"
								style={`height: ${bar.pct}%; background: var(--m-accent); opacity: 0.85;`}
								aria-hidden="true"
							></div>
							<span class="mkt-text-3 text-[10px] uppercase">{bar.day}</span>
						</div>
					{/each}
				</div>

				<div class="mkt-border mt-5 overflow-x-auto rounded-lg border">
					<table class="w-full min-w-[44rem] border-collapse text-left text-[12px]">
						<caption class="sr-only">
							Sample sessions with expected signers, signed counts, completion rate, and status
						</caption>
						<thead>
							<tr class="mkt-elevated mkt-text-3 text-[10px] tracking-wide uppercase">
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
								<tr class="mkt-border border-t">
									<td class="mkt-text max-w-48 truncate px-4 py-3 font-medium">{row.session}</td>
									<td class="mkt-text-2 px-4 py-3 whitespace-nowrap">{row.date}</td>
									<td class="mkt-text-2 px-4 py-3 whitespace-nowrap">{row.provider}</td>
									<td class="mkt-text-2 px-4 py-3 whitespace-nowrap">{row.expected}</td>
									<td class="mkt-text-2 px-4 py-3 whitespace-nowrap">{row.signed}</td>
									<td class="mkt-text-2 px-4 py-3 whitespace-nowrap">{row.rate}</td>
									<td class="px-4 py-3">
										<span
											class={[
												sessionToneClasses[row.tone],
												'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold'
											]}
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
</section>

<style>
	.landing-analytics__stat-cell {
		background: var(--m-card);
	}

	.landing-analytics__stat-cell:nth-child(odd) {
		border-right: 1px solid var(--m-border);
	}

	.landing-analytics__stat-cell:nth-child(-n + 2) {
		border-bottom: 1px solid var(--m-border);
	}

	@media (min-width: 768px) {
		.landing-analytics__stat-cell:nth-child(odd) {
			border-right: none;
		}

		.landing-analytics__stat-cell:nth-child(-n + 2) {
			border-bottom: none;
		}

		.landing-analytics__stat-cell:nth-child(-n + 3) {
			border-right: 1px solid var(--m-border);
		}
	}
</style>
