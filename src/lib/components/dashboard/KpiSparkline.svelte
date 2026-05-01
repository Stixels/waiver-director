<script lang="ts">
	import { ChartContainer, type ChartConfig } from '$lib/components/ui/chart';
	import { Area, AreaChart, ChartClipPath } from 'layerchart';
	import { curveNatural } from 'd3-shape';
	import { cubicInOut } from 'svelte/easing';

	type TrendPoint = { dayLabel: string; dayStartAt: number; count: number };

	let {
		data = [],
		label,
		color
	}: {
		data?: TrendPoint[] | null;
		label: string;
		color: string;
	} = $props();

	const uid = $props.id();
	const gradientId = $derived(`kpi-sparkline-${uid.replace(/:/g, '')}`);
	const points = $derived(data ?? []);
	const hasSignal = $derived(points.some((point) => point.count > 0));
	const maxCount = $derived(Math.max(1, ...points.map((point) => point.count)));
	const yDomain = $derived([0, Math.ceil(maxCount * 1.25)]);
	const chartConfig = $derived.by(
		(): ChartConfig => ({
			count: { label, color }
		})
	);
</script>

<div class="h-12 min-w-0" aria-hidden="true">
	{#if points.length > 1 && hasSignal}
		<ChartContainer config={chartConfig} class="h-full w-full justify-start overflow-visible">
			<AreaChart
				data={points}
				x="dayStartAt"
				y="count"
				{yDomain}
				axis={false}
				grid={false}
				rule={false}
				highlight={false}
				tooltipContext={false}
				series={[{ key: 'count', label, color }]}
			>
				{#snippet marks({ context })}
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stop-color={color} stop-opacity="0.32" />
							<stop offset="100%" stop-color={color} stop-opacity="0.03" />
						</linearGradient>
					</defs>
					<ChartClipPath
						initialWidth={0}
						motion={{ width: { type: 'tween', duration: 700, easing: cubicInOut } }}
					>
						{#each context.series.visibleSeries as s (s.key)}
							<Area
								seriesKey={s.key}
								curve={curveNatural}
								fill={`url(#${gradientId})`}
								line={{ class: 'stroke-1.5' }}
								motion="tween"
								{...s.props}
							/>
						{/each}
					</ChartClipPath>
				{/snippet}
			</AreaChart>
		</ChartContainer>
	{:else}
		<div class="flex h-full items-center">
			<div class="h-px w-full bg-muted"></div>
		</div>
	{/if}
</div>
