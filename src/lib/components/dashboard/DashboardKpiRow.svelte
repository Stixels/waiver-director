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
		followUpsQueued: number;
		totalCustomers: number;
	};

	type TrendDay = { dayLabel: string; dayStartAt: number; count: number };

	type KpiTrends = {
		bookingsToday: TrendDay[];
		submissionsToday: TrendDay[];
		followUpsQueued: TrendDay[];
		totalCustomers: TrendDay[];
	};

	let {
		kpi,
		trends,
		isLoading
	}: { kpi: Kpi | null | undefined; trends: KpiTrends | null | undefined; isLoading: boolean } =
		$props();

	const stats = $derived([
		{
			label: 'Bookings Today',
			value: kpi?.bookingsToday ?? 0,
			icon: CalendarCheckIcon,
			trend: trends?.bookingsToday,
			color: 'var(--color-primary)',
			bgStyle: 'color-mix(in oklch, var(--color-primary) 12%, transparent)'
		},
		{
			label: 'Submissions Today',
			value: kpi?.submissionsToday ?? 0,
			icon: ScrollTextIcon,
			trend: trends?.submissionsToday,
			color: 'oklch(0.627 0.194 149.21)',
			bgStyle: 'color-mix(in oklch, oklch(0.627 0.194 149.21) 12%, transparent)'
		},
		{
			label: 'Follow-ups Queued',
			value: kpi?.followUpsQueued ?? 0,
			icon: MailIcon,
			trend: trends?.followUpsQueued,
			color: 'oklch(0.7 0.15 60)',
			bgStyle: 'color-mix(in oklch, oklch(0.7 0.15 60) 12%, transparent)'
		},
		{
			label: 'Total Customers',
			value: kpi?.totalCustomers ?? 0,
			icon: UsersRoundIcon,
			trend: trends?.totalCustomers,
			color: 'oklch(0.58 0.18 255)',
			bgStyle: 'color-mix(in oklch, oklch(0.58 0.18 255) 12%, transparent)'
		}
	]);

	function trendTotal(trend: TrendDay[] | null | undefined) {
		return trend?.reduce((total, point) => total + point.count, 0) ?? 0;
	}
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
	{#each stats as stat (stat.label)}
		<Card class="min-h-36 overflow-hidden">
			<CardContent class="flex h-full flex-col justify-between p-4">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="truncate text-xs font-medium text-muted-foreground">{stat.label}</p>
						{#if isLoading && kpi == null}
							<Skeleton class="mt-2 h-8 w-16" />
						{:else}
							<p class="mt-1 text-3xl font-bold tracking-tight tabular-nums">
								{stat.value.toLocaleString()}
							</p>
						{/if}
					</div>
					<div
						class="ml-3 shrink-0 rounded-lg p-2.5"
						style="color: {stat.color}; background: {stat.bgStyle};"
					>
						<stat.icon class="size-5" />
					</div>
				</div>
				<div class="mt-2 space-y-1.5">
					{#if isLoading && trends == null}
						<Skeleton class="h-12 w-full" />
					{:else}
						<KpiSparkline data={stat.trend} label={stat.label} color={stat.color} />
					{/if}
					<div class="flex min-w-0 items-center justify-end text-xs">
						<div
							class="flex h-5 shrink-0 items-center gap-1 rounded-md border border-border px-1.5 text-[0.65rem]"
						>
							<span class="font-semibold tabular-nums text-foreground">
								{trendTotal(stat.trend).toLocaleString()}
							</span>
							<span class="text-muted-foreground">/ 7d</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	{/each}
</div>
