<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import BookingDetailSheet from '$lib/components/bookings/BookingDetailSheet.svelte';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { publicEnv } from '$lib/config/public';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import CalendarOffIcon from '@lucide/svelte/icons/calendar-off';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';

	const PAGE_SIZE = 50;

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);

	type StatusFilter = 'all' | 'active' | 'attention' | 'canceled';
	const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'active', label: 'Active' },
		{ value: 'attention', label: 'Attention' },
		{ value: 'canceled', label: 'Canceled' }
	];

	let selectedDate = $state(toDateInputValue(new Date()));
	let pageIndex = $state(0);
	let searchQuery = $state('');
	let statusFilter = $state<StatusFilter>('all');
	let lastWorkspaceId = $state<string | null>(null);
	let selectedBookingId = $state<Id<'bookings'> | null>(null);
	let detailOpen = $state(false);
	let now = $state(Date.now());

	onMount(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 30_000);
		return () => clearInterval(interval);
	});

	const dayRange = $derived(dayRangeForDate(selectedDate));
	// Only ask the server to drop canceled rows when the filter absolutely
	// excludes them. 'canceled' needs them returned so the client can isolate them.
	const hideCanceledServerArg = $derived(statusFilter === 'active' || statusFilter === 'attention');
	const bookingsQuery = useProtectedQuery(
		api.bookings.listWorkspaceBookings,
		() =>
			currentWorkspace
				? {
						workspaceId: currentWorkspace.workspaceId,
						dayStartAt: dayRange.startAt,
						dayEndAt: dayRange.endAt,
						pageIndex,
						pageSize: PAGE_SIZE,
						searchQuery,
						hideCanceled: hideCanceledServerArg
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);
	const waiverQuery = useProtectedQuery(
		api.waivers.getWorkspaceWaiver,
		() => (currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);

	type BookingPage = FunctionReturnType<typeof api.bookings.listWorkspaceBookings>;
	type Booking = BookingPage['bookings'][number];

	const bookingPage = $derived((bookingsQuery.data ?? null) as BookingPage | null);
	const bookings = $derived(bookingPage?.bookings ?? []);
	// Client-side filter layer for states the server doesn't model directly.
	// Kept client-side so new filter options stay additive without schema churn.
	const displayedBookings = $derived.by(() => {
		if (statusFilter === 'attention') {
			return bookings.filter(
				(booking) => booking.status === 'active' && booking.signedCount < booking.participantCount
			);
		}
		if (statusFilter === 'canceled') {
			return bookings.filter((booking) => booking.status === 'canceled');
		}
		return bookings;
	});
	const publicSlug = $derived(waiverQuery.data?.publicSlug ?? null);
	const isLoading = $derived(
		bookingsQuery.isLoading || waiverQuery.isLoading || appContext.isLoading
	);
	const currentPage = $derived((bookingPage?.pageIndex ?? pageIndex) + 1);
	const isToday = $derived(selectedDate === toDateInputValue(new Date()));
	const hasPagination = $derived(
		!!bookingPage && (bookingPage.hasPreviousPage || bookingPage.hasNextPage)
	);

	function toDateInputValue(date: Date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function dateFromInputValue(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function dayRangeForDate(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		const start = new Date(year, month - 1, day);
		const end = new Date(year, month - 1, day + 1);
		return {
			startAt: start.getTime(),
			endAt: end.getTime()
		};
	}

	function resetPagination() {
		pageIndex = 0;
	}

	$effect(() => {
		const workspaceId = currentWorkspace?.workspaceId ?? null;
		if (workspaceId === lastWorkspaceId) return;
		lastWorkspaceId = workspaceId;
		resetPagination();
	});

	function changeDate(days: number) {
		const [year, month, day] = selectedDate.split('-').map(Number);
		selectedDate = toDateInputValue(new Date(year, month - 1, day + days));
		resetPagination();
	}

	function goToday() {
		selectedDate = toDateInputValue(new Date());
		resetPagination();
	}

	function handleDateInput(event: Event) {
		selectedDate = (event.currentTarget as HTMLInputElement).value;
		resetPagination();
	}

	function goNextPage() {
		if (!bookingPage?.hasNextPage) return;
		pageIndex += 1;
	}

	function goPreviousPage() {
		if (!bookingPage?.hasPreviousPage) return;
		pageIndex = Math.max(0, pageIndex - 1);
	}

	function handleSearchInput(event: Event) {
		searchQuery = (event.currentTarget as HTMLInputElement).value;
		resetPagination();
	}

	function clearSearch() {
		if (!searchQuery) return;
		searchQuery = '';
		resetPagination();
	}

	function setStatusFilter(value: StatusFilter) {
		if (statusFilter === value) return;
		statusFilter = value;
		resetPagination();
	}

	function formatSelectedDate(value: string) {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		}).format(dateFromInputValue(value));
	}

	function formatTime(timestamp: string | null) {
		if (!timestamp) return null;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}

	function activityName(booking: Booking) {
		return booking.productName ?? booking.title;
	}

	function bookingPublicUrl(booking: Booking) {
		if (!publicSlug) return '';
		const baseUrl =
			publicEnv.appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
		return new URL(`/w/${publicSlug}/b/${booking.lookupToken}`, baseUrl).toString();
	}

	async function copyBookingLink(booking: Booking, event?: MouseEvent) {
		event?.stopPropagation();
		const url = bookingPublicUrl(booking);
		if (!url) return;
		await navigator.clipboard.writeText(url);
		toast.success('Booking waiver link copied.');
	}

	function openBooking(bookingId: Id<'bookings'>) {
		selectedBookingId = bookingId;
		detailOpen = true;
	}

	function handleBookingRowKeydown(event: KeyboardEvent, bookingId: Id<'bookings'>) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openBooking(bookingId);
	}

	function signedPercent(booking: Booking) {
		if (booking.participantCount === 0) return 0;
		return Math.min(100, Math.round((booking.signedCount / booking.participantCount) * 100));
	}

	function progressTone(booking: Booking) {
		if (booking.status === 'canceled') return 'bg-muted-foreground/40';
		if (booking.participantCount > 0 && booking.signedCount >= booking.participantCount) {
			return 'bg-emerald-500';
		}
		if (booking.signedCount === 0) return 'bg-muted-foreground/60';
		return 'bg-primary';
	}

	type TimeStatus = {
		label: string;
		tone: 'now' | 'soon' | 'upcoming' | 'past';
	};

	// Only meaningful when viewing today: gives each row a scannable "when is this"
	// hint so operators don't have to mentally subtract times.
	function timeStatus(booking: Booking): TimeStatus | null {
		if (!isToday || !booking.startTime) return null;
		const startAt = Date.parse(booking.startTime);
		if (Number.isNaN(startAt)) return null;
		const endAt = booking.endTime ? Date.parse(booking.endTime) : startAt + 2 * 60 * 60 * 1000;
		const diffMs = startAt - now;
		const diffMinutes = Math.round(diffMs / 60_000);

		if (now >= startAt && now <= endAt) return { label: 'Now', tone: 'now' };
		if (now > endAt) return { label: 'Done', tone: 'past' };
		if (diffMinutes <= 60) return { label: `In ${diffMinutes}m`, tone: 'soon' };
		const diffHours = Math.round(diffMinutes / 60);
		if (diffHours <= 12) return { label: `In ${diffHours}h`, tone: 'upcoming' };
		return null;
	}

	function timeStatusClass(tone: TimeStatus['tone']) {
		if (tone === 'now') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
		if (tone === 'soon') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
		if (tone === 'upcoming') return 'bg-muted text-muted-foreground';
		return 'bg-muted/60 text-muted-foreground/70';
	}
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Bookings | Waiver Director</title>
</svelte:head>

{#if selectedBookingId && currentWorkspace}
	<BookingDetailSheet
		bind:open={detailOpen}
		workspaceId={currentWorkspace.workspaceId}
		bookingId={selectedBookingId}
		{publicSlug}
	/>
{/if}

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-6xl min-w-0 space-y-6">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div class="min-w-0 space-y-1">
				<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Bookings</p>
				<h1 class="text-2xl font-semibold tracking-tight">Daily bookings</h1>
				<p class="text-sm text-muted-foreground">
					Navigate each day's booking groups and track waiver coverage.
				</p>
			</div>

			<div
				class="flex w-full flex-wrap items-center gap-1 rounded-xl border border-border bg-card/40 p-1.5 lg:w-auto"
			>
				<Button
					size="icon-sm"
					variant="ghost"
					onclick={() => changeDate(-1)}
					aria-label="Previous day"
				>
					<ChevronLeftIcon class="size-4" aria-hidden="true" />
				</Button>

				<label
					class="relative flex h-9 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 lg:flex-none"
				>
					<CalendarDaysIcon class="size-4 text-muted-foreground" aria-hidden="true" />
					<span class="sr-only">Booking date</span>
					<input
						type="date"
						class="h-7 w-full bg-transparent text-sm outline-none lg:w-32"
						value={selectedDate}
						oninput={handleDateInput}
					/>
				</label>

				<Button
					size="sm"
					variant={isToday ? 'secondary' : 'ghost'}
					onclick={goToday}
					disabled={isToday}
				>
					Today
				</Button>
				<Button size="icon-sm" variant="ghost" onclick={() => changeDate(1)} aria-label="Next day">
					<ChevronRightIcon class="size-4" aria-hidden="true" />
				</Button>
			</div>
		</div>

		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="relative w-full lg:max-w-md">
				<SearchIcon
					class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground transition-colors"
					aria-hidden="true"
				/>
				<input
					type="text"
					placeholder="Search customer, activity, or booking number"
					value={searchQuery}
					oninput={handleSearchInput}
					class="h-10 w-full rounded-lg border border-input bg-card/50 pr-10 pl-11 text-sm shadow-xs transition-all placeholder:text-muted-foreground/70 hover:bg-card focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
					aria-label="Search bookings"
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={clearSearch}
						class="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
						aria-label="Clear search"
					>
						<XIcon class="size-3.5" aria-hidden="true" />
					</button>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<div
					class="inline-flex h-10 items-center rounded-lg border border-input bg-card/50 p-0.5 shadow-xs"
					role="tablist"
					aria-label="Filter bookings by status"
				>
					{#each STATUS_FILTERS as filter (filter.value)}
						{@const active = statusFilter === filter.value}
						<button
							type="button"
							role="tab"
							aria-selected={active}
							onclick={() => setStatusFilter(filter.value)}
							class={cn(
								'h-8 rounded-md px-3 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
								active
									? 'bg-background text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							)}
						>
							{filter.label}
						</button>
					{/each}
				</div>
			</div>
		</div>

		{#if isLoading}
			<div class="overflow-hidden rounded-xl border border-border">
				{#each [0, 1, 2, 3, 4, 5] as index (index)}
					<div
						class="grid grid-cols-[10%_28%_27%_20%_15%] items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
					>
						<Skeleton class="h-4 w-14" />
						<Skeleton class="h-4 w-40" />
						<div class="space-y-1.5">
							<Skeleton class="h-4 w-32" />
							<Skeleton class="h-3 w-24" />
						</div>
						<div class="space-y-1.5">
							<Skeleton class="h-3 w-12" />
							<Skeleton class="h-1 w-full rounded-full" />
						</div>
						<div class="flex justify-end">
							<Skeleton class="h-8 w-20" />
						</div>
					</div>
				{/each}
			</div>
		{:else if !currentWorkspace}
			<div
				class="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
			>
				Workspace not found.
			</div>
		{:else if displayedBookings.length === 0}
			<div
				class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/30 px-4 py-16 text-center"
			>
				<div
					class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
				>
					<CalendarOffIcon class="size-5" aria-hidden="true" />
				</div>
				<div class="space-y-1">
					<p class="text-sm font-medium">
						{searchQuery || statusFilter !== 'all'
							? 'No matching bookings'
							: 'No bookings synced for this day'}
					</p>
					<p class="text-xs text-muted-foreground">
						{#if searchQuery || statusFilter !== 'all'}
							Adjust search or filters for {formatSelectedDate(selectedDate)}.
						{:else}
							Try a different date or trigger a sync from this page.
						{/if}
					</p>
				</div>
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl border border-border">
				<Table class="table-fixed">
					<colgroup>
						<col class="w-[10%]" />
						<col class="w-[28%]" />
						<col class="w-[27%]" />
						<col class="w-[20%]" />
						<col class="w-[15%]" />
					</colgroup>
					<TableHeader>
						<TableRow class="border-border hover:bg-transparent">
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Time
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Activity
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Customer
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Signed
							</TableHead>
							<TableHead class="text-right">
								<span class="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each displayedBookings as booking (booking.bookingId)}
							{@const isCanceled = booking.status === 'canceled'}
							{@const isNextUpcoming = booking.bookingId === bookingPage?.nextUpcomingBookingId}
							{@const percent = signedPercent(booking)}
							{@const complete =
								booking.participantCount > 0 && booking.signedCount >= booking.participantCount}
							<TableRow
								class={cn(
									'relative cursor-pointer border-border transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none',
									isCanceled && 'opacity-55'
								)}
								role="button"
								tabindex={0}
								onclick={() => openBooking(booking.bookingId)}
								onkeydown={(event) => handleBookingRowKeydown(event, booking.bookingId)}
							>
								<TableCell class="relative align-top">
									{#if isNextUpcoming}
										<span class="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true"
										></span>
									{/if}
									{@const time = formatTime(booking.startTime)}
									{@const status = timeStatus(booking)}
									{#if time}
										<p class="text-sm font-medium tabular-nums">{time}</p>
									{:else}
										<p class="text-sm text-muted-foreground">Not set</p>
									{/if}
									{#if status && !isCanceled}
										<span
											class={cn(
												'mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase tabular-nums',
												timeStatusClass(status.tone)
											)}
										>
											{status.label}
										</span>
									{:else if isNextUpcoming}
										<p
											class="mt-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase"
										>
											Next up
										</p>
									{/if}
								</TableCell>
								<TableCell class="align-top">
									<p
										class={cn(
											'truncate text-sm font-medium',
											isCanceled && 'line-through decoration-muted-foreground/60'
										)}
									>
										{activityName(booking)}
									</p>
									{#if booking.productName && booking.title !== booking.productName}
										<p class="mt-0.5 truncate text-xs text-muted-foreground">{booking.title}</p>
									{/if}
								</TableCell>
								<TableCell class="align-top">
									<p class="truncate text-sm font-medium">
										{booking.leadCustomerName ?? 'Unknown customer'}
									</p>
									<p class="truncate text-xs text-muted-foreground">
										{booking.leadCustomerEmail ?? 'No email on booking'}
									</p>
								</TableCell>
								<TableCell class="align-top">
									<span
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
										<span class="font-normal text-muted-foreground"
											>/ {booking.participantCount}</span
										>
									</span>
									<div
										class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
										role="progressbar"
										aria-valuenow={percent}
										aria-valuemin="0"
										aria-valuemax="100"
										aria-label="Signed waiver progress"
									>
										<div
											class={cn('h-full rounded-full transition-all', progressTone(booking))}
											style="width: {percent}%"
										></div>
									</div>
								</TableCell>
								<TableCell class="text-right align-top">
									{#if complete && !isCanceled}
										<span
											class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
										>
											<CircleCheckIcon class="size-3 text-emerald-500" aria-hidden="true" />
											Signed
										</span>
									{:else}
										<Button
											size="sm"
											variant="outline"
											onclick={(event) => copyBookingLink(booking, event)}
											onkeydown={(event) => event.stopPropagation()}
											disabled={!publicSlug || isCanceled}
											aria-label="Copy booking waiver link"
											title={isCanceled
												? 'Canceled bookings cannot be shared'
												: !publicSlug
													? 'Publish a waiver to share links'
													: 'Copy booking waiver link'}
										>
											<CopyIcon class="size-3" aria-hidden="true" />
											Share
										</Button>
									{/if}
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		{/if}

		<div class={cn('flex items-center gap-3', hasPagination ? 'justify-between' : 'justify-end')}>
			{#if bookingPage}
				{@const visibleCount = displayedBookings.length}
				<p class="text-xs text-muted-foreground tabular-nums">
					{#if hasPagination}Page {currentPage} ·
					{/if}{visibleCount}
					{visibleCount === 1 ? 'booking' : 'bookings'}
				</p>
			{/if}
			{#if hasPagination}
				<div class="flex items-center gap-2">
					<Button
						size="sm"
						variant="outline"
						disabled={!bookingPage?.hasPreviousPage}
						onclick={goPreviousPage}
					>
						<ChevronLeftIcon class="size-4" aria-hidden="true" />
						Previous
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={!bookingPage?.hasNextPage}
						onclick={goNextPage}
					>
						Next
						<ChevronRightIcon class="size-4" aria-hidden="true" />
					</Button>
				</div>
			{/if}
		</div>
	</div>
</div>
