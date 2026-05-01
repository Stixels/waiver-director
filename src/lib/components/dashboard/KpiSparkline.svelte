<script lang="ts">
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
	const emptyPoints = $derived(
		points.length > 0
			? points
			: Array.from({ length: 7 }, (_, index) => ({
					dayLabel: '',
					dayStartAt: index,
					count: 0
				}))
	);
	const barPoints = $derived(
		points.map((point) => ({
			...point,
			height:
				point.count > 0 ? `${Math.max(10, Math.round((point.count / maxCount) * 100))}%` : '1px',
			backgroundColor: point.count > 0 ? color : 'var(--color-muted)',
			isToday: point.dayStartAt === points.at(-1)?.dayStartAt
		}))
	);
</script>

<div class="h-16 min-w-0" aria-label={`${label} trend for the last 7 days`}>
	{#if points.length > 1 && hasSignal}
		<div class="flex h-full items-end gap-1.5">
			{#each barPoints as point (point.dayStartAt)}
				<div
					class="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
					title={`${point.dayLabel}: ${point.count.toLocaleString()}`}
				>
					<div class="flex min-h-0 flex-1 items-end">
						<div
							class="w-full rounded-t-sm transition-[height] duration-300"
							class:opacity-100={point.isToday}
							class:opacity-55={!point.isToday}
							style="height: {point.height}; background-color: {point.backgroundColor};"
						></div>
					</div>
					<span
						class="truncate text-center text-[0.6rem] leading-none font-medium tabular-nums {point.isToday
							? 'text-foreground'
							: 'text-muted-foreground'}"
					>
						{point.dayLabel}
					</span>
				</div>
			{/each}
		</div>
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
