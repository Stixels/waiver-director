<script lang="ts">
	import { CalendarCheck, Mail, TrendingUp, Users } from '@lucide/svelte';

	// The analytics report as the app lays it out: two trend panels across the
	// top, delivery mix and customer split beneath. Every figure reconciles — each
	// daily series sums to its own total, and the four email states sum to the 192
	// the panel claims.
	const submissions = { total: 192, delta: '+13%', peak: 44, series: [26, 31, 29, 40, 22, 16, 28] };
	const bookings = { total: 37, delta: '0%', peak: 8, series: [5, 6, 5, 7, 4, 4, 6] };

	const customers = {
		total: 192,
		delta: '+14%',
		peak: 20,
		days: [
			{ label: 'Aug 18', fresh: 12, returning: 14 },
			{ label: 'Aug 19', fresh: 13, returning: 16 },
			{ label: 'Aug 20', fresh: 11, returning: 15 },
			{ label: 'Aug 21', fresh: 14, returning: 17 },
			{ label: 'Aug 22', fresh: 15, returning: 19 },
			{ label: 'Aug 23', fresh: 8, returning: 10 },
			{ label: 'Aug 24', fresh: 14, returning: 14 }
		]
	};

	const email = {
		total: 192,
		states: [
			{ label: 'Sent', count: 151, tone: 'sent' },
			{ label: 'Queued', count: 29, tone: 'queued' },
			{ label: 'Failed', count: 4, tone: 'failed' },
			{ label: 'Blocked', count: 8, tone: 'blocked' }
		]
	} as const;

	const ticks = ['Aug 18', 'Aug 21', 'Aug 24'] as const;

	const CHART_W = 320;
	const CHART_H = 78;

	// Catmull-Rom through every point, converted to cubic segments. The app's own
	// trend panels are curved, and a straight polyline beside them would read as a
	// different product.
	function curve(series: readonly number[], peak: number) {
		const step = CHART_W / (series.length - 1);
		const points = series.map((value, i) => [i * step, CHART_H - (value / peak) * CHART_H]);
		let d = `M ${points[0][0]} ${points[0][1]}`;
		for (let i = 0; i < points.length - 1; i += 1) {
			const p0 = points[i - 1] ?? points[i];
			const p1 = points[i];
			const p2 = points[i + 1];
			const p3 = points[i + 2] ?? p2;
			const c1x = p1[0] + (p2[0] - p0[0]) / 6;
			const c1y = p1[1] + (p2[1] - p0[1]) / 6;
			const c2x = p2[0] - (p3[0] - p1[0]) / 6;
			const c2y = p2[1] - (p3[1] - p1[1]) / 6;
			d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
		}
		return d;
	}

	const trends = [
		{
			key: 'submissions',
			icon: TrendingUp,
			name: 'Submissions',
			data: submissions,
			line: curve(submissions.series, submissions.peak)
		},
		{
			key: 'bookings',
			icon: CalendarCheck,
			name: 'Bookings',
			data: bookings,
			line: curve(bookings.series, bookings.peak)
		}
	] as const;

	const area = (line: string) => `${line} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Ending Aug 24, 2026</span>
		<span class="an__range">
			<em class="is-on">7d</em>
			<em>30d</em>
		</span>
	</div>

	<div class="mkt-vig__body an">
		{#each trends as panel (panel.key)}
			{@const Icon = panel.icon}
			<section class="an__panel">
				<header class="an__phead">
					<span class="an__pname"><Icon size={13} aria-hidden="true" />{panel.name}</span>
					<span class="an__pfig">
						<b>{panel.data.total}</b>
						<em class:is-flat={panel.data.delta === '0%'}>{panel.data.delta} vs prior 7d</em>
					</span>
				</header>

				<svg
					class="an__chart"
					viewBox="0 0 {CHART_W} {CHART_H}"
					preserveAspectRatio="none"
					role="img"
					aria-label="{panel.name} across the last seven days, totalling {panel.data.total}"
				>
					<defs>
						<linearGradient id="an-fill-{panel.key}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="oklch(0.63 0.22 280)" stop-opacity="0.42" />
							<stop offset="100%" stop-color="oklch(0.63 0.22 280)" stop-opacity="0.02" />
						</linearGradient>
					</defs>
					<line x1="0" y1={CHART_H / 2} x2={CHART_W} y2={CHART_H / 2} class="an__grid" />
					<path d={area(panel.line)} fill="url(#an-fill-{panel.key})" />
					<path d={panel.line} class="an__line" />
				</svg>

				<span class="an__ticks">
					{#each ticks as tick (tick)}<em>{tick}</em>{/each}
				</span>
			</section>
		{/each}

		<section class="an__panel">
			<header class="an__phead">
				<span class="an__pname"><Mail size={13} aria-hidden="true" />Email activity</span>
				<span class="an__pfig"><b>{email.total}</b><em class="is-flat">total</em></span>
			</header>

			<span class="an__mix" aria-hidden="true">
				{#each email.states as state (state.label)}
					<i data-tone={state.tone} style="flex: {state.count}"></i>
				{/each}
			</span>

			<dl class="an__states">
				{#each email.states as state (state.label)}
					<div>
						<dt><i data-tone={state.tone} aria-hidden="true"></i>{state.label}</dt>
						<dd>{state.count}</dd>
					</div>
				{/each}
			</dl>
		</section>

		<section class="an__panel">
			<header class="an__phead">
				<span class="an__pname"><Users size={13} aria-hidden="true" />Customers by day</span>
				<span class="an__pfig">
					<b>{customers.total}</b>
					<em>{customers.delta} vs prior 7d</em>
				</span>
			</header>

			<div
				class="an__days"
				role="img"
				aria-label="New and returning customers per day: 87 new and 105 returning across the range"
			>
				{#each customers.days as day (day.label)}
					<span class="an__pair">
						<i class="is-fresh" style="height: {(day.fresh / customers.peak) * 100}%"></i>
						<i class="is-returning" style="height: {(day.returning / customers.peak) * 100}%"></i>
					</span>
				{/each}
			</div>

			<span class="an__legend">
				<em><i class="is-fresh"></i>New</em>
				<em><i class="is-returning"></i>Returning</em>
			</span>
		</section>
	</div>
</div>

<style>
	.an__range {
		display: inline-flex;
		flex: 0 0 auto;
		gap: 2px;
		padding: 2px;
		border-radius: 7px;
		border: 1px solid var(--m-border-soft);
		background: var(--m-surface);
	}

	.an__range em {
		font-style: normal;
		padding: 0.1rem 0.42rem;
		border-radius: 5px;
		font-size: 0.66rem;
		font-weight: 650;
		color: var(--m-text-3);
	}

	.an__range em.is-on {
		color: oklch(0.99 0 0);
		background: var(--m-accent);
	}

	.an {
		display: grid;
		gap: 0.7rem;
	}

	@media (min-width: 34rem) {
		.an {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.an__panel {
		display: grid;
		gap: 0.55rem;
		align-content: start;
		min-width: 0;
		padding: 0.7rem 0.8rem 0.75rem;
		border-radius: 10px;
		border: 1px solid var(--m-border-soft);
		background: var(--m-surface);
	}

	.an__phead {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.an__pname {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		font-size: 0.74rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--m-text-1);
	}

	.an__pfig {
		display: grid;
		justify-items: end;
		gap: 0.05rem;
		flex: 0 0 auto;
		text-align: right;
	}

	.an__pfig b {
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: -0.035em;
		color: var(--m-text-1);
		font-variant-numeric: tabular-nums;
	}

	.an__pfig em {
		font-style: normal;
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--m-green);
		white-space: nowrap;
	}

	.an__pfig em.is-flat {
		color: var(--m-text-3);
	}

	.an__chart {
		display: block;
		width: 100%;
		height: 4.6rem;
	}

	.an__grid {
		stroke: oklch(1 0 0 / 8%);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.an__line {
		fill: none;
		stroke: oklch(0.68 0.2 280);
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.an__ticks {
		display: flex;
		justify-content: space-between;
	}

	.an__ticks em,
	.an__legend em {
		font-style: normal;
		font-size: 0.6rem;
		color: var(--m-text-3);
	}

	/* The delivery states share one bar before they are listed, so the shape of
	   the mix registers before any single number does. */
	.an__mix {
		display: flex;
		gap: 2px;
		height: 0.42rem;
		margin-top: 0.15rem;
	}

	.an__mix i,
	.an__states i {
		border-radius: 999px;
	}

	[data-tone='sent'] {
		background: var(--m-accent);
	}

	[data-tone='queued'] {
		background: oklch(0.52 0.22 277 / 45%);
	}

	[data-tone='failed'] {
		background: oklch(0.7 0.19 22);
	}

	[data-tone='blocked'] {
		background: var(--m-amber);
	}

	.an__states {
		display: grid;
	}

	.an__states div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.32rem 0;
		border-bottom: 1px solid var(--m-border-soft);
	}

	.an__states div:last-child {
		border-bottom: none;
	}

	.an__states dt {
		display: inline-flex;
		align-items: center;
		gap: 0.42rem;
		font-size: 0.72rem;
		color: var(--m-text-2);
	}

	.an__states dt i {
		width: 6px;
		height: 6px;
		flex: 0 0 auto;
	}

	.an__states dd {
		font-size: 0.72rem;
		font-weight: 650;
		color: var(--m-text-1);
		font-variant-numeric: tabular-nums;
	}

	.an__days {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: 0.3rem;
		height: 4.6rem;
	}

	.an__pair {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		height: 100%;
	}

	.an__pair i {
		width: 42%;
		border-radius: 3px 3px 0 0;
	}

	i.is-fresh {
		background: var(--m-green);
	}

	i.is-returning {
		background: var(--m-accent);
	}

	.an__legend {
		display: flex;
		gap: 0.85rem;
	}

	.an__legend em {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.an__legend i {
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}
</style>
