<script lang="ts">
	import { ChartContainer, ChartTooltip, type ChartConfig } from '$lib/components/ui/chart';
	import { BarChart } from 'layerchart';
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

	const points = $derived(data ?? []);
	const hasSignal = $derived(points.some((point) => point.count > 0));
	const maxCount = $derived(Math.max(1, ...points.map((point) => point.count)));
	const chartConfig = $derived({
		count: { label, color }
	} satisfies ChartConfig);
	const emptyPoints = $derived(
		points.length > 0
			? points
			: Array.from({ length: 7 }, (_, index) => ({
					dayLabel: '',
					dayStartAt: index,
					count: 0
				}))
	);
	const yDomain = $derived([0, Math.ceil(maxCount * 1.15)]);
</script>

<div class="h-16 min-w-0" aria-label={`${label} trend for the last 7 days`}>
	{#if points.length > 1 && hasSignal}
		<ChartContainer config={chartConfig} class="h-full w-full overflow-visible">
			<BarChart
				data={points}
				x="dayLabel"
				axis="x"
				{yDomain}
				series={[{ key: 'count', label, color: 'var(--color-count)' }]}
				bandPadding={0.28}
				props={{
					bars: {
						stroke: 'none',
						rounded: 'top',
						radius: 3,
						motion: { type: 'tween', duration: 350, easing: cubicInOut }
					},
					highlight: { area: { fill: 'none' } },
					xAxis: { format: (day: string) => day },
					yAxis: { format: () => '' }
				}}
			>
				{#snippet tooltip()}
					<ChartTooltip />
				{/snippet}
			</BarChart>
		</ChartContainer>
	{:else}
		<div class="flex h-full flex-col justify-end gap-2">
			<div class="flex h-10 items-end gap-1.5">
				{#each emptyPoints as point (point.dayStartAt)}
					<div class="flex min-w-0 flex-1 items-end">
						<div class="h-px w-full rounded-full bg-muted"></div>
					</div>
				{/each}
			</div>
			<div
				class="grid grid-cols-7 gap-1.5 text-center text-[0.6rem] leading-none font-medium text-muted-foreground"
			>
				{#each emptyPoints as point (point.dayStartAt)}
					<span>{point.dayLabel}</span>
				{/each}
			</div>
		</div>
	{/if}
</div>
