<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
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
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import CalendarOffIcon from '@lucide/svelte/icons/calendar-off';
	import UsersIcon from '@lucide/svelte/icons/users';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';

	const PAGE_SIZE = 12;

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);

	let selectedDate = $state(toDateInputValue(new Date()));
	let cursor = $state<string | null>(null);
	let cursorHistory = $state<Array<string | null>>([]);
	let currentPage = $state(1);
	let lastWorkspaceId = $state<string | null>(null);

	const dayRange = $derived(dayRangeForDate(selectedDate));
	const bookingsQuery = useProtectedQuery(
		api.bookings.listWorkspaceBookings,
		() =>
			currentWorkspace
				? {
						workspaceId: currentWorkspace.workspaceId,
						dayStartAt: dayRange.startAt,
						dayEndAt: dayRange.endAt,
						paginationOpts: {
							numItems: PAGE_SIZE,
							cursor
						}
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
	const publicSlug = $derived(waiverQuery.data?.publicSlug ?? null);
	const isLoading = $derived(
		bookingsQuery.isLoading || waiverQuery.isLoading || appContext.isLoading
	);
	const totalSignedUsers = $derived(
		bookings.reduce((total, booking) => total + booking.signedCount, 0)
	);
	const totalExpectedUsers = $derived(
		bookings.reduce((total, booking) => total + booking.participantCount, 0)
	);
	const completionPercent = $derived(
		totalExpectedUsers === 0
			? 0
			: Math.min(100, Math.round((totalSignedUsers / totalExpectedUsers) * 100))
	);
	const isToday = $derived(selectedDate === toDateInputValue(new Date()));

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
		cursor = null;
		cursorHistory = [];
		currentPage = 1;
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
		if (!bookingPage || bookingPage.isDone) return;
		cursorHistory = [...cursorHistory, cursor];
		cursor = bookingPage.continueCursor;
		currentPage += 1;
	}

	function goPreviousPage() {
		if (cursorHistory.length === 0) return;
		const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
		cursorHistory = cursorHistory.slice(0, -1);
		cursor = previousCursor;
		currentPage = Math.max(1, currentPage - 1);
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

	async function copyBookingLink(booking: Booking) {
		const url = bookingPublicUrl(booking);
		if (!url) return;
		await navigator.clipboard.writeText(url);
		toast.success('Booking waiver link copied.');
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
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Bookings | Waiver Director</title>
</svelte:head>

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-6xl min-w-0 space-y-6">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div class="space-y-1">
				<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Bookings</p>
				<h1 class="text-2xl font-semibold tracking-tight">Daily bookings</h1>
				<p class="text-sm text-muted-foreground">
					Navigate each day's booking groups and track waiver coverage.
				</p>
			</div>

			<div
				class="flex w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-1.5 lg:w-auto"
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

		<section class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-xl border border-border bg-card/40 p-4">
				<div class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
					<UsersIcon class="size-3.5" aria-hidden="true" />
					<span class="tracking-wide uppercase">Bookings</span>
				</div>
				<p class="mt-2 text-base font-semibold">
					{bookings.length}
					<span class="ml-1 text-xs font-normal text-muted-foreground">
						{bookings.length === 1 ? 'group' : 'groups'}
					</span>
				</p>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{totalExpectedUsers}
					{totalExpectedUsers === 1 ? 'expected guest' : 'expected guests'}
				</p>
			</div>
			<div class="rounded-xl border border-border bg-card/40 p-4">
				<div class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
					<CircleCheckIcon class="size-3.5" aria-hidden="true" />
					<span class="tracking-wide uppercase">Waiver coverage</span>
				</div>
				<p class="mt-2 text-base font-semibold">
					{totalSignedUsers}
					<span class="text-muted-foreground"> / {totalExpectedUsers}</span>
				</p>
				<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
					<div
						class={cn(
							'h-full rounded-full transition-all',
							completionPercent === 100 && totalExpectedUsers > 0 ? 'bg-emerald-500' : 'bg-primary'
						)}
						style="width: {completionPercent}%"
					></div>
				</div>
			</div>
		</section>

		{#if isLoading}
			<div class="overflow-hidden rounded-xl border border-border">
				{#each [0, 1, 2, 3, 4, 5] as index (index)}
					<div class="grid grid-cols-5 gap-4 border-b border-border p-4 last:border-b-0">
						<Skeleton class="h-5 w-28" />
						<Skeleton class="h-5 w-40" />
						<Skeleton class="h-5 w-32" />
						<Skeleton class="h-5 w-20" />
						<Skeleton class="h-8 w-24" />
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
					<p class="text-sm font-medium">No bookings synced for this day</p>
					<p class="text-xs text-muted-foreground">
						{formatSelectedDate(selectedDate)} — try a different date or trigger a sync from Integrations.
					</p>
				</div>
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl border border-border">
				<Table class="table-fixed">
					<colgroup>
						<col class="w-[12%]" />
						<col class="w-[30%]" />
						<col class="w-[25%]" />
						<col class="w-[10%]" />
						<col class="w-[15%]" />
						<col class="w-[8%]" />
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
								Status
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
						{#each bookings as booking (booking.bookingId)}
							{@const isCanceled = booking.status === 'canceled'}
							{@const percent = signedPercent(booking)}
							{@const complete =
								booking.participantCount > 0 && booking.signedCount >= booking.participantCount}
							<TableRow
								class={cn(
									'border-border transition-colors hover:bg-muted/30',
									isCanceled && 'opacity-60'
								)}
							>
								<TableCell class="align-top">
									{@const time = formatTime(booking.startTime)}
									{#if time}
										<p class="text-sm font-semibold tabular-nums">{time}</p>
									{:else}
										<p class="text-sm text-muted-foreground">Not scheduled</p>
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
									<p class="truncate text-sm">{booking.leadCustomerName ?? 'Unknown customer'}</p>
									<p class="truncate text-xs text-muted-foreground">
										{booking.leadCustomerEmail ?? 'No email on booking'}
									</p>
								</TableCell>
								<TableCell class="align-top">
									{#if isCanceled}
										<Badge variant="outline" class="capitalize">
											<span class="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true"
											></span>
											canceled
										</Badge>
									{:else}
										<Badge variant="secondary" class="capitalize">
											<span class="size-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
											active
										</Badge>
									{/if}
								</TableCell>
								<TableCell class="align-top">
									<div class="flex items-center gap-2">
										<span class="text-xs font-medium text-muted-foreground tabular-nums">
											{booking.signedCount} / {booking.participantCount}
										</span>
										{#if complete}
											<CircleCheckIcon
												class="size-3.5 text-emerald-500"
												aria-label="All waivers signed"
											/>
										{/if}
									</div>
									<div
										class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted"
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
									<Button
										size="icon-sm"
										variant="ghost"
										onclick={() => copyBookingLink(booking)}
										disabled={!publicSlug || isCanceled}
										aria-label="Copy booking waiver link"
										title={isCanceled
											? 'Canceled bookings cannot be shared'
											: !publicSlug
												? 'Publish a waiver to share links'
												: 'Copy booking waiver link'}
									>
										<CopyIcon class="size-4" aria-hidden="true" />
									</Button>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		{/if}

		<div class="flex items-center justify-between gap-3">
			<p class="text-xs text-muted-foreground">Page {currentPage}</p>
			<div class="flex items-center gap-2">
				<Button
					size="sm"
					variant="outline"
					disabled={cursorHistory.length === 0}
					onclick={goPreviousPage}
				>
					<ChevronLeftIcon class="size-4" aria-hidden="true" />
					Previous
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={!bookingPage || bookingPage.isDone}
					onclick={goNextPage}
				>
					Next
					<ChevronRightIcon class="size-4" aria-hidden="true" />
				</Button>
			</div>
		</div>
	</div>
</div>
