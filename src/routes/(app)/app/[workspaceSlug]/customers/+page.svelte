<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { page } from '$app/state';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import SubmissionDetailSheet from '$lib/components/waivers/SubmissionDetailSheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { formatBookingTimestamp } from '$lib/utils/date';
	import { parseConvexId, queryString } from '$lib/utils/url';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import MailIcon from '@lucide/svelte/icons/mail';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import UserRoundIcon from '@lucide/svelte/icons/user-round';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';
	import XIcon from '@lucide/svelte/icons/x';

	const PAGE_SIZE = 20;

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);
	const initialQuery = initialSearchQuery();

	let cursor = $state<string | null>(null);
	let previousCursors = $state<(string | null)[]>([]);
	let searchInput = $state(initialQuery);
	let searchQuery = $state(initialQuery);
	let lastWorkspaceId = $state<string | null>(null);
	let lastSearchQuery = initialQuery;
	let lastAppliedSearchQuery = initialQuery;
	let lastAppliedCustomerId: string | null = null;
	let lastOpenedSubmissionKey: string | null = null;
	let isClearingWorkspaceUrl = $state(false);
	let selectedCustomerId = $state<Id<'customers'> | null>(null);
	let detailOpen = $state(false);
	let selectedSubmissionId = $state<Id<'waiver_submissions'> | null>(null);
	let now = $state(Date.now());

	onMount(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 60_000);
		return () => clearInterval(interval);
	});

	const customersQuery = useProtectedQuery(
		api.customers.listWorkspaceCustomers,
		() =>
			currentWorkspace
				? {
						workspaceId: currentWorkspace.workspaceId,
						paginationOpts: {
							numItems: PAGE_SIZE,
							cursor
						},
						searchQuery
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);

	type CustomerPage = FunctionReturnType<typeof api.customers.listWorkspaceCustomers>;
	type CustomerSummary = CustomerPage['customers'][number];
	const customerPage = $derived((customersQuery.data ?? null) as CustomerPage | null);
	const customers = $derived((customerPage?.customers ?? []) as CustomerSummary[]);
	const isLoadingCustomers = $derived(customersQuery.isLoading || appContext.isLoading);
	const totalCount = $derived(customerPage?.totalCount ?? null);
	const hasPreviousPage = $derived(previousCursors.length > 0);
	const currentPage = $derived(previousCursors.length + 1);
	const customerIdParam = $derived(
		parseConvexId<'customers'>(page.url.searchParams.get('customerId'))
	);
	const submissionIdParam = $derived(
		parseConvexId<'waiver_submissions'>(page.url.searchParams.get('submissionId'))
	);
	const searchQueryParam = $derived(page.url.searchParams.get('q')?.trim() ?? '');

	const customerDetailQuery = useProtectedQuery(
		api.customers.getCustomerDetail,
		() =>
			currentWorkspace && selectedCustomerId
				? {
						workspaceId: currentWorkspace.workspaceId,
						customerId: selectedCustomerId
					}
				: 'skip',
		() => ({ keepPreviousData: false })
	);

	type CustomerDetail = FunctionReturnType<typeof api.customers.getCustomerDetail>;
	const customerDetail = $derived((customerDetailQuery.data ?? null) as CustomerDetail | null);
	const selectedCustomerDetail = $derived(
		selectedCustomerId && customerDetail?.customer.customerId === selectedCustomerId
			? customerDetail
			: null
	);
	const isLoadingDetail = $derived(customerDetailQuery.isLoading && Boolean(selectedCustomerId));

	function initialSearchQuery() {
		return page.url.searchParams.get('q')?.trim() ?? '';
	}

	async function updateCustomersUrl(args: {
		searchQuery?: string;
		customerId?: Id<'customers'> | null;
		submissionId?: Id<'waiver_submissions'> | null;
		replaceState?: boolean;
	}) {
		const nextSearchQuery = args.searchQuery ?? searchQuery;
		lastAppliedSearchQuery = nextSearchQuery;
		lastAppliedCustomerId = args.customerId ?? null;
		lastOpenedSubmissionKey = args.submissionId ?? null;

		const query = queryString([
			['q', nextSearchQuery],
			['customerId', args.customerId ?? null],
			['submissionId', args.submissionId ?? null]
		]);
		const pathname = `/app/${page.params.workspaceSlug}/customers` as `/app/${string}/customers`;
		const href = (query ? `${pathname}?${query}` : pathname) as
			| `/app/${string}/customers`
			| `/app/${string}/customers?${string}`;

		await goto(resolve(href), {
			replaceState: args.replaceState ?? true,
			noScroll: true,
			keepFocus: true
		});
	}

	$effect(() => {
		const workspaceId = currentWorkspace?.workspaceId ?? null;
		if (!workspaceId) {
			cursor = null;
			previousCursors = [];
			selectedCustomerId = null;
			selectedSubmissionId = null;
			detailOpen = false;
			return;
		}
		if (workspaceId === lastWorkspaceId) return;
		const isWorkspaceChange = lastWorkspaceId !== null;
		lastWorkspaceId = workspaceId;
		cursor = null;
		previousCursors = [];
		if (isWorkspaceChange) {
			searchInput = '';
			searchQuery = '';
			lastSearchQuery = '';
		}
		lastAppliedSearchQuery = isWorkspaceChange ? '' : searchQuery;
		lastAppliedCustomerId = null;
		lastOpenedSubmissionKey = null;
		selectedCustomerId = null;
		selectedSubmissionId = null;
		detailOpen = false;
		if (isWorkspaceChange) {
			isClearingWorkspaceUrl = true;
			void updateCustomersUrl({
				searchQuery: '',
				customerId: null,
				submissionId: null,
				replaceState: true
			}).finally(() => {
				isClearingWorkspaceUrl = false;
			});
		}
	});

	$effect(() => {
		if (searchQuery === lastSearchQuery) return;
		lastSearchQuery = searchQuery;
		cursor = null;
		previousCursors = [];
		selectedCustomerId = null;
		selectedSubmissionId = null;
		detailOpen = false;
		void updateCustomersUrl({
			searchQuery,
			customerId: null,
			submissionId: null,
			replaceState: true
		});
	});

	$effect(() => {
		const nextSearchQuery = searchInput.trim();
		const timeout = setTimeout(() => {
			searchQuery = nextSearchQuery;
		}, 200);
		return () => clearTimeout(timeout);
	});

	$effect(() => {
		if (isClearingWorkspaceUrl) return;
		if (searchQueryParam === lastAppliedSearchQuery) return;
		lastAppliedSearchQuery = searchQueryParam;
		lastSearchQuery = searchQueryParam;
		searchInput = searchQueryParam;
		searchQuery = searchQueryParam;
		cursor = null;
		previousCursors = [];
	});

	$effect(() => {
		if (isClearingWorkspaceUrl) return;
		if (!customerIdParam) {
			lastAppliedCustomerId = null;
			return;
		}
		if (customerIdParam === lastAppliedCustomerId) return;
		lastAppliedCustomerId = customerIdParam;
		selectedCustomerId = customerIdParam;
	});

	$effect(() => {
		if (isClearingWorkspaceUrl) return;
		if (!submissionIdParam) {
			if (detailOpen) detailOpen = false;
			lastOpenedSubmissionKey = null;
			return;
		}
		if (submissionIdParam === lastOpenedSubmissionKey) return;
		lastOpenedSubmissionKey = submissionIdParam;
		selectedSubmissionId = submissionIdParam;
		detailOpen = true;
	});

	$effect(() => {
		if (detailOpen || !submissionIdParam) return;
		void updateCustomersUrl({
			searchQuery,
			customerId: selectedCustomerId,
			submissionId: null,
			replaceState: true
		});
	});

	function formatTimestamp(
		timestamp: number,
		options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
	) {
		return new Intl.DateTimeFormat('en-US', options).format(new Date(timestamp));
	}

	function initialsFor(name: string) {
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '?';
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}

	type FrequencyTone = 'new' | 'returning' | 'regular' | 'vip';
	type Frequency = { label: string; tone: FrequencyTone };

	function frequencyTier(visitCount: number): Frequency {
		if (visitCount >= 6) return { label: 'VIP', tone: 'vip' };
		if (visitCount >= 4) return { label: 'Regular', tone: 'regular' };
		if (visitCount >= 2) return { label: 'Returning', tone: 'returning' };
		return { label: 'New', tone: 'new' };
	}

	function frequencyClass(tone: FrequencyTone) {
		if (tone === 'vip') return 'bg-amber-500/15 text-amber-800 dark:text-amber-400';
		if (tone === 'regular') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400';
		if (tone === 'returning') return 'bg-violet-500/15 text-violet-800 dark:text-violet-400';
		return 'bg-muted text-muted-foreground';
	}

	function relativeFromNow(timestamp: number) {
		const diffMs = now - timestamp;
		if (diffMs < 60_000) return 'Just now';
		const diffMin = Math.floor(diffMs / 60_000);
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr}h ago`;
		const diffDay = Math.floor(diffHr / 24);
		if (diffDay < 7) return `${diffDay}d ago`;
		const diffWk = Math.floor(diffDay / 7);
		if (diffWk < 5) return `${diffWk}w ago`;
		const diffYr = Math.floor(diffDay / 365);
		if (diffYr >= 1) return `${diffYr}y ago`;
		const diffMo = Math.floor(diffDay / 30);
		return `${diffMo}mo ago`;
	}

	function selectCustomer(customerId: Id<'customers'>) {
		selectedCustomerId = customerId;
		selectedSubmissionId = null;
		detailOpen = false;
		void updateCustomersUrl({
			searchQuery,
			customerId,
			submissionId: null,
			replaceState: false
		});
	}

	function openSubmission(submissionId: Id<'waiver_submissions'>) {
		selectedSubmissionId = submissionId;
		detailOpen = true;
		void updateCustomersUrl({
			searchQuery,
			customerId: selectedCustomerId,
			submissionId,
			replaceState: false
		});
	}

	function goPreviousPage() {
		if (previousCursors.length === 0) return;
		const nextPreviousCursors = previousCursors.slice(0, -1);
		cursor = previousCursors[previousCursors.length - 1];
		previousCursors = nextPreviousCursors;
	}

	function goNextPage() {
		if (!customerPage || customerPage.isDone) return;
		previousCursors = [...previousCursors, cursor];
		cursor = customerPage.continueCursor;
	}

	function clearSearch() {
		if (!searchInput && !searchQuery) return;
		searchInput = '';
		searchQuery = '';
	}
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Customers | Waiver Director</title>
</svelte:head>

{#if selectedSubmissionId && currentWorkspace}
	<SubmissionDetailSheet
		bind:open={detailOpen}
		workspaceId={currentWorkspace.workspaceId}
		submissionId={selectedSubmissionId}
	/>
{/if}

<PageHeader title="Signer contacts" subtitle="Track waiver signers and their repeat-visit history.">
	{#snippet actions()}
		<span
			class="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/40 px-3 text-xs font-medium text-muted-foreground"
		>
			<UsersRoundIcon class="size-3.5" aria-hidden="true" />
			{#if isLoadingCustomers && !customerPage}
				<Skeleton class="h-3 w-10" />
			{:else}
				<span class="text-foreground tabular-nums">{totalCount ?? 0}</span>
				{(totalCount ?? 0) === 1 ? 'customer' : 'customers'}
			{/if}
		</span>
	{/snippet}
	{#snippet meta()}
		<div class="relative w-full lg:max-w-md">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				placeholder="Search by name or email"
				bind:value={searchInput}
				class="h-9 w-full rounded-lg border border-input bg-background/60 pr-10 pl-11 text-sm shadow-xs transition-all placeholder:text-muted-foreground/70 hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
				aria-label="Search customers"
			/>
			{#if searchInput}
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
	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
		<section class="min-w-0 space-y-4">
			{#if isLoadingCustomers}
				<div class="overflow-hidden rounded-xl border border-border">
					{#each [0, 1, 2, 3, 4, 5] as item (item)}
						<div
							class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
						>
							<Skeleton class="size-9 rounded-full" />
							<div class="min-w-0 space-y-1.5">
								<Skeleton class="h-4 w-40" />
								<Skeleton class="h-3 w-52" />
							</div>
							<div class="space-y-1.5 text-right">
								<Skeleton class="ml-auto h-4 w-16" />
								<Skeleton class="ml-auto h-3 w-20" />
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
			{:else if customers.length === 0}
				<div
					class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/30 px-4 py-16 text-center"
				>
					<div
						class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
					>
						<UsersRoundIcon class="size-5" aria-hidden="true" />
					</div>
					<div class="space-y-1">
						<p class="text-sm font-medium">
							{searchQuery.trim() ? 'No matching customers' : 'No customers yet'}
						</p>
						<p class="text-xs text-muted-foreground">
							{searchQuery.trim()
								? 'Try a different name or email.'
								: 'Adult signers appear here after they submit a waiver.'}
						</p>
					</div>
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border border-border">
					{#each customers as customer (customer.customerId)}
						{@const tier = frequencyTier(customer.visitCount)}
						{@const isSelected = selectedCustomerId === customer.customerId}
						<button
							type="button"
							class={cn(
								'group relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none',
								isSelected && 'bg-muted/60'
							)}
							onclick={() => selectCustomer(customer.customerId)}
							aria-current={isSelected ? 'true' : undefined}
						>
							{#if isSelected}
								<span class="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true"></span>
							{/if}
							<div
								class="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold tracking-tight text-foreground"
							>
								{initialsFor(customer.displayName)}
							</div>
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<p class="truncate text-sm font-medium">{customer.displayName}</p>
									<span
										class={cn(
											'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
											frequencyClass(tier.tone)
										)}
									>
										{tier.label}
									</span>
								</div>
								<p class="mt-0.5 truncate text-xs text-muted-foreground">
									{customer.primaryEmail}
								</p>
							</div>
							<div class="hidden text-right sm:block">
								<p class="text-sm font-semibold tabular-nums">
									{customer.visitCount}
									<span class="text-xs font-normal text-muted-foreground">
										{customer.visitCount === 1 ? 'visit' : 'visits'}
									</span>
								</p>
								<p class="mt-0.5 text-xs text-muted-foreground tabular-nums">
									{relativeFromNow(customer.lastSeenAt)}
								</p>
							</div>
							<ChevronRightIcon
								class="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground sm:hidden"
								aria-hidden="true"
							/>
						</button>
					{/each}
				</div>
			{/if}

			{#if customerPage && (hasPreviousPage || !customerPage.isDone)}
				<div class="flex items-center justify-between gap-3">
					<p class="text-xs text-muted-foreground tabular-nums">
						Page {currentPage}
					</p>
					<div class="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							disabled={!hasPreviousPage}
							onclick={goPreviousPage}
						>
							<ChevronLeftIcon class="size-4" aria-hidden="true" />
							Previous
						</Button>
						<Button size="sm" variant="outline" disabled={customerPage.isDone} onclick={goNextPage}>
							Next
							<ChevronRightIcon class="size-4" aria-hidden="true" />
						</Button>
					</div>
				</div>
			{/if}
		</section>

		<aside class="min-w-0 space-y-4">
			{#if isLoadingDetail}
				<div class="overflow-hidden rounded-xl border border-border bg-card/30">
					<div class="space-y-4 p-4">
						<div class="flex items-start gap-3">
							<Skeleton class="size-10 rounded-full" />
							<div class="min-w-0 flex-1 space-y-1.5">
								<Skeleton class="h-4 w-36" />
								<Skeleton class="h-3 w-44" />
							</div>
							<Skeleton class="h-4 w-14 rounded-full" />
						</div>
						<div class="space-y-2 border-t border-border pt-3">
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-full" />
						</div>
					</div>
				</div>
				<div class="rounded-xl border border-border">
					<div class="border-b border-border px-5 py-4">
						<Skeleton class="h-4 w-28" />
					</div>
					<div class="space-y-3 p-5">
						<Skeleton class="h-12 w-full" />
						<Skeleton class="h-12 w-full" />
						<Skeleton class="h-12 w-full" />
					</div>
				</div>
			{:else if selectedCustomerDetail}
				{@const tier = frequencyTier(selectedCustomerDetail.customer.visitCount)}
				<div class="rounded-xl border border-border bg-card/30">
					<div class="space-y-4 p-4">
						<div class="flex items-start gap-3">
							<div
								class="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground"
							>
								{initialsFor(selectedCustomerDetail.customer.displayName)}
							</div>
							<div class="min-w-0 flex-1">
								<h2 class="truncate text-base font-semibold tracking-tight">
									{selectedCustomerDetail.customer.displayName}
								</h2>
								<p class="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
									<MailIcon class="size-3 shrink-0" aria-hidden="true" />
									<span class="truncate">{selectedCustomerDetail.customer.primaryEmail}</span>
								</p>
							</div>
							<span
								class={cn(
									'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
									frequencyClass(tier.tone)
								)}
							>
								{#if tier.tone === 'vip'}
									<SparklesIcon class="size-3" aria-hidden="true" />
								{/if}
								{tier.label}
							</span>
						</div>

						<dl class="space-y-2 border-t border-border pt-3 text-sm">
							<div class="flex items-baseline justify-between gap-3">
								<dt class="text-xs text-muted-foreground">Visits</dt>
								<dd class="font-medium tabular-nums">
									{selectedCustomerDetail.customer.visitCount}
								</dd>
							</div>
							<div class="flex items-baseline justify-between gap-3">
								<dt class="text-xs text-muted-foreground">First seen</dt>
								<dd class="font-medium">
									{formatTimestamp(selectedCustomerDetail.customer.firstSeenAt)}
								</dd>
							</div>
							<div class="flex items-baseline justify-between gap-3">
								<dt class="text-xs text-muted-foreground">Last seen</dt>
								<dd class="font-medium">
									<span class="ml-1 text-xs font-normal text-muted-foreground tabular-nums">
										{relativeFromNow(selectedCustomerDetail.customer.lastSeenAt)} ·
									</span>
									{formatTimestamp(selectedCustomerDetail.customer.lastSeenAt)}
								</dd>
							</div>
						</dl>
					</div>
				</div>

				<div class="overflow-hidden rounded-xl border border-border">
					<div class="flex items-center justify-between border-b border-border px-4 py-3">
						<h2 class="text-sm font-semibold tracking-tight">Visit history</h2>
						<span class="text-xs text-muted-foreground tabular-nums">
							{selectedCustomerDetail.visits.length}
							{selectedCustomerDetail.visits.length === 1 ? 'record' : 'records'}
						</span>
					</div>
					{#if selectedCustomerDetail.visits.length === 0}
						<div class="px-4 py-8 text-center text-sm text-muted-foreground">No visits found.</div>
					{:else}
						<ul class="divide-y divide-border">
							{#each selectedCustomerDetail.visits as visit (visit.submissionId)}
								{@const dateLabel = visit.booking?.startTime
									? formatBookingTimestamp(visit.booking.startTime, {
											dateStyle: 'medium',
											timeStyle: 'short'
										})
									: formatTimestamp(visit.submittedAt, {
											dateStyle: 'medium',
											timeStyle: 'short'
										})}
								<li>
									<button
										type="button"
										class="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
										onclick={() => openSubmission(visit.submissionId)}
									>
										<div
											class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary"
										>
											<CalendarClockIcon class="size-3" aria-hidden="true" />
										</div>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">
												{visit.booking?.activityName ?? 'General waiver'}
											</p>
											<p class="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
												{dateLabel}
											</p>
											{#if visit.minorCount > 0}
												<p
													class="mt-1 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground tabular-nums"
												>
													+{visit.minorCount}
													{visit.minorCount === 1 ? 'minor' : 'minors'}
												</p>
											{/if}
										</div>
										<ChevronRightIcon
											class="mt-0.5 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
											aria-hidden="true"
										/>
									</button>
								</li>
							{/each}
						</ul>
						{#if selectedCustomerDetail.hasMore}
							<p class="border-t border-border px-4 py-3 text-xs text-muted-foreground">
								Showing the most recent {selectedCustomerDetail.visits.length} visits.
							</p>
						{/if}
					{/if}
				</div>
			{:else}
				<div
					class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/30 px-4 py-12 text-center"
				>
					<div
						class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
					>
						<UserRoundIcon class="size-5" aria-hidden="true" />
					</div>
					<div class="space-y-1">
						<p class="text-sm font-medium">Select a contact</p>
						<p class="text-xs text-muted-foreground">
							Choose a signer to view their waiver visit history.
						</p>
					</div>
				</div>
			{/if}
		</aside>
	</div>
</PageShell>
