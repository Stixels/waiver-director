<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { FunctionReturnType } from 'convex/server';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ChartContainer, ChartTooltip, type ChartConfig } from '$lib/components/ui/chart';
	import { Area, AreaChart, BarChart, ChartClipPath } from 'layerchart';
	import AnalyticsDateRangePicker from '$lib/components/dashboard/AnalyticsDateRangePicker.svelte';
	import { curveNatural } from 'd3-shape';
	import { cubicInOut } from 'svelte/easing';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import MailIcon from '@lucide/svelte/icons/mail';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	function toDateInputValue(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function dateFromInput(value: string): Date {
		const [y, mo, d] = value.split('-').map(Number);
		return new Date(y, mo - 1, d);
	}

	function defaultStartStr(): string {
		const now = new Date();
		return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
	}

	let startDateStr = $state(defaultStartStr());
	let endDateStr = $state(toDateInputValue(new Date()));

	const rangeStartAt = $derived(dateFromInput(startDateStr).getTime());
	const rangeEndAt = $derived(dateFromInput(endDateStr).getTime() + 24 * 60 * 60 * 1000);

	const analyticsQuery = useProtectedQuery(
		api.dashboard.getAnalyticsSeries,
		() =>
			currentWorkspace
				? {
						workspaceId: currentWorkspace.workspaceId,
						rangeStartAt,
						rangeEndAt
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);

	type AnalyticsData = FunctionReturnType<typeof api.dashboard.getAnalyticsSeries>;
	type CustomerActivityDay = AnalyticsData['customerActivityByDay'][number];
	const analyticsData = $derived((analyticsQuery.data ?? null) as AnalyticsData | null);
	const isInitialLoading = $derived(analyticsQuery.isLoading && !analyticsData);

	function handleRangeChange(start: string, end: string) {
		startDateStr = start;
		endDateStr = end;
	}

	function formatAxisDate(epochMs: number): string {
		return new Date(epochMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function paddedCountDomain(points: Array<{ count: number }> | undefined) {
		const maxValue = Math.max(1, ...(points ?? []).map((point) => point.count));
		return [0, Math.ceil(maxValue * 1.15)];
	}

	function paddedCustomerActivityDomain(
		points: Array<{ newCustomers: number; returningCustomers: number }> | undefined
	) {
		const maxValue = Math.max(
			1,
			...(points ?? []).map((point) => point.newCustomers + point.returningCustomers)
		);
		return [0, Math.ceil(maxValue * 1.15)];
	}

	// Chart configs
	const submissionsConfig: ChartConfig = {
		count: { label: 'Submissions', color: 'var(--color-primary)' }
	};
	const bookingsConfig: ChartConfig = {
		count: { label: 'Bookings', color: 'var(--color-primary)' }
	};
	const customersConfig: ChartConfig = {
		newCustomers: { label: 'New', color: 'oklch(0.627 0.194 149.21)' },
		returningCustomers: { label: 'Returning', color: 'var(--color-primary)' }
	};
	const submissionsGradientId = 'analytics-fill-submissions';
	const bookingsGradientId = 'analytics-fill-bookings';
	const submissionsYDomain = $derived(paddedCountDomain(analyticsData?.submissionsByDay));
	const bookingsYDomain = $derived(paddedCountDomain(analyticsData?.bookingsByDay));
	const customerActivityYDomain = $derived(
		paddedCustomerActivityDomain(analyticsData?.customerActivityByDay)
	);
	const customerActivityTotal = $derived(
		analyticsData?.customerActivityByDay.reduce(
			(total: number, day: CustomerActivityDay) =>
				total + day.newCustomers + day.returningCustomers,
			0
		) ?? 0
	);
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Analytics | Waiver Director</title>
</svelte:head>

<PageHeader title="Analytics" subtitle="Trends, completion rates, and email performance">
	{#snippet actions()}
		<AnalyticsDateRangePicker
			startDate={startDateStr}
			endDate={endDateStr}
			onchange={handleRangeChange}
		/>
	{/snippet}
</PageHeader>

<PageShell>
	<!-- Submissions + Bookings over time side by side -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<Card>
			<CardHeader class="flex flex-row items-center gap-2 pb-3">
				<TrendingUpIcon class="size-4 text-muted-foreground" />
				<CardTitle class="text-base font-semibold">Submissions Over Time</CardTitle>
			</CardHeader>
			<CardContent>
				{#if isInitialLoading}
					<Skeleton class="h-56 w-full" />
				{:else if !analyticsData || analyticsData.submissionsByDay.every((d) => d.count === 0)}
					<div class="flex h-56 items-center justify-center text-sm text-muted-foreground">
						No submissions in this period
					</div>
				{:else}
					<ChartContainer config={submissionsConfig} class="h-56 w-full">
						<AreaChart
							data={analyticsData.submissionsByDay}
							x="dayStartAt"
							y="count"
							yDomain={submissionsYDomain}
							series={[{ key: 'count', label: 'Submissions', color: 'var(--color-primary)' }]}
							props={{ xAxis: { ticks: 7, format: formatAxisDate } }}
						>
							{#snippet marks({ context })}
								<defs>
									<linearGradient id={submissionsGradientId} x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stop-color="var(--color-count)" stop-opacity="0.42" />
										<stop offset="95%" stop-color="var(--color-count)" stop-opacity="0.06" />
									</linearGradient>
								</defs>
								<ChartClipPath
									initialWidth={0}
									motion={{ width: { type: 'tween', duration: 800, easing: cubicInOut } }}
								>
									{#each context.series.visibleSeries as s (s.key)}
										<Area
											seriesKey={s.key}
											curve={curveNatural}
											fill={`url(#${submissionsGradientId})`}
											line={{ class: 'stroke-1.5' }}
											motion="tween"
											{...s.props}
										/>
									{/each}
								</ChartClipPath>
							{/snippet}
							{#snippet tooltip()}
								<ChartTooltip labelFormatter={formatAxisDate} />
							{/snippet}
						</AreaChart>
					</ChartContainer>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center gap-2 pb-3">
				<CalendarCheckIcon class="size-4 text-muted-foreground" />
				<CardTitle class="text-base font-semibold">Bookings Over Time</CardTitle>
			</CardHeader>
			<CardContent>
				{#if isInitialLoading}
					<Skeleton class="h-56 w-full" />
				{:else if !analyticsData || analyticsData.bookingsByDay.every((d) => d.count === 0)}
					<div class="flex h-56 items-center justify-center text-sm text-muted-foreground">
						No bookings in this period
					</div>
				{:else}
					<ChartContainer config={bookingsConfig} class="h-56 w-full">
						<AreaChart
							data={analyticsData.bookingsByDay}
							x="dayStartAt"
							y="count"
							yDomain={bookingsYDomain}
							series={[{ key: 'count', label: 'Bookings', color: 'var(--color-primary)' }]}
							props={{ xAxis: { ticks: 7, format: formatAxisDate } }}
						>
							{#snippet marks({ context })}
								<defs>
									<linearGradient id={bookingsGradientId} x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stop-color="var(--color-count)" stop-opacity="0.42" />
										<stop offset="95%" stop-color="var(--color-count)" stop-opacity="0.06" />
									</linearGradient>
								</defs>
								<ChartClipPath
									initialWidth={0}
									motion={{ width: { type: 'tween', duration: 800, easing: cubicInOut } }}
								>
									{#each context.series.visibleSeries as s (s.key)}
										<Area
											seriesKey={s.key}
											curve={curveNatural}
											fill={`url(#${bookingsGradientId})`}
											line={{ class: 'stroke-1.5' }}
											motion="tween"
											{...s.props}
										/>
									{/each}
								</ChartClipPath>
							{/snippet}
							{#snippet tooltip()}
								<ChartTooltip labelFormatter={formatAxisDate} />
							{/snippet}
						</AreaChart>
					</ChartContainer>
				{/if}
			</CardContent>
		</Card>
	</div>

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
		<Card class="flex min-h-56 flex-col">
			<CardHeader class="flex flex-row items-center gap-2 pb-3">
				<MailIcon class="size-4 text-muted-foreground" />
				<CardTitle class="text-base font-semibold">Emails Sent</CardTitle>
			</CardHeader>
			<CardContent class="flex flex-1 flex-col justify-between">
				{#if isInitialLoading}
					<div class="space-y-3">
						<Skeleton class="h-10 w-24" />
						<Skeleton class="h-4 w-40" />
					</div>
				{:else}
					<div>
						<p class="text-4xl font-bold tracking-tight tabular-nums">
							{(analyticsData?.emailTotals.sent ?? 0).toLocaleString()}
						</p>
						<p class="mt-2 text-sm text-muted-foreground">Sent follow-up emails</p>
					</div>
					<div class="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
						Selected date range
					</div>
				{/if}
			</CardContent>
		</Card>

		<Card class="lg:col-span-2">
			<CardHeader class="flex flex-row items-center gap-2 pb-3">
				<UsersRoundIcon class="size-4 text-muted-foreground" />
				<CardTitle class="text-base font-semibold">Customers by Day</CardTitle>
			</CardHeader>
			<CardContent>
				{#if isInitialLoading}
					<Skeleton class="h-56 w-full" />
				{:else if !analyticsData || customerActivityTotal === 0}
					<div class="flex h-56 items-center justify-center text-sm text-muted-foreground">
						No customer activity in this period
					</div>
				{:else}
					<ChartContainer config={customersConfig} class="h-56 w-full">
						<BarChart
							data={analyticsData.customerActivityByDay}
							x="dayStartAt"
							yDomain={customerActivityYDomain}
							series={[
								{
									key: 'newCustomers',
									label: 'New',
									color: 'var(--color-newCustomers)'
								},
								{
									key: 'returningCustomers',
									label: 'Returning',
									color: 'var(--color-returningCustomers)'
								}
							]}
							seriesLayout="stack"
							bandPadding={0.32}
							props={{ xAxis: { ticks: 7, format: formatAxisDate } }}
						>
							{#snippet tooltip()}
								<ChartTooltip labelFormatter={formatAxisDate} />
							{/snippet}
						</BarChart>
					</ChartContainer>
				{/if}
			</CardContent>
		</Card>
	</div>
</PageShell>
