<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import DataTableEmptyState from '$lib/components/app/DataTableEmptyState.svelte';
	import DataTablePage from '$lib/components/app/DataTablePage.svelte';
	import DataTableShell from '$lib/components/app/DataTableShell.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { cn } from '$lib/utils';
	import { parseDate, type DateValue } from '@internationalized/date';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import CalendarOffIcon from '@lucide/svelte/icons/calendar-off';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import SearchIcon from '@lucide/svelte/icons/search';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import XIcon from '@lucide/svelte/icons/x';

	const appContext = useAppContext();
	const convex = useConvexClient();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);

	type DayRoster = FunctionReturnType<typeof api.checkIns.getDayRoster>;
	type RosterBooking = DayRoster['bookings'][number];
	type RosterPerson = RosterBooking['people'][number];

	let selectedDate = $state(toDateInputValue(new Date()));
	let selectedDateValue = $state<DateValue | undefined>();
	let dateCalendarOpen = $state(false);
	let searchQuery = $state('');
	// Optimistic arrival state keyed by `${submissionId}:${participantIndex}`.
	let pendingArrivals = $state<Record<string, boolean>>({});

	const dayRange = $derived(dayRangeForDate(selectedDate));
	const isToday = $derived(selectedDate === toDateInputValue(new Date()));
	const rosterQuery = useProtectedQuery(
		api.checkIns.getDayRoster,
		() =>
			currentWorkspace
				? {
						workspaceId: currentWorkspace.workspaceId,
						dayStartAt: dayRange.startAt,
						dayEndAt: dayRange.endAt
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);

	const roster = $derived((rosterQuery.data ?? null) as DayRoster | null);
	const isInitialLoading = $derived((rosterQuery.isLoading || appContext.isLoading) && !roster);
	const normalizedSearch = $derived(normalize(searchQuery));

	const visibleBookings = $derived.by(() => {
		if (!roster) return [];
		return roster.bookings
			.map((booking) => {
				if (!normalizedSearch) return booking;
				const bookingMatches = [
					booking.activityName,
					booking.leadCustomerName,
					booking.providerBookingId
				].some((value) => normalize(value).includes(normalizedSearch));
				if (bookingMatches) return booking;
				return {
					...booking,
					people: booking.people.filter((person) =>
						normalize(person.name).includes(normalizedSearch)
					)
				};
			})
			.filter((booking) => !normalizedSearch || booking.people.length > 0);
	});

	const bookingGroups = $derived.by(() => {
		const groups: Array<{ key: string; label: string; bookings: RosterBooking[] }> = [];
		for (const booking of visibleBookings) {
			const label = formatTime(booking.startAt, booking.startTime) ?? 'No start time';
			const last = groups.at(-1);
			if (last && last.label === label) {
				last.bookings.push(booking);
			} else {
				groups.push({ key: `${label}-${booking.bookingId}`, label, bookings: [booking] });
			}
		}
		return groups;
	});

	const visibleWalkIns = $derived.by(() => {
		if (!roster) return [];
		return roster.walkIns
			.map((walkIn) => ({
				...walkIn,
				people: normalizedSearch
					? walkIn.people.filter((person) => normalize(person.name).includes(normalizedSearch))
					: walkIn.people
			}))
			.filter((walkIn) => walkIn.people.length > 0);
	});

	const kpis = $derived([
		{ label: 'Expected', value: roster?.totals.expected ?? null, tone: 'default' },
		{ label: 'Signed', value: roster?.totals.signed ?? null, tone: 'default' },
		{ label: 'Arrived', value: roster?.totals.arrived ?? null, tone: 'success' },
		{
			label: 'Unsigned',
			value: roster?.totals.unsigned ?? null,
			tone: (roster?.totals.unsigned ?? 0) > 0 ? 'warning' : 'default'
		}
	] as const);

	$effect(() => {
		if (selectedDateValue?.toString() === selectedDate) return;
		selectedDateValue = dateValueFromString(selectedDate);
	});

	$effect(() => {
		const nextDate = selectedDateValue?.toString();
		if (!nextDate || nextDate === selectedDate) return;
		selectedDate = nextDate;
		dateCalendarOpen = false;
	});

	function normalize(value?: string | null) {
		return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
	}

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

	function dateValueFromString(value: string) {
		return /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDate(value) : undefined;
	}

	function dayRangeForDate(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return {
			startAt: new Date(year, month - 1, day).getTime(),
			endAt: new Date(year, month - 1, day + 1).getTime()
		};
	}

	function changeDate(days: number) {
		const [year, month, day] = selectedDate.split('-').map(Number);
		selectedDate = toDateInputValue(new Date(year, month - 1, day + days));
	}

	function goToday() {
		selectedDate = toDateInputValue(new Date());
	}

	function formatSelectedDate(value: string) {
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		}).format(dateFromInputValue(value));
	}

	function formatTime(startAt: number | null, startTime?: string | null) {
		const timestamp = startAt ?? (startTime ? Date.parse(startTime) : Number.NaN);
		if (!Number.isFinite(timestamp)) return null;
		return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
			new Date(timestamp)
		);
	}

	function personKey(person: Pick<RosterPerson, 'submissionId' | 'participantIndex'>) {
		return `${person.submissionId}:${person.participantIndex}`;
	}

	function isArrived(person: RosterPerson) {
		const key = personKey(person);
		return key in pendingArrivals ? pendingArrivals[key] : person.checkedInAt !== null;
	}

	function clearPending(key: string) {
		const next = { ...pendingArrivals };
		delete next[key];
		pendingArrivals = next;
	}

	async function toggleArrived(person: RosterPerson) {
		const workspaceId = currentWorkspace?.workspaceId;
		if (!workspaceId) return;
		const key = personKey(person);
		const arrived = !isArrived(person);
		pendingArrivals = { ...pendingArrivals, [key]: arrived };
		try {
			await convex.mutation(api.checkIns.setParticipantArrived, {
				workspaceId,
				submissionId: person.submissionId as Id<'waiver_submissions'>,
				participantIndex: person.participantIndex,
				arrived
			});
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to update check-in. Please try again.'));
		} finally {
			clearPending(key);
		}
	}

	function kpiToneClass(tone: 'default' | 'success' | 'warning') {
		if (tone === 'success') return 'text-emerald-600 dark:text-emerald-400';
		if (tone === 'warning') return 'text-amber-600 dark:text-amber-400';
		return 'text-foreground';
	}
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Check-in | Waiver Director</title>
</svelte:head>

