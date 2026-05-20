<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import type { FunctionReturnType } from 'convex/server';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import BookingDetailSheet from '$lib/components/bookings/BookingDetailSheet.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SubmissionDetailSheet from '$lib/components/waivers/SubmissionDetailSheet.svelte';
	import { formatBookingTimestamp } from '$lib/utils/date';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import CalendarOffIcon from '@lucide/svelte/icons/calendar-off';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	let {
		workspaceId,
		todayStartAt,
		todayEndAt,
		isLoading = false
	}: {
		workspaceId: Id<'workspaces'> | null | undefined;
		todayStartAt: number;
		todayEndAt: number;
		isLoading?: boolean;
	} = $props();

	const workspaceSlug = $derived(page.params.workspaceSlug ?? '');
	const skeletonRows = [0, 1, 2, 3, 4, 5];
	type LivePanelTab = 'bookings' | 'submissions';
	let activeTab = $state<LivePanelTab>('bookings');
	const activeTitle = $derived(
		activeTab === 'bookings' ? 'Upcoming Bookings' : 'Recent Submissions'
	);

	let now = $state(Date.now());
	onMount(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 30_000);
		return () => clearInterval(interval);
	});

	const bookingsQuery = useProtectedQuery(
		api.bookings.listWorkspaceBookings,
		() =>
			workspaceId
				? {
						workspaceId,
						dayStartAt: todayStartAt,
						dayEndAt: todayEndAt,
						pageIndex: 0,
						pageSize: 24,
						searchQuery: '',
						hideDone: true,
						statusFilter: 'all' as const
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);

	const submissionsQuery = useProtectedQuery(
		api.waivers.listRecentSubmissions,
		() =>
			workspaceId
				? {
						workspaceId,
						paginationOpts: { numItems: 24, cursor: null }
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);

	type BookingPage = FunctionReturnType<typeof api.bookings.listWorkspaceBookings>;
	type Booking = BookingPage['bookings'][number];
	type SubmissionPage = FunctionReturnType<typeof api.waivers.listRecentSubmissions>;

	const bookingPage = $derived((bookingsQuery.data ?? null) as BookingPage | null);
	const bookings = $derived(bookingPage?.bookings ?? []);
	const bookingsInitialLoading = $derived(isLoading || (bookingsQuery.isLoading && !bookingPage));

	const submissionPage = $derived((submissionsQuery.data ?? null) as SubmissionPage | null);
	const submissions = $derived(submissionPage?.submissions ?? []);
	const submissionsInitialLoading = $derived(
		isLoading || (submissionsQuery.isLoading && !submissionPage)
	);
	const waiverQuery = useProtectedQuery(
		api.waivers.getWorkspaceWaiver,
		() => (workspaceId ? { workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);
	const publicSlug = $derived(waiverQuery.data?.publicSlug ?? null);

	let selectedBookingId = $state<Id<'bookings'> | null>(null);
	let bookingDetailOpen = $state(false);
	let selectedSubmissionId = $state<Id<'waiver_submissions'> | null>(null);
	let submissionDetailOpen = $state(false);

	type TimeStatus = { label: string; tone: 'now' | 'soon' | 'past' };

	function timeStatus(booking: Booking): TimeStatus | null {
		if (!booking.startTime) return null;
		const startAt = Date.parse(booking.startTime);
		if (Number.isNaN(startAt)) return null;
		const endAt = booking.endTime ? Date.parse(booking.endTime) : startAt + 60 * 60 * 1000;
		const diffMs = startAt - now;
		const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));
		if (now >= startAt && now <= endAt) return { label: 'Now', tone: 'now' };
		if (now > endAt) return { label: 'Done', tone: 'past' };
		if (diffMinutes <= 60) return { label: `In ${diffMinutes}m`, tone: 'soon' };
		return null;
	}

	function timeStatusClass(tone: TimeStatus['tone']) {
		if (tone === 'now')
			return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
		if (tone === 'soon')
			return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400';
		return 'border-border bg-muted/50 text-muted-foreground';
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

	function formatDob(dob: string) {
		const [y, m, d] = dob.split('-').map(Number);
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(y, m - 1, d));
	}

	function openBooking(bookingId: Id<'bookings'>) {
		selectedBookingId = bookingId;
		bookingDetailOpen = true;
	}

	function openSubmission(submissionId: Id<'waiver_submissions'>) {
		selectedSubmissionId = submissionId;
		submissionDetailOpen = true;
	}
</script>

{#if selectedBookingId && workspaceId}
	<BookingDetailSheet
		bind:open={bookingDetailOpen}
		{workspaceId}
		{workspaceSlug}
		bookingId={selectedBookingId}
		{publicSlug}
	/>
{/if}

{#if selectedSubmissionId && workspaceId}
	<SubmissionDetailSheet
		bind:open={submissionDetailOpen}
		{workspaceId}
		{workspaceSlug}
		submissionId={selectedSubmissionId}
	/>
{/if}

<Card
	class="flex h-[min(30rem,calc(100svh-12rem))] min-h-0 flex-col overflow-hidden sm:h-[min(32rem,calc(100svh-13rem))] xl:h-full"
>
	<CardHeader class="flex flex-row items-center justify-between border-b py-4">
		<div class="flex min-w-0 items-center gap-4">
			<CardTitle class="sr-only">{activeTitle}</CardTitle>
			<nav class="flex items-end gap-0" aria-label="Dashboard activity">
				<button
					type="button"
					aria-current={activeTab === 'bookings' ? 'page' : undefined}
					class="inline-flex items-center gap-2 border-b-2 border-transparent px-0.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-xs focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:border-primary aria-[current=page]:text-foreground"
					onclick={() => (activeTab = 'bookings')}
				>
					<CalendarCheckIcon class="size-4" aria-hidden="true" />
					Bookings
				</button>
				<button
					type="button"
					aria-current={activeTab === 'submissions' ? 'page' : undefined}
					class="ml-5 inline-flex items-center gap-2 border-b-2 border-transparent px-0.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-xs focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:border-primary aria-[current=page]:text-foreground"
					onclick={() => (activeTab = 'submissions')}
				>
					<FileTextIcon class="size-4" aria-hidden="true" />
					Submissions
				</button>
			</nav>
		</div>
		{#if activeTab === 'bookings'}
			<a
				href={resolve(`/app/${workspaceSlug}/bookings` as `/app/${string}/bookings`)}
				class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				View all
				<ExternalLinkIcon class="size-3" />
			</a>
		{:else}
			<a
				href={resolve(`/app/${workspaceSlug}/submissions` as `/app/${string}/submissions`)}
				class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				View all
				<ExternalLinkIcon class="size-3" />
			</a>
		{/if}
	</CardHeader>
	<CardContent class="min-h-0 flex-1 overflow-auto p-0">
		{#if activeTab === 'bookings'}
			{#if bookingsInitialLoading}
				<div class="divide-y divide-border">
					{#each skeletonRows as row (row)}
						<div
							class="grid items-center gap-4 px-5 py-3 xl:grid-cols-[5rem_minmax(14rem,1.3fr)_minmax(14rem,1fr)_7rem]"
						>
							<div class="space-y-1.5">
								<Skeleton class="h-4 w-12" />
								<Skeleton class="h-5 w-11 rounded-full" />
							</div>
							<div class="min-w-0 space-y-2">
								<Skeleton class="h-4 w-44 max-w-full" />
								<Skeleton class="h-3 w-28 max-w-full" />
							</div>
							<div class="hidden min-w-0 space-y-2 xl:block">
								<Skeleton class="h-4 w-36 max-w-full" />
								<Skeleton class="h-3 w-52 max-w-full" />
							</div>
							<div class="space-y-2 xl:text-right">
								<Skeleton class="ml-auto h-4 w-14" />
								<Skeleton class="h-1.5 w-full rounded-full" />
							</div>
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
						{@const complete =
							booking.participantCount > 0 && booking.signedCount >= booking.participantCount}
						<button
							type="button"
							onclick={() => openBooking(booking.bookingId)}
							class="grid w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none xl:grid-cols-[5rem_minmax(14rem,1.3fr)_minmax(14rem,1fr)_7rem]"
						>
							<div class="min-w-0">
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
											'mt-1 inline-flex h-5 items-center rounded-full border px-2 text-[10px] leading-none font-semibold',
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
								<p class="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
									Booking #{booking.providerBookingId}
								</p>
								<p class="mt-0.5 truncate text-xs text-muted-foreground xl:hidden">
									{booking.leadCustomerName ?? 'Unknown customer'}
									<span aria-hidden="true"> · </span>{booking.leadCustomerEmail ??
										'No email on booking'}
								</p>
							</div>

							<div class="hidden min-w-0 xl:block">
								<p class="truncate text-sm font-medium">
									{booking.leadCustomerName ?? 'Unknown customer'}
								</p>
								<p class="mt-0.5 truncate text-xs text-muted-foreground">
									{booking.leadCustomerEmail ?? 'No email on booking'}
								</p>
							</div>

							<div class="min-w-0 text-right">
								{#if isCanceled}
									<span class="text-xs text-muted-foreground">Canceled</span>
								{:else}
									<p
										class={cn(
											'text-sm font-medium tabular-nums',
											complete
												? 'text-emerald-600 dark:text-emerald-400'
												: booking.signedCount === 0 && booking.participantCount > 0
													? 'text-muted-foreground'
													: 'text-foreground'
										)}
									>
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
						</button>
					{/each}
				</div>
			{/if}
		{:else if submissionsInitialLoading}
			<div class="divide-y divide-border">
				{#each skeletonRows as row (row)}
					<div
						class="grid items-center gap-4 px-5 py-3 xl:grid-cols-[minmax(12rem,1.15fr)_minmax(14rem,1.2fr)_minmax(8rem,0.75fr)_8rem]"
					>
						<div class="min-w-0 space-y-2">
							<Skeleton class="h-4 w-36 max-w-full" />
							<Skeleton class="h-3 w-44 max-w-full" />
						</div>
						<div class="hidden min-w-0 space-y-2 xl:block">
							<Skeleton class="h-4 w-40 max-w-full" />
							<Skeleton class="h-3 w-52 max-w-full" />
						</div>
						<div class="hidden min-w-0 space-y-2 xl:block">
							<Skeleton class="h-4 w-28 max-w-full" />
							<Skeleton class="h-3 w-24 max-w-full" />
						</div>
						<Skeleton class="h-4 w-20 justify-self-end" />
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
					{@const bookingDate = formatBookingTimestamp(submission.bookingStartTime)}
					<button
						type="button"
						onclick={() => openSubmission(submission.submissionId)}
						class="grid w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none xl:grid-cols-[minmax(12rem,1.15fr)_minmax(14rem,1.2fr)_minmax(8rem,0.75fr)_8rem]"
					>
						<div class="min-w-0">
							<div class="flex min-w-0 items-center gap-2">
								<p class="truncate text-sm font-medium">{submission.signerName}</p>
								{#if submission.minorCount > 0}
									<span
										class="inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground tabular-nums"
									>
										+{submission.minorCount}
										{submission.minorCount === 1 ? 'minor' : 'minors'}
									</span>
								{/if}
							</div>
							<p class="mt-0.5 truncate text-xs text-muted-foreground">
								{submission.signerEmail}
								<span aria-hidden="true"> · </span>{formatDob(submission.signerDateOfBirth)}
							</p>
							<div
								class="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground/80 xl:hidden"
							>
								<p class="truncate font-medium">
									{submission.bookingActivityName ?? 'General waiver'}
								</p>
								<span aria-hidden="true"> · </span>
								<p class="shrink-0 tabular-nums">{bookingDate ?? 'No booking attached'}</p>
							</div>
						</div>

						<div class="hidden min-w-0 xl:block">
							<p class="truncate text-sm font-medium">
								{submission.bookingActivityName ?? 'General waiver'}
							</p>
							<p class="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
								{bookingDate ?? 'No booking attached'}
							</p>
						</div>

						<div class="hidden min-w-0 xl:block">
							<p class="text-xs font-medium text-muted-foreground">Date of birth</p>
							<p class="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
								{formatDob(submission.signerDateOfBirth)}
							</p>
						</div>

						<p class="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
							{formatSubmittedAt(submission.submittedAt)}
						</p>
					</button>
				{/each}
			</div>
		{/if}
	</CardContent>
</Card>
