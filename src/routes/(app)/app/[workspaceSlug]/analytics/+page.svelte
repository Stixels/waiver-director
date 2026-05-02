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
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger
	} from '$lib/components/ui/tooltip';
	import { Area, AreaChart, BarChart, ChartClipPath } from 'layerchart';
	import AnalyticsDateRangePicker from '$lib/components/dashboard/AnalyticsDateRangePicker.svelte';
	import { curveNatural } from 'd3-shape';
	import { scaleBand } from 'd3-scale';
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
		return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
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
	type AnalyticsComparison = AnalyticsData['comparisons']['submissions'];
	const analyticsData = $derived((analyticsQuery.data ?? null) as AnalyticsData | null);
	const analyticsError = $derived(analyticsQuery.error ?? null);
	const missingWorkspace = $derived(!appContext.isLoading && currentWorkspace == null);
	const analyticsUnavailable = $derived(Boolean(analyticsError) || missingWorkspace);
	const isInitialLoading = $derived(
		(analyticsQuery.isLoading || appContext.isLoading) && !analyticsData
	);

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

	// Period totals for chart headers
	const submissionsTotal = $derived(
		analyticsData?.submissionsByDay.reduce((sum, d) => sum + d.count, 0) ?? 0
	);
	const bookingsTotal = $derived(
		analyticsData?.bookingsByDay.reduce((sum, d) => sum + d.count, 0) ?? 0
	);
	const rangeDays = $derived(Math.round((rangeEndAt - rangeStartAt) / (24 * 60 * 60 * 1000)));

	const emailSent = $derived(analyticsData?.emailTotals.sent ?? 0);
	const emailQueued = $derived(analyticsData?.emailTotals.queued ?? 0);
	const emailFailed = $derived(analyticsData?.emailTotals.failed ?? 0);
	const emailBlocked = $derived(analyticsData?.emailTotals.blocked ?? 0);
	const emailActivityTotal = $derived(emailSent + emailQueued + emailFailed + emailBlocked);
	const emailStatusSegments = $derived([
		{
			label: 'Sent',
			value: emailSent,
			barClass: 'bg-primary',
			dotClass: 'bg-primary',
			textClass: 'text-muted-foreground'
		},
		{
			label: 'Queued',
			value: emailQueued,
			barClass: 'bg-primary/30',
			dotClass: 'bg-primary/30',
			textClass: 'text-muted-foreground'
		},
		{
			label: 'Failed',
			value: emailFailed,
			barClass: 'bg-destructive',
			dotClass: 'bg-destructive',
			textClass: emailFailed > 0 ? 'text-destructive' : 'text-muted-foreground'
		},
		{
			label: 'Blocked',
			value: emailBlocked,
			barClass: 'bg-amber-500',
			dotClass: 'bg-amber-500',
			textClass: emailBlocked > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
		}
	]);

	function shareStyle(value: number): string {
		return `width: ${emailActivityTotal > 0 ? (value / emailActivityTotal) * 100 : 0}%`;
	}

	function comparisonLabel(comparison: AnalyticsComparison | null | undefined) {
		if (!comparison) return 'No data';
		if (comparison.previousTotal === 0) {
			if (comparison.currentTotal === 0) return `0% vs prior ${rangeDays}d`;
			return `New vs prior ${rangeDays}d`;
		}
		const change = Math.round(
			((comparison.currentTotal - comparison.previousTotal) / comparison.previousTotal) * 100
		);
		return `${change > 0 ? '+' : ''}${change.toLocaleString()}% vs prior ${rangeDays}d`;
	}

	function comparisonTitle(comparison: AnalyticsComparison | null | undefined) {
		if (!comparison) return `No prior ${rangeDays}d comparison available`;
		return `${comparison.currentTotal.toLocaleString()} current ${rangeDays}d, ${comparison.previousTotal.toLocaleString()} prior ${rangeDays}d`;
	}
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
	{#if missingWorkspace}
		<div
			class="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
		>
			Workspace not found.
		</div>
	{:else if analyticsError}
		<div
			class="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive"
		>
			Unable to load analytics. Try refreshing the page.
		</div>
	{/if}

	<!-- Submissions + Bookings over time side by side -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<Card>
			<CardHeader class="flex flex-row items-start justify-between gap-2 pb-3">
				<div class="flex items-center gap-2">
					<TrendingUpIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<CardTitle class="text-base font-semibold">Submissions</CardTitle>
				</div>
				{#if !isInitialLoading && analyticsData}
					<div class="text-right">
						<p class="text-2xl font-bold tracking-tight tabular-nums">
							{submissionsTotal.toLocaleString()}
						</p>
						<p
							class="mt-0.5 text-[0.65rem] font-medium text-muted-foreground tabular-nums"
							title={comparisonTitle(analyticsData.comparisons.submissions)}
						>
							{comparisonLabel(analyticsData.comparisons.submissions)}
						</p>
					</div>
				{:else if isInitialLoading}
					<div class="space-y-1">
						<Skeleton class="h-7 w-12" />
						<Skeleton class="h-2.5 w-20" />
					</div>
				{/if}
			</CardHeader>
			<CardContent>
				{#if isInitialLoading}
					<Skeleton class="h-52 w-full" />
				{:else if analyticsUnavailable}
					<div class="flex h-52 items-center justify-center text-sm text-muted-foreground">
						Analytics unavailable
					</div>
				{:else if !analyticsData || analyticsData.submissionsByDay.every((d) => d.count === 0)}
					<div class="flex h-52 items-center justify-center text-sm text-muted-foreground">
						No submissions in this period
					</div>
				{:else}
					<ChartContainer config={submissionsConfig} class="h-52 w-full">
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
			<CardHeader class="flex flex-row items-start justify-between gap-2 pb-3">
				<div class="flex items-center gap-2">
					<CalendarCheckIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<CardTitle class="text-base font-semibold">Bookings</CardTitle>
				</div>
				{#if !isInitialLoading && analyticsData}
					<div class="text-right">
						<p class="text-2xl font-bold tracking-tight tabular-nums">
							{bookingsTotal.toLocaleString()}
						</p>
						<p
							class="mt-0.5 text-[0.65rem] font-medium text-muted-foreground tabular-nums"
							title={comparisonTitle(analyticsData.comparisons.bookings)}
						>
							{comparisonLabel(analyticsData.comparisons.bookings)}
						</p>
					</div>
				{:else if isInitialLoading}
					<div class="space-y-1">
						<Skeleton class="h-7 w-12" />
						<Skeleton class="h-2.5 w-20" />
					</div>
				{/if}
			</CardHeader>
			<CardContent>
				{#if isInitialLoading}
					<Skeleton class="h-52 w-full" />
				{:else if analyticsUnavailable}
					<div class="flex h-52 items-center justify-center text-sm text-muted-foreground">
						Analytics unavailable
					</div>
				{:else if !analyticsData || analyticsData.bookingsByDay.every((d) => d.count === 0)}
					<div class="flex h-52 items-center justify-center text-sm text-muted-foreground">
						No bookings in this period
					</div>
				{:else}
					<ChartContainer config={bookingsConfig} class="h-52 w-full">
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
		<!-- Email Activity card -->
		<Card class="flex flex-col">
			<CardHeader class="flex flex-row items-center gap-2 pb-2">
				<MailIcon class="size-4 text-muted-foreground" />
				<CardTitle class="text-base font-semibold">Email Activity</CardTitle>
			</CardHeader>
			<CardContent class="flex flex-1 flex-col">
				{#if isInitialLoading}
					<div class="space-y-3">
						<div class="space-y-2">
							<Skeleton class="h-8 w-16" />
							<Skeleton class="h-3.5 w-32" />
						</div>
						<Skeleton class="h-1.5 w-full rounded-full" />
						<div class="space-y-1.5">
							<Skeleton class="h-5 w-full" />
							<Skeleton class="h-5 w-full" />
							<Skeleton class="h-5 w-full" />
						</div>
					</div>
				{:else if analyticsUnavailable}
					<div
						class="flex min-h-52 flex-1 items-center justify-center text-sm text-muted-foreground"
					>
						Analytics unavailable
					</div>
				{:else}
					<div class="flex flex-1 flex-col gap-4">
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class="text-3xl font-bold tracking-tight tabular-nums">
									{emailSent.toLocaleString()}
								</p>
								<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
									<span class="size-2 rounded-full bg-primary"></span>
									<span>Sent</span>
								</p>
							</div>
							<div class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
								{emailActivityTotal.toLocaleString()} total
							</div>
						</div>

						<div class="space-y-1.5">
							<p class="text-xs font-medium text-muted-foreground">Status mix</p>
							<div
								class="flex h-2 overflow-hidden rounded-full bg-muted"
								aria-label="Email activity status mix"
							>
								<TooltipProvider delayDuration={150}>
									{#each emailStatusSegments.filter((segment) => segment.value > 0) as segment (segment.label)}
										<Tooltip>
											<TooltipTrigger
												class={`h-full min-w-2 ${segment.barClass}`}
												style={shareStyle(segment.value)}
												aria-label={`${segment.label}: ${segment.value.toLocaleString()}`}
											/>
											<TooltipContent side="top" sideOffset={6}>
												{segment.label}: {segment.value.toLocaleString()}
											</TooltipContent>
										</Tooltip>
									{/each}
								</TooltipProvider>
							</div>
						</div>

						<div class="divide-y divide-border/70 border-t border-border/70 text-sm">
							{#each emailStatusSegments.slice(1) as segment (segment.label)}
								<div class="flex items-center justify-between py-1.5">
									<div class={`flex items-center gap-2 ${segment.textClass}`}>
										<span class={`size-2 rounded-full ${segment.dotClass}`}></span>
										<span>{segment.label}</span>
									</div>
									<span class="font-semibold tabular-nums">{segment.value.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>

		<Card class="lg:col-span-2">
			<CardHeader class="flex flex-row items-start justify-between gap-2 pb-3">
				<div class="flex items-center gap-2">
					<UsersRoundIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<CardTitle class="text-base font-semibold">Customers by Day</CardTitle>
				</div>
				{#if !isInitialLoading && analyticsData && customerActivityTotal > 0}
					<div class="text-right">
						<p class="text-2xl font-bold tracking-tight tabular-nums">
							{customerActivityTotal.toLocaleString()}
						</p>
						<p
							class="mt-0.5 text-[0.65rem] font-medium text-muted-foreground tabular-nums"
							title={comparisonTitle(analyticsData.comparisons.customerActivity)}
						>
							{comparisonLabel(analyticsData.comparisons.customerActivity)}
						</p>
					</div>
				{:else if isInitialLoading}
					<div class="space-y-1">
						<Skeleton class="h-7 w-12" />
						<Skeleton class="h-2.5 w-20" />
					</div>
				{/if}
			</CardHeader>
			<CardContent>
				{#if isInitialLoading}
					<Skeleton class="h-52 w-full" />
				{:else if analyticsUnavailable}
					<div class="flex h-52 items-center justify-center text-sm text-muted-foreground">
						Analytics unavailable
					</div>
				{:else if !analyticsData || customerActivityTotal === 0}
					<div class="flex h-52 items-center justify-center text-sm text-muted-foreground">
						No customer activity in this period
					</div>
				{:else}
					<ChartContainer config={customersConfig} class="h-52 w-full">
						<BarChart
							data={analyticsData.customerActivityByDay}
							xScale={scaleBand().padding(0.25)}
							x="dayStartAt"
							axis="x"
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
							x1Scale={scaleBand().paddingInner(0).paddingOuter(0)}
							seriesLayout="group"
							rule={false}
							props={{
								bars: {
									stroke: 'none',
									strokeWidth: 0,
									rounded: 'all',
									motion: { type: 'tween', duration: 500, easing: cubicInOut }
								},
								highlight: { area: { fill: 'none' } },
								xAxis: { ticks: 7, format: formatAxisDate }
							}}
						>
							{#snippet tooltip()}
								<ChartTooltip labelFormatter={formatAxisDate} indicator="dashed" />
							{/snippet}
						</BarChart>
					</ChartContainer>
				{/if}
			</CardContent>
		</Card>
	</div>
</PageShell>