{#snippet rosterRows(people: RosterPerson[])}
	<ul class="divide-y divide-border">
		{#each people as person (personKey(person))}
			{@const arrived = isArrived(person)}
			<li class="flex items-center justify-between gap-3 px-4 py-2.5">
				<div class="min-w-0">
					<p class={cn('truncate text-sm font-medium', arrived && 'text-muted-foreground')}>
						{person.name}
					</p>
					<p class="text-xs text-muted-foreground">
						{person.kind === 'signer' ? 'Signer' : 'Minor'}
					</p>
				</div>
				<Button
					size="lg"
					variant={arrived ? 'default' : 'outline'}
					aria-pressed={arrived}
					aria-label={arrived
						? `Mark ${person.name} as not arrived`
						: `Mark ${person.name} arrived`}
					onclick={() => toggleArrived(person)}
					class="min-w-28"
				>
					{#if arrived}
						<CircleCheckIcon aria-hidden="true" />
						Arrived
					{:else}
						<CircleIcon aria-hidden="true" />
						Not arrived
					{/if}
				</Button>
			</li>
		{/each}
	</ul>
{/snippet}

<DataTablePage>
	<h1 class="sr-only">Check-in</h1>
	<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<div class="relative w-full lg:max-w-md">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				placeholder="Search by participant, activity, or booking number"
				bind:value={searchQuery}
				class="h-9 w-full rounded-lg border border-input bg-background/60 pr-10 pl-11 text-sm shadow-xs transition-all placeholder:text-muted-foreground/70 hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
				aria-label="Search check-in roster"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					class="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
					aria-label="Clear search"
				>
					<XIcon class="size-3.5" aria-hidden="true" />
				</button>
			{/if}
		</div>

		<div
			class="flex h-9 w-full flex-nowrap items-center gap-1 rounded-lg border border-border bg-card/40 p-px lg:w-auto lg:shrink-0"
		>
			<Button
				size="icon-lg"
				variant="ghost"
				onclick={() => changeDate(-1)}
				aria-label="Previous day"
			>
				<ChevronLeftIcon class="size-4" aria-hidden="true" />
			</Button>
			<Popover bind:open={dateCalendarOpen}>
				<PopoverTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							type="button"
							variant="outline"
							size="lg"
							class="flex-1 justify-start gap-2 bg-background text-sm font-normal lg:w-44 lg:flex-none"
							title={formatSelectedDate(selectedDate)}
						>
							<CalendarDaysIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span class="truncate">{formatSelectedDate(selectedDate)}</span>
						</Button>
					{/snippet}
				</PopoverTrigger>
				<PopoverContent align="end" class="w-auto p-0">
					<Calendar
						type="single"
						bind:value={selectedDateValue}
						class="rounded-md border shadow-sm"
						captionLayout="dropdown"
						weekdayFormat="narrow"
					/>
				</PopoverContent>
			</Popover>
			<Button
				size="lg"
				variant={isToday ? 'secondary' : 'ghost'}
				onclick={goToday}
				disabled={isToday}
			>
				Today
			</Button>
			<Button size="icon-lg" variant="ghost" onclick={() => changeDate(1)} aria-label="Next day">
				<ChevronRightIcon class="size-4" aria-hidden="true" />
			</Button>
		</div>
	</div>

	<dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each kpis as kpi (kpi.label)}
			<div class="rounded-xl border border-border bg-card/40 px-4 py-3">
				<dt class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
					{kpi.label}
				</dt>
				<dd class={cn('mt-1 text-2xl font-semibold tabular-nums', kpiToneClass(kpi.tone))}>
					{#if kpi.value === null}
						<Skeleton class="h-7 w-10" />
					{:else}
						{kpi.value}
					{/if}
				</dd>
			</div>
		{/each}
	</dl>

	<div class="flex min-h-0 flex-1 flex-col">
		{#if isInitialLoading}
			<DataTableShell viewportClass="space-y-3 p-4">
				{#each [0, 1, 2] as index (index)}
					<div class="space-y-2 rounded-xl border border-border p-4">
						<Skeleton class="h-4 w-24" />
						<Skeleton class="h-5 w-48" />
						<Skeleton class="h-8 w-full" />
					</div>
				{/each}
			</DataTableShell>
		{:else if !currentWorkspace}
			<DataTableShell>
				<DataTableEmptyState
					icon={CalendarOffIcon}
					title="Workspace not found"
					description="Choose a workspace to check in participants."
				/>
			</DataTableShell>
		{:else if bookingGroups.length === 0 && visibleWalkIns.length === 0}
			<DataTableShell>
				<DataTableEmptyState
					icon={CalendarOffIcon}
					title={normalizedSearch ? 'No matching participants' : 'Nobody to check in'}
					description={normalizedSearch
						? `Adjust your search for ${formatSelectedDate(selectedDate)}.`
						: 'No bookings or walk-in signatures for this day.'}
				/>
			</DataTableShell>
		{:else}
			<DataTableShell class="border-0 bg-transparent" viewportClass="space-y-6">
				{#if roster?.hasMoreBookings || roster?.hasMoreWalkIns}
					<p class="text-xs text-muted-foreground" role="status">
						This day has more than 200 bookings or 300 walk-ins, so only the earliest ones are shown
						here.
					</p>
				{/if}

				{#each bookingGroups as group (group.key)}
					<section class="space-y-3" aria-label="Bookings at {group.label}">
						<h2 class="text-sm font-semibold text-muted-foreground tabular-nums">{group.label}</h2>
						{#each group.bookings as booking (booking.bookingId)}
							{@const isCanceled = booking.status === 'canceled'}
							<article
								class={cn(
									'overflow-hidden rounded-xl border border-border bg-card/30',
									isCanceled && 'opacity-60'
								)}
							>
								<header
									class="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3"
								>
									<div class="min-w-0">
										<p
											class={cn(
												'truncate text-base font-semibold',
												isCanceled && 'line-through decoration-muted-foreground/60'
											)}
										>
											{booking.activityName}
										</p>
										<p class="truncate text-sm text-muted-foreground">
											{booking.leadCustomerName ?? 'Unknown customer'} · #{booking.providerBookingId}
										</p>
									</div>
									<div class="flex flex-wrap items-center gap-1.5">
										{#if isCanceled}
											<Badge variant="secondary">Canceled</Badge>
										{/if}
										{#if booking.unsignedCount > 0}
											<Badge
												class="bg-amber-500/15 text-amber-700 dark:text-amber-400"
												title="Participants on this booking without a signed waiver"
											>
												<TriangleAlertIcon aria-hidden="true" />
												{booking.unsignedCount} unsigned
											</Badge>
										{/if}
										<span class="text-xs text-muted-foreground tabular-nums">
											{booking.people.filter((person) => isArrived(person)).length} / {booking
												.people.length} arrived · {booking.participantCount} booked
										</span>
									</div>
								</header>
								{#if booking.people.length === 0}
									<p class="px-4 py-3 text-sm text-muted-foreground">No signed waivers yet.</p>
								{:else}
									{@render rosterRows(booking.people)}
								{/if}
							</article>
						{/each}
					</section>
				{/each}

				{#if visibleWalkIns.length > 0}
					<section class="space-y-3" aria-label="Walk-ins">
						<h2 class="text-sm font-semibold text-muted-foreground">Walk-ins</h2>
						<div class="overflow-hidden rounded-xl border border-border bg-card/30">
							{@render rosterRows(visibleWalkIns.flatMap((walkIn) => walkIn.people))}
						</div>
					</section>
				{/if}
			</DataTableShell>
		{/if}
	</div>
</DataTablePage>
