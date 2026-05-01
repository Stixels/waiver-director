<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import type { FunctionReturnType } from 'convex/server';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import CalendarOffIcon from '@lucide/svelte/icons/calendar-off';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	let {
		workspaceId,
		todayStartAt,
		todayEndAt
	}: {
		workspaceId: Id<'workspaces'>;
		todayStartAt: number;
		todayEndAt: number;
	} = $props();

	const workspaceSlug = $derived(page.params.workspaceSlug);
	const skeletonRows = [0, 1, 2, 3, 4, 5];

	let now = $state(Date.now());
	onMount(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 30_000);
		return () => clearInterval(interval);
	});

	const bookingsQuery = useProtectedQuery(
		api.bookings.listWorkspaceBookings,
		() => ({
			workspaceId,
			dayStartAt: todayStartAt,
			dayEndAt: todayEndAt,
			pageIndex: 0,
			pageSize: 24,
			searchQuery: '',
			hideDone: true,
			statusFilter: 'all' as const
		}),
		() => ({ keepPreviousData: true })
	);

	const submissionsQuery = useProtectedQuery(
		api.waivers.listRecentSubmissions,
		() => ({
			workspaceId,
			paginationOpts: { numItems: 24, cursor: null }
		}),
		() => ({ keepPreviousData: true })
	);

	type BookingPage = FunctionReturnType<typeof api.bookings.listWorkspaceBookings>;
	type Booking = BookingPage['bookings'][number];
	type SubmissionPage = FunctionReturnType<typeof api.waivers.listRecentSubmissions>;

	const bookingPage = $derived((bookingsQuery.data ?? null) as BookingPage | null);
	const bookings = $derived(bookingPage?.bookings ?? []);
	const bookingsInitialLoading = $derived(bookingsQuery.isLoading && !bookingPage);

	const submissionPage = $derived((submissionsQuery.data ?? null) as SubmissionPage | null);
	const submissions = $derived(submissionPage?.submissions ?? []);
	const submissionsInitialLoading = $derived(submissionsQuery.isLoading && !submissionPage);

	type TimeStatus = { label: string; tone: 'now' | 'soon' | 'past' };

	function timeStatus(booking: Booking): TimeStatus | null {
		if (!booking.startTime) return null;
		const startAt = Date.parse(booking.startTime);
		if (Number.isNaN(startAt)) return null;
		const endAt = booking.endTime ? Date.parse(booking.endTime) : startAt + 60 * 60 * 1000;
		const diffMs = startAt - now;
		const diffMinutes = Math.round(diffMs / 60_000);
		if (now >= startAt && now <= endAt) return { label: 'Now', tone: 'now' };
		if (now > endAt) return { label: 'Done', tone: 'past' };
		if (diffMinutes <= 60) return { label: `In ${diffMinutes}m`, tone: 'soon' };
		return null;
	}

	function timeStatusClass(tone: TimeStatus['tone']) {
		if (tone === 'now') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
		if (tone === 'soon') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
		return 'bg-muted/60 text-muted-foreground/70';
	}

	function formatTime(timestamp: string | null) {
		if (!timestamp) return null;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
	}

	function completionPercent(booking: Booking): number {
		if (booking.participantCount === 0) return 0;
		return Math.min(100, Math.round((booking.signedCount / booking.participantCount) * 100));
	}

	function formatSubmittedAt(submittedAt: number): string {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			month: 'short',
			day: 'numeric'
		}).format(new Date(submittedAt));
	}
</script>

