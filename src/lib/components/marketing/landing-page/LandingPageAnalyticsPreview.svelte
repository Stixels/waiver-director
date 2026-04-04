<script lang="ts">
	import { chartBars } from './content';
	import MarketingSectionHeading from './MarketingSectionHeading.svelte';
	import { scrollReveal } from './scrollReveal';

	type Tone = 'positive' | 'muted' | 'warning' | 'neutral';

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

	const toneColors: Record<Tone, string> = {
		positive: 'var(--m-green)',
		muted: 'var(--m-text-3)',
		warning: 'var(--m-amber)',
		neutral: 'var(--m-text-3)'
	};

	const toneBackgrounds: Record<Exclude<Tone, 'muted'>, string> = {
		positive: 'var(--m-green-dim)',
		warning: 'var(--m-amber-dim)',
		neutral: 'var(--m-elevated)'
	};

	const sessionToneBackgrounds: Record<(typeof sessionRows)[number]['tone'], string> = {
		positive: toneBackgrounds.positive,
		warning: toneBackgrounds.warning,
		neutral: toneBackgrounds.neutral
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

		<div
			class="mt-10 overflow-hidden rounded-xl border"
			style="background: var(--m-surface); border-color: var(--m-border-strong);"
		>
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
					>
						Last 7 days
					</span>
					<span class="text-[11px] font-medium" style="color: var(--m-accent);" aria-hidden="true"
						>Export CSV</span
					>
				</div>
			</div>

			<div class="grid grid-cols-2 md:grid-cols-4">
				{#each analyticsStats as stat (stat.label)}
					<div class="landing-analytics__stat-cell min-w-0 p-4 sm:p-5">
						<p class="mb-2 text-[10px] tracking-wide uppercase" style="color: var(--m-text-3);">
							{stat.label}
						</p>
						<p class="mb-1 text-[26px] leading-none font-bold" style="color: var(--m-text);">
							{stat.value}
						</p>
						<p class="text-[11px]" style={`color: ${toneColors[stat.tone]};`}>{stat.subtitle}</p>
					</div>
				{/each}
			</div>

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
								style={`height: ${bar.pct}%; background: var(--m-accent); opacity: 0.85;`}
								aria-hidden="true"
							></div>
							<span class="text-[10px] uppercase" style="color: var(--m-text-3);">{bar.day}</span>
						</div>
					{/each}
				</div>

				<div class="mt-5 overflow-x-auto rounded-lg border" style="border-color: var(--m-border);">
					<table
						class="w-full min-w-[44rem] border-collapse text-left text-[12px]"
						style="border-color: var(--m-border);"
					>
						<caption class="sr-only">
							Sample sessions with expected signers, signed counts, completion rate, and status
						</caption>
						<thead>
							<tr
								class="text-[10px] tracking-wide uppercase"
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
									<td class="max-w-48 truncate px-4 py-3 font-medium" style="color: var(--m-text);"
										>{row.session}</td
									>
									<td class="px-4 py-3 whitespace-nowrap" style="color: var(--m-text-2);"
										>{row.date}</td
									>
									<td class="px-4 py-3 whitespace-nowrap" style="color: var(--m-text-2);"
										>{row.provider}</td
									>
									<td class="px-4 py-3 whitespace-nowrap" style="color: var(--m-text-2);"
										>{row.expected}</td
									>
									<td class="px-4 py-3 whitespace-nowrap" style="color: var(--m-text-2);"
										>{row.signed}</td
									>
									<td class="px-4 py-3 whitespace-nowrap" style="color: var(--m-text-2);"
										>{row.rate}</td
									>
									<td class="px-4 py-3">
										<span
											class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
											style={`color: ${toneColors[row.tone]}; background: ${sessionToneBackgrounds[row.tone]};`}
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
