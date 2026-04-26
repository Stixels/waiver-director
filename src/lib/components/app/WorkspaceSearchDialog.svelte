<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import type { FunctionReturnType } from 'convex/server';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';
	import { tick } from 'svelte';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import SearchIcon from '@lucide/svelte/icons/search';
	import UserRoundIcon from '@lucide/svelte/icons/user-round';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'> | null;
		workspaceSlug: string | null;
		onNavigate?: () => void;
	}

	let { open = $bindable(), workspaceId, workspaceSlug, onNavigate }: Props = $props();

	let searchInput = $state('');
	let debouncedSearchInput = $state('');
	let searchInputElement = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!open) return;
		void tick().then(() => searchInputElement?.focus());
	});

	$effect(() => {
		const nextSearchInput = searchInput.trim();
		const timeout = setTimeout(() => {
			debouncedSearchInput = nextSearchInput;
		}, 180);
		return () => clearTimeout(timeout);
	});

	const searchResultsQuery = useProtectedQuery(
		api.search.globalWorkspaceSearch,
		() =>
			open && workspaceId && debouncedSearchInput
				? {
						workspaceId,
						searchQuery: debouncedSearchInput
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);

	type SearchResults = FunctionReturnType<typeof api.search.globalWorkspaceSearch>;
	type BookingResult = SearchResults['bookings'][number];
	type SearchTarget = {
		pathname: `/app/${string}`;
		query: string;
	};

	const searchResults = $derived((searchResultsQuery.data ?? null) as SearchResults | null);
	const customerResults = $derived(searchResults?.customers ?? []);
	const bookingResults = $derived(searchResults?.bookings ?? []);
	const hasQuery = $derived(searchInput.trim().length > 0);
	const isSearching = $derived(searchResultsQuery.isLoading && debouncedSearchInput.length > 0);
	const hasResults = $derived(customerResults.length > 0 || bookingResults.length > 0);

	function queryString(entries: Array<[string, string | null]>) {
		return entries
			.filter((entry): entry is [string, string] => entry[1] !== null)
			.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
			.join('&');
	}

	function bookingDateValue(booking: BookingResult) {
		if (booking.serviceDate) return booking.serviceDate;
		if (!booking.startTime) return null;
		const date = new Date(booking.startTime);
		if (Number.isNaN(date.getTime())) return null;
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatTimestamp(
		timestamp: string | number | null,
		options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
	) {
		if (timestamp === null) return null;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat('en-US', options).format(date);
	}

	function bookingTarget(booking: BookingResult) {
		if (!workspaceSlug) return null;
		return {
			pathname: `/app/${workspaceSlug}/bookings` as `/app/${string}`,
			query: queryString([
				['bookingId', booking.bookingId],
				['date', bookingDateValue(booking)]
			])
		};
	}

	function customerTarget(customerId: Id<'customers'>) {
		if (!workspaceSlug) return null;
		return {
			pathname: `/app/${workspaceSlug}/customers` as `/app/${string}`,
			query: queryString([['customerId', customerId]])
		};
	}

	async function goToResult(target: SearchTarget | null) {
		if (!target) return;
		open = false;
		onNavigate?.();
		await goto(resolve(`${target.pathname}?${target.query}` as Pathname), { noScroll: true });
	}
</script>

<Dialog bind:open>
	<DialogContent class="w-[calc(100vw-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-xl">
		<DialogHeader class="border-b border-border px-5 py-4">
			<DialogTitle>Search workspace</DialogTitle>
			<DialogDescription>Find customers and bookings in this workspace.</DialogDescription>
		</DialogHeader>

		<div class="border-b border-border px-4 py-3">
			<label class="relative block">
				<SearchIcon
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<input
					bind:this={searchInputElement}
					type="search"
					bind:value={searchInput}
					placeholder="Search by name, email, activity, or booking number"
					class="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-10 text-sm transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
					aria-label="Search customers and bookings"
				/>
			</label>
		</div>

		<div class="max-h-[min(34rem,calc(100vh-14rem))] overflow-y-auto px-2 py-2">
			{#if !hasQuery}
				<div class="px-3 py-10 text-center text-sm text-muted-foreground">
					Enter a customer, email, activity, or booking number.
				</div>
			{:else if isSearching && !searchResults}
				<div class="space-y-2 p-2">
					{#each [0, 1, 2, 3] as item (item)}
						<div class="flex items-center gap-3 rounded-lg px-2 py-2.5">
							<Skeleton class="size-8 rounded-md" />
							<div class="min-w-0 flex-1 space-y-1.5">
								<Skeleton class="h-3.5 w-44" />
								<Skeleton class="h-3 w-56" />
							</div>
						</div>
					{/each}
				</div>
			{:else if !hasResults}
				<div class="px-3 py-10 text-center text-sm text-muted-foreground">
					No customers or bookings found.
				</div>
			{:else}
				{#if customerResults.length > 0}
					<section class="py-1">
						<h3
							class="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase"
						>
							Customers
						</h3>
						<div class="space-y-0.5">
							{#each customerResults as customer (customer.customerId)}
								<button
									type="button"
									class="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
									onclick={() => void goToResult(customerTarget(customer.customerId))}
								>
									<span
										class="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground"
									>
										<UserRoundIcon class="size-4" aria-hidden="true" />
									</span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-medium">{customer.displayName}</span>
										<span class="block truncate text-xs text-muted-foreground">
											{customer.primaryEmail}
										</span>
									</span>
									<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
										{customer.visitCount}
										{customer.visitCount === 1 ? 'visit' : 'visits'}
									</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}

				{#if bookingResults.length > 0}
					<section class="py-1">
						<h3
							class="px-2 py-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase"
						>
							Bookings
						</h3>
						<div class="space-y-0.5">
							{#each bookingResults as booking (booking.bookingId)}
								{@const bookingStart = formatTimestamp(booking.startTime, {
									dateStyle: 'medium',
									timeStyle: 'short'
								})}
								<button
									type="button"
									class="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
									onclick={() => void goToResult(bookingTarget(booking))}
								>
									<span
										class={cn(
											'flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground',
											booking.status === 'canceled' && 'opacity-60'
										)}
									>
										<CalendarDaysIcon class="size-4" aria-hidden="true" />
									</span>
									<span class="min-w-0 flex-1">
										<span
											class={cn(
												'block truncate text-sm font-medium',
												booking.status === 'canceled' &&
													'line-through decoration-muted-foreground/60'
											)}
										>
											{booking.activityName}
										</span>
										<span class="block truncate text-xs text-muted-foreground">
											{booking.leadCustomerName ?? 'Unknown customer'}
											{#if bookingStart}
												· {bookingStart}
											{/if}
										</span>
									</span>
									<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
										#{booking.providerBookingId}
									</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		</div>
	</DialogContent>
</Dialog>