<div class="grid gap-4 lg:grid-cols-2">
	<Card class="flex h-[420px] flex-col overflow-hidden md:h-[520px]">
		<CardHeader class="flex flex-row items-center justify-between border-b py-4">
			<div class="flex items-center gap-2">
				<CalendarCheckIcon class="size-4 text-muted-foreground" />
				<CardTitle class="text-base font-semibold">Upcoming Bookings</CardTitle>
			</div>
			<a
				href={resolve(`/app/${workspaceSlug}/bookings` as `/app/${string}/bookings`)}
				class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				View all
				<ExternalLinkIcon class="size-3" />
			</a>
		</CardHeader>
		<CardContent class="min-h-0 flex-1 overflow-auto p-0">
			{#if bookingsInitialLoading}
				<div class="divide-y divide-border">
					{#each skeletonRows as row (row)}
						<div class="flex items-center gap-4 px-5 py-4">
							<Skeleton class="h-4 w-12 shrink-0" />
							<div class="flex-1 space-y-2">
								<Skeleton class="h-4 w-40" />
								<Skeleton class="h-3 w-28" />
							</div>
							<Skeleton class="h-4 w-16 shrink-0" />
						</div>
					{/each}
				</div>
			{:else if bookings.length === 0}
				<div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
					<div
						class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
					>
						<CalendarOffIcon class="size-5" />
					</div>
					<p class="text-sm text-muted-foreground">No upcoming bookings today</p>
				</div>
			{:else}
				<div class="divide-y divide-border">
					{#each bookings as booking (booking.bookingId)}
						{@const status = timeStatus(booking)}
						{@const pct = completionPercent(booking)}
						{@const isCanceled = booking.status === 'canceled'}
						<a
							href={resolve(`/app/${workspaceSlug}/bookings` as `/app/${string}/bookings`)}
							class="flex w-full items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
						>
							<div class="w-14 shrink-0">
								<p
									class={cn(
										'text-sm font-medium',
										isCanceled && 'text-muted-foreground line-through'
									)}
								>
									{formatTime(booking.startTime) ?? '--'}
								</p>
								{#if status}
									<span
										class={cn(
											'mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
											timeStatusClass(status.tone)
										)}
									>
										{status.label}
									</span>
								{/if}
							</div>

							<div class="min-w-0 flex-1">
								<p
									class={cn(
										'truncate text-sm font-medium',
										isCanceled && 'text-muted-foreground line-through'
									)}
								>
									{booking.activityName}
								</p>
								{#if booking.leadCustomerName}
									<p class="mt-0.5 truncate text-xs text-muted-foreground">
										{booking.leadCustomerName}
									</p>
								{/if}
							</div>

							<div class="w-20 shrink-0 text-right">
								{#if isCanceled}
									<span class="text-xs text-muted-foreground">Canceled</span>
								{:else}
									<p class="text-sm font-medium tabular-nums">
										{booking.signedCount}
										<span class="text-muted-foreground">/ {booking.participantCount}</span>
									</p>
									<div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
										<div
											class={cn(
												'h-full rounded-full transition-all duration-300',
												pct === 100 ? 'bg-emerald-500' : 'bg-primary'
											)}
											style="width: {pct}%"
										></div>
									</div>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	<Card class="flex h-[420px] flex-col overflow-hidden md:h-[520px]">
		<CardHeader class="flex flex-row items-center justify-between border-b py-4">
			<div class="flex items-center gap-2">
				<FileTextIcon class="size-4 text-muted-foreground" />
				<CardTitle class="text-base font-semibold">Recent Submissions</CardTitle>
			</div>
			<a
				href={resolve(`/app/${workspaceSlug}/submissions` as `/app/${string}/submissions`)}
				class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				View all
				<ExternalLinkIcon class="size-3" />
			</a>
		</CardHeader>
		<CardContent class="min-h-0 flex-1 overflow-auto p-0">
			{#if submissionsInitialLoading}
				<div class="divide-y divide-border">
					{#each skeletonRows as row (row)}
						<div class="flex items-center gap-4 px-5 py-4">
							<div class="flex-1 space-y-2">
								<Skeleton class="h-4 w-36" />
								<Skeleton class="h-3 w-48" />
							</div>
							<Skeleton class="h-4 w-20 shrink-0" />
						</div>
					{/each}
				</div>
			{:else if submissions.length === 0}
				<div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
					<div
						class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
					>
						<FileTextIcon class="size-5" />
					</div>
					<p class="text-sm text-muted-foreground">No submissions yet</p>
				</div>
			{:else}
				<div class="divide-y divide-border">
					{#each submissions as submission (submission.submissionId)}
						<a
							href={resolve(`/app/${workspaceSlug}/submissions` as `/app/${string}/submissions`)}
							class="flex w-full items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
						>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{submission.signerName}</p>
								<p class="mt-0.5 truncate text-xs text-muted-foreground">
									{submission.signerEmail}
									{#if submission.bookingActivityName}
										<span aria-hidden="true"> · </span>{submission.bookingActivityName}
									{/if}
									{#if submission.minorCount > 0}
										<span aria-hidden="true"> · </span>+{submission.minorCount} minor{submission.minorCount >
										1
											? 's'
											: ''}
									{/if}
								</p>
							</div>
							<p class="shrink-0 text-xs text-muted-foreground tabular-nums">
								{formatSubmittedAt(submission.submittedAt)}
							</p>
						</a>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
