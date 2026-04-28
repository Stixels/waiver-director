<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { FunctionReturnType } from 'convex/server';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import BookingDetailSheet from '$lib/components/bookings/BookingDetailSheet.svelte';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
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
	import { parseConvexId, queryString } from '$lib/utils/url';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import CalendarOffIcon from '@lucide/svelte/icons/calendar-off';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
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
		{ value: 'attention', label: 'Incomplete' },
		{ value: 'canceled', label: 'Canceled' }
	];

	let selectedDate = $state(initialSelectedDate());
	let pageIndex = $state(0);
	let searchQuery = $state('');
	let debouncedSearchQuery = $state('');
	let lastDebouncedSearchQuery = $state('');
	let statusFilter = $state<StatusFilter>('all');
	let hideDone = $state(true);
	let lastWorkspaceId = $state<string | null>(null);
	let lastAppliedSearchDate: string | null = null;
	let lastOpenedSearchBookingKey: string | null = null;
	let isClearingWorkspaceUrl = $state(false);
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
	const isToday = $derived(selectedDate === toDateInputValue(new Date()));
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
						searchQuery: debouncedSearchQuery,
						hideDone: hideDone && isToday,
						statusFilter
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
	const summary = $derived(bookingPage?.summary ?? null);
	const publicSlug = $derived(waiverQuery.data?.publicSlug ?? null);
	const isLoading = $derived(
		bookingsQuery.isLoading || waiverQuery.isLoading || appContext.isLoading
	);
	const currentPage = $derived((bookingPage?.pageIndex ?? pageIndex) + 1);
	const hasPagination = $derived(
		!!bookingPage && (bookingPage.hasPreviousPage || bookingPage.hasNextPage)
	);
	const isInitialLoading = $derived(isLoading && !bookingPage);
	const searchDateParam = $derived(page.url.searchParams.get('date'));
	const searchBookingIdParam = $derived(
		parseConvexId<'bookings'>(page.url.searchParams.get('bookingId'))
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

	function isDateInputValue(value: string | null): value is string {
		if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
		const date = dateFromInputValue(value);
		const [year, month, day] = value.split('-').map(Number);
		return (
			!Number.isNaN(date.getTime()) &&
			date.getFullYear() === year &&
			date.getMonth() === month - 1 &&
			date.getDate() === day
		);
	}

	function initialSelectedDate() {
		const urlDate = page.url.searchParams.get('date');
		return isDateInputValue(urlDate) ? urlDate : toDateInputValue(new Date());
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

	async function updateBookingsUrl(args: {
		date?: string | null;
		bookingId?: Id<'bookings'> | null;
		replaceState?: boolean;
	}) {
		const nextDate = args.date ?? null;
		lastAppliedSearchDate = nextDate;
		const query = queryString([
			['date', nextDate],
			['bookingId', args.bookingId ?? null]
		]);

		const pathname = `/app/${page.params.workspaceSlug}/bookings` as `/app/${string}/bookings`;
		const href = (query ? `${pathname}?${query}` : pathname) as
			| `/app/${string}/bookings`
			| `/app/${string}/bookings?${string}`;

		await goto(resolve(href), {
			replaceState: args.replaceState ?? true,
			noScroll: true,
			keepFocus: true
		});
	}

	function setSelectedDate(
		value: string,
		options: { updateUrl?: boolean; clearBooking?: boolean } = {}
	) {
		if (!isDateInputValue(value)) return;
		selectedDate = value;
		resetPagination();
		if (options.clearBooking) {
			selectedBookingId = null;
			detailOpen = false;
		}
		if (options.updateUrl) {
			void updateBookingsUrl({
				date: value,
				bookingId: options.clearBooking ? null : selectedBookingId,
				replaceState: true
			});
		}
	}

	$effect(() => {
		const workspaceId = currentWorkspace?.workspaceId ?? null;
		if (!workspaceId) {
			lastOpenedSearchBookingKey = null;
			selectedBookingId = null;
			detailOpen = false;
			resetPagination();
			return;
		}
		if (workspaceId === lastWorkspaceId) return;
		const isWorkspaceChange = lastWorkspaceId !== null;
		lastWorkspaceId = workspaceId;
		lastAppliedSearchDate = null;
		lastOpenedSearchBookingKey = null;
		selectedBookingId = null;
		detailOpen = false;
		resetPagination();
		if (isWorkspaceChange) {
			isClearingWorkspaceUrl = true;
			void updateBookingsUrl({
				date: null,
				bookingId: null,
				replaceState: true
			}).finally(() => {
				isClearingWorkspaceUrl = false;
			});
		}
	});

	$effect(() => {
		const query = searchQuery;
		const timeout = setTimeout(() => {
			debouncedSearchQuery = query;
		}, 250);

		return () => clearTimeout(timeout);
	});

	$effect(() => {
		if (debouncedSearchQuery === lastDebouncedSearchQuery) return;
		lastDebouncedSearchQuery = debouncedSearchQuery;
		resetPagination();
	});

	$effect(() => {
		if (isClearingWorkspaceUrl) return;
		if (!searchDateParam) {
			lastAppliedSearchDate = null;
			return;
		}
		if (searchDateParam === lastAppliedSearchDate || !isDateInputValue(searchDateParam)) return;
		lastAppliedSearchDate = searchDateParam;
		setSelectedDate(searchDateParam);
	});

	$effect(() => {
		if (isClearingWorkspaceUrl) return;
		if (!searchBookingIdParam) {
			if (detailOpen) detailOpen = false;
			lastOpenedSearchBookingKey = null;
			return;
		}
		if (searchBookingIdParam === lastOpenedSearchBookingKey) return;
		lastOpenedSearchBookingKey = searchBookingIdParam;
		selectedBookingId = searchBookingIdParam;
		detailOpen = true;
	});

	$effect(() => {
		if (isClearingWorkspaceUrl) return;
		if (detailOpen || !searchBookingIdParam) return;
		void updateBookingsUrl({
			date: selectedDate,
			bookingId: null,
			replaceState: true
		});
	});

	function changeDate(days: number) {
		const [year, month, day] = selectedDate.split('-').map(Number);
		setSelectedDate(toDateInputValue(new Date(year, month - 1, day + days)), {
			updateUrl: true,
			clearBooking: true
		});
	}

	function goToday() {
		setSelectedDate(toDateInputValue(new Date()), { updateUrl: true, clearBooking: true });
	}

	function handleDateInput(event: Event) {
		setSelectedDate((event.currentTarget as HTMLInputElement).value, {
			updateUrl: true,
			clearBooking: true
		});
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
	}

	function clearSearch() {
		if (!searchQuery) return;
		searchQuery = '';
		debouncedSearchQuery = '';
		resetPagination();
	}

	function setStatusFilter(value: StatusFilter) {
		if (statusFilter === value) return;
		statusFilter = value;
		resetPagination();
	}

	function handleHideDoneChange(event: Event) {
		hideDone = (event.currentTarget as HTMLInputElement).checked;
		resetPagination();
	}

	function statusFilterCount(value: StatusFilter) {
		if (!summary) return null;
		if (value === 'active') return summary.activeCount;
		if (value === 'attention') return summary.incompleteCount;
		if (value === 'canceled') return summary.canceledCount;
		return summary.totalCount;
	}

	function formatSelectedDate(value: string) {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			month: 'short',
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
		try {
			await navigator.clipboard.writeText(url);
			toast.success('Booking waiver link copied.');
		} catch (error) {
			console.error('[bookings] unable to copy booking link', error);
			toast.error('Unable to copy booking link.');
		}
	}

	function openBooking(bookingId: Id<'bookings'>) {
		selectedBookingId = bookingId;
		detailOpen = true;
		void updateBookingsUrl({
			date: selectedDate,
			bookingId,
			replaceState: false
		});
	}

	function handleBookingRowKeydown(event: KeyboardEvent, bookingId: Id<'bookings'>) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openBooking(bookingId);
	}

	type TimeStatus = {
		label: string;
		tone: 'now' | 'soon' | 'past';
	};

	const UPCOMING_BOOKING_CHIP_WINDOW_MINUTES = 60;

	// Only meaningful when viewing today: gives each row a scannable "when is this"
	// hint so operators don't have to mentally subtract times.
	function timeStatus(booking: Booking): TimeStatus | null {
		if (!isToday || !booking.startTime) return null;
		const startAt = Date.parse(booking.startTime);
		if (Number.isNaN(startAt)) return null;
		const endAt = booking.endTime ? Date.parse(booking.endTime) : startAt + 1 * 60 * 60 * 1000;
		const diffMs = startAt - now;
		const diffMinutes = Math.round(diffMs / 60_000);

		if (now >= startAt && now <= endAt) return { label: 'Now', tone: 'now' };
		if (now > endAt) return { label: 'Done', tone: 'past' };
		if (diffMinutes <= UPCOMING_BOOKING_CHIP_WINDOW_MINUTES) {
			return { label: `In ${diffMinutes}m`, tone: 'soon' };
		}
		return null;
	}

	function timeStatusClass(tone: TimeStatus['tone']) {
		if (tone === 'now') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
		if (tone === 'soon') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
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

<PageHeader
	title="Check-ins"
	subtitle="{formatSelectedDate(selectedDate)} · Front desk check-in coverage."
>
	{#snippet actions()}
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
	{/snippet}
	{#snippet meta()}
		<div class="relative w-full lg:max-w-md">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground transition-colors"
				aria-hidden="true"
			/>
			<input
				type="text"
				placeholder="Search by customer, activity, or booking number"
				value={searchQuery}
				oninput={handleSearchInput}
				class="h-9 w-full rounded-lg border border-input bg-background/60 pr-10 pl-11 text-sm shadow-xs transition-all placeholder:text-muted-foreground/70 hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
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
	{/snippet}
</PageHeader>

<PageShell>
	<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex w-full flex-wrap items-center gap-3 lg:w-auto">
			{#if isToday}
				<label
					class="inline-flex h-10 w-full cursor-pointer items-center rounded-lg border border-input bg-card/50 p-0.5 shadow-xs lg:w-auto"
				>
					<input
						type="checkbox"
						checked={hideDone}
						onchange={handleHideDoneChange}
						class="peer sr-only"
					/>
					<span
						class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-all peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring/30 peer-focus-visible:outline-none hover:text-foreground lg:h-8"
					>
						<EyeOffIcon class="size-3.5" aria-hidden="true" />
						Hide done
					</span>
				</label>
			{/if}
			<div
				class="grid h-10 w-full grid-cols-4 items-center rounded-lg border border-input bg-card/50 p-0.5 shadow-xs lg:inline-flex lg:w-auto"
				role="tablist"
				aria-label="Filter bookings by status"
			>
				{#each STATUS_FILTERS as filter (filter.value)}
					{@const active = statusFilter === filter.value}
					{@const filterCount = statusFilterCount(filter.value)}
					<button
						type="button"
						role="tab"
						aria-selected={active}
						onclick={() => setStatusFilter(filter.value)}
						class={cn(
							'inline-flex h-9 items-center justify-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none lg:h-8 lg:px-3',
							active
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<span>{filter.label}</span>
						<span
							class={cn(
								'ml-1 rounded-sm px-1 py-0.5 text-[10px] tabular-nums lg:ml-1.5 lg:px-1.5',
								active ? 'bg-muted text-muted-foreground' : 'bg-muted/60 text-muted-foreground'
							)}
						>
							{#if isInitialLoading}
								<Skeleton class="h-2.5 w-2.5" />
							{:else if filterCount === null}
								&mdash;
							{:else}
								{filterCount}
							{/if}
						</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if isLoading}
		<div class="space-y-3 md:hidden">
			{#each [0, 1, 2, 3, 4, 5] as index (index)}
				<div class="overflow-hidden rounded-xl border border-border bg-card/30">
					<div class="p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1 space-y-2">
								<div class="flex items-center gap-2">
									<Skeleton class="h-4 w-16" />
									<Skeleton class="h-5 w-12 rounded-full" />
								</div>
								<Skeleton class="h-5 w-32" />
								<Skeleton class="h-4 w-28" />
								<Skeleton class="h-3 w-40" />
							</div>
							<div class="space-y-1">
								<Skeleton class="ml-auto h-4 w-10" />
								<Skeleton class="ml-auto h-3 w-12" />
							</div>
						</div>
					</div>
					<div class="flex items-center justify-between border-t border-border px-4 py-2.5">
						<Skeleton class="h-3 w-20" />
						<Skeleton class="h-8 w-20" />
					</div>
				</div>
			{/each}
		</div>
		<div class="hidden overflow-hidden rounded-xl border border-border md:block">
			{#each [0, 1, 2, 3, 4, 5] as index (index)}
				<div
					class="grid grid-cols-[10%_28%_27%_20%_15%] items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
				>
					<div class="space-y-1.5">
						<Skeleton class="h-4 w-14" />
						<Skeleton class="h-4 w-10 rounded-full" />
					</div>
					<Skeleton class="h-4 w-40" />
					<div class="space-y-1.5">
						<Skeleton class="h-4 w-32" />
						<Skeleton class="h-3 w-36" />
					</div>
					<Skeleton class="h-4 w-12" />
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
	{:else if bookings.length === 0}
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
						: hideDone && isToday
							? 'No unfinished bookings'
							: 'No bookings synced for this day'}
				</p>
				<p class="text-xs text-muted-foreground">
					{#if searchQuery || statusFilter !== 'all'}
						Adjust search or filters for {formatSelectedDate(selectedDate)}.
					{:else if hideDone && isToday}
						Show done bookings to review rooms that have already ended.
					{:else}
						Try a different date or check the booking integration.
					{/if}
				</p>
			</div>
		</div>
	{:else}
		<div class="space-y-3 md:hidden">
			{#each bookings as booking (booking.bookingId)}
				{@const isCanceled = booking.status === 'canceled'}
				{@const isNextUpcoming = booking.bookingId === bookingPage?.nextUpcomingBookingId}
				{@const complete =
					booking.participantCount > 0 && booking.signedCount >= booking.participantCount}
				{@const time = formatTime(booking.startTime)}
				{@const status = timeStatus(booking)}
				<div
					class={cn(
						'overflow-hidden rounded-xl border border-border bg-card/30',
						isNextUpcoming && !isCanceled && 'border-primary/40',
						isCanceled && 'opacity-60'
					)}
				>
					<button
						type="button"
						class="block w-full p-4 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
						onclick={() => openBooking(booking.bookingId)}
					>
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<p class="text-sm font-semibold tabular-nums">
										{time ?? 'Not set'}
									</p>
									{#if isCanceled}
										<span
											class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
										>
											Canceled
										</span>
									{:else if status}
										<span
											class={cn(
												'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase tabular-nums',
												timeStatusClass(status.tone)
											)}
										>
											{status.label}
										</span>
									{:else if isNextUpcoming}
										<span
											class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase"
										>
											Next up
										</span>
									{/if}
								</div>
								<p
									class={cn(
										'mt-2 truncate text-base font-semibold',
										isCanceled && 'line-through decoration-muted-foreground/60'
									)}
								>
									{booking.activityName}
								</p>
								<p class="mt-0.5 truncate text-sm text-muted-foreground">
									{booking.leadCustomerName ?? 'Unknown customer'}
								</p>
								<p class="truncate text-xs text-muted-foreground/80">
									{booking.leadCustomerEmail ?? 'No email on booking'}
								</p>
							</div>
							<div class="shrink-0 text-right">
								<p
									class={cn(
										'text-sm font-semibold tabular-nums',
										complete
											? 'text-emerald-600 dark:text-emerald-400'
											: booking.signedCount === 0 && booking.participantCount > 0
												? 'text-muted-foreground'
												: 'text-foreground'
									)}
								>
									{booking.signedCount}
									<span class="font-normal text-muted-foreground">/ {booking.participantCount}</span
									>
								</p>
								<p
									class="mt-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
								>
									Signed
								</p>
							</div>
						</div>
					</button>
					<div class="flex items-center justify-between border-t border-border px-4 py-2.5">
						<p class="text-xs text-muted-foreground">
							{complete && !isCanceled
								? 'All waivers signed'
								: isCanceled
									? 'Canceled booking'
									: `${Math.max(0, booking.participantCount - booking.signedCount)} incomplete`}
						</p>
						<Button
							size="sm"
							variant="outline"
							onclick={(event) => copyBookingLink(booking, event)}
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
					</div>
				</div>
			{/each}
		</div>

		<div class="hidden overflow-hidden rounded-xl border border-border md:block">
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
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Time
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Activity
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Customer
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Signed
						</TableHead>
						<TableHead class="text-right">
							<span class="sr-only">Actions</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each bookings as booking (booking.bookingId)}
						{@const isCanceled = booking.status === 'canceled'}
						{@const isNextUpcoming = booking.bookingId === bookingPage?.nextUpcomingBookingId}
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
									<p class="mt-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
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
									{booking.activityName}
								</p>
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
									<span class="font-normal text-muted-foreground">/ {booking.participantCount}</span
									>
								</span>
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
			{@const visibleCount = bookings.length}
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
</PageShell>
