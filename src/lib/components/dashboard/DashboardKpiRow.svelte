<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
	import MailIcon from '@lucide/svelte/icons/mail';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';
	import KpiSparkline from './KpiSparkline.svelte';

	type Kpi = {
		bookingsToday: number;
		submissionsToday: number;
		followUpsSent: number;
		newCustomersToday: number;
	};

	type TrendDay = { dayLabel: string; dayStartAt: number; count: number };

	type KpiTrends = {
		bookingsToday: TrendDay[];
		submissionsToday: TrendDay[];
		followUpsSent: TrendDay[];
		newCustomersToday: TrendDay[];
	};

	type KpiComparison = { currentTotal: number; previousTotal: number };

	type KpiComparisons = {
		bookingsToday: KpiComparison;
		submissionsToday: KpiComparison;
		followUpsSent: KpiComparison;
		newCustomersToday: KpiComparison;
	};

	let {
		kpi,
		trends,
		comparisons,
		isLoading
	}: {
		kpi: Kpi | null | undefined;
		trends: KpiTrends | null | undefined;
		comparisons: KpiComparisons | null | undefined;
		isLoading: boolean;
	} = $props();

	const stats = $derived([
		{
			label: 'Bookings Today',
			trendLabel: 'Bookings',
			value: kpi?.bookingsToday ?? 0,
			icon: CalendarCheckIcon,
			trend: trends?.bookingsToday,
			comparison: comparisons?.bookingsToday,
			color: 'var(--color-primary)',
			bgStyle: 'color-mix(in oklch, var(--color-primary) 12%, transparent)'
		},
		{
			label: 'Submissions Today',
			trendLabel: 'Submissions',
			value: kpi?.submissionsToday ?? 0,
			icon: ScrollTextIcon,
			trend: trends?.submissionsToday,
			comparison: comparisons?.submissionsToday,
			color: 'oklch(0.627 0.194 149.21)',
			bgStyle: 'color-mix(in oklch, oklch(0.627 0.194 149.21) 12%, transparent)'
		},
		{
			label: 'Follow-ups Sent',
			trendLabel: 'Follow-ups sent',
			value: kpi?.followUpsSent ?? 0,
			icon: MailIcon,
			trend: trends?.followUpsSent,
			comparison: comparisons?.followUpsSent,
			color: 'oklch(0.7 0.15 60)',
			bgStyle: 'color-mix(in oklch, oklch(0.7 0.15 60) 12%, transparent)'
		},
		{
			label: 'New Customers',
			trendLabel: 'New customers',
			value: kpi?.newCustomersToday ?? 0,
			icon: UsersRoundIcon,
			trend: trends?.newCustomersToday,
			comparison: comparisons?.newCustomersToday,
			color: 'oklch(0.58 0.18 255)',
			bgStyle: 'color-mix(in oklch, oklch(0.58 0.18 255) 12%, transparent)'
		}
	]);

	function trendTotal(trend: TrendDay[] | null | undefined) {
		return trend?.reduce((total, point) => total + point.count, 0) ?? 0;
	}

	function formatCappedCount(value: number) {
		return value > 1000 ? '1000+' : value.toLocaleString();
	}

	function comparisonLabel(comparison: KpiComparison | null | undefined) {
		if (!comparison) return 'No data';
		if (comparison.previousTotal === 0) {
			if (comparison.currentTotal === 0) return '0% this week';
			return 'New this week';
		}
		const change = Math.round(
			((comparison.currentTotal - comparison.previousTotal) / comparison.previousTotal) * 100
		);
		return `${change > 0 ? '+' : ''}${change.toLocaleString()}% this week`;
	}

	function comparisonTitle(comparison: KpiComparison | null | undefined) {
		if (!comparison) return 'No prior-week comparison available';
		return `${comparison.currentTotal.toLocaleString()} this week, ${comparison.previousTotal.toLocaleString()} prior week`;
	}
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
	{#each stats as stat (stat.label)}
		<Card class="min-h-36 overflow-visible">
			<CardContent class="flex h-full flex-col justify-between p-4">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="truncate text-xs font-medium text-muted-foreground">{stat.label}</p>
						{#if isLoading && kpi == null}
							<Skeleton class="mt-2 h-8 w-16" />
						{:else}
							<p class="mt-1 text-3xl font-bold tracking-tight tabular-nums">
								{formatCappedCount(stat.value)}
							</p>
						{/if}
					</div>
					<div
						class="ml-3 shrink-0 rounded-lg p-2.5"
						style="color: {stat.color}; background: {stat.bgStyle};"
					>
						{#if isLoading && kpi == null}
							<Skeleton class="size-5 rounded-sm bg-current/15" />
						{:else}
							<stat.icon class="size-5" />
						{/if}
					</div>
				</div>
				<div class="mt-3 space-y-2">
					{#if isLoading && trends == null}
						<Skeleton class="h-16 w-full" />
					{:else}
						<KpiSparkline data={stat.trend} label={stat.trendLabel} color={stat.color} />
					{/if}
					<div class="flex min-w-0 items-center justify-between gap-2 text-[0.68rem] leading-none">
						<div class="min-w-0">
							{#if isLoading && trends == null}
								<Skeleton class="h-2.5 w-16" />
								<Skeleton class="mt-1 h-3 w-12" />
							{:else}
								<p class="font-medium text-muted-foreground">Last 7 days</p>
								<p class="mt-1 font-semibold text-foreground tabular-nums">
									{trendTotal(stat.trend).toLocaleString()} total
								</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center tabular-nums">
							{#if isLoading && comparisons == null}
								<Skeleton class="h-2.5 w-20" />
							{:else}
								<span
									class="text-[0.65rem] font-medium text-muted-foreground"
									title={comparisonTitle(stat.comparison)}
								>
									{comparisonLabel(stat.comparison)}
								</span>
							{/if}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	{/each}
</div>
