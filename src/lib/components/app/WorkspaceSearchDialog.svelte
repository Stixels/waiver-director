<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { FunctionReturnType } from 'convex/server';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Dialog, DialogContent, DialogDescription, DialogTitle } from '$lib/components/ui/dialog';
	import { cn } from '$lib/utils';
	import { queryString } from '$lib/utils/url';
	import { tick, untrack } from 'svelte';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import MailIcon from '@lucide/svelte/icons/mail';
	import PlugZapIcon from '@lucide/svelte/icons/plug-zap';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import UserRoundIcon from '@lucide/svelte/icons/user-round';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'> | null;
		workspaceSlug: string | null;
		onNavigate?: () => void;
	}

	let { open = $bindable(), workspaceId, workspaceSlug, onNavigate }: Props = $props();

	type SearchResults = FunctionReturnType<typeof api.search.globalWorkspaceSearch>;
	type CustomerResult = SearchResults['customers'][number];
	type BookingResult = SearchResults['bookings'][number];
	type SubmissionResult = SearchResults['submissions'][number];
	type SearchTarget = {
		pathname: `/app/${string}`;
		query: string;
	};
	type ActionItem = {
		key: string;
		label: string;
		description: string;
		href: `/app/${string}`;
		aliases: string[];
		icon: typeof SearchIcon;
		showWhenEmpty?: boolean;
	};
	type ActionDefinition = Omit<ActionItem, 'href'> & {
		path:
			| ''
			| 'bookings'
			| 'submissions'
			| 'customers'
			| 'waiver'
			| 'emails'
			| 'integrations'
			| 'settings'
			| 'settings/general'
			| 'settings/email'
			| 'account';
	};
	type FlatItem =
		| { kind: 'action'; key: string; data: ActionItem; target: SearchTarget | null }
		| { kind: 'customer'; key: string; data: CustomerResult; target: SearchTarget | null }
		| { kind: 'booking'; key: string; data: BookingResult; target: SearchTarget | null }
		| { kind: 'submission'; key: string; data: SubmissionResult; target: SearchTarget | null };

	const componentId = $props.id();
	const optionId = (index: number) => `wd-search-${componentId}-result-${index}`;
	const listboxId = `wd-search-${componentId}-listbox`;

	let searchInput = $state('');
	let debouncedSearchInput = $state('');
	let searchInputElement = $state<HTMLInputElement | null>(null);
	let listElement = $state<HTMLDivElement | null>(null);
	let selectedIndex = $state(0);
	let lastDebouncedSearchInput = $state('');

	$effect(() => {
		if (!open) {
			untrack(() => {
				searchInput = '';
				debouncedSearchInput = '';
				selectedIndex = 0;
			});
			return;
		}
		void tick().then(() => searchInputElement?.focus());
	});

	$effect(() => {
		const next = searchInput.trim();
		const timeout = setTimeout(() => {
			debouncedSearchInput = next;
		}, 160);
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

	const searchResults = $derived((searchResultsQuery.data ?? null) as SearchResults | null);
	const customerResults = $derived(searchResults?.customers ?? []);
	const bookingResults = $derived(searchResults?.bookings ?? []);
	const submissionResults = $derived(searchResults?.submissions ?? []);
	const trimmedQuery = $derived(searchInput.trim());
	const hasQuery = $derived(trimmedQuery.length > 0);
	const isSearching = $derived(searchResultsQuery.isLoading && debouncedSearchInput.length > 0);
	const hasDataResults = $derived(
		customerResults.length > 0 || bookingResults.length > 0 || submissionResults.length > 0
	);

	const NAVIGATION_ACTIONS: ActionDefinition[] = [
		{
			key: 'dashboard',
			label: 'Dashboard',
			description: 'Operational overview',
			path: '',
			aliases: ['home', 'overview'],
			icon: LayoutDashboardIcon
		},
		{
			key: 'bookings',
			label: 'Bookings',
			description: 'Daily check-in coverage',
			path: 'bookings',
			aliases: ['booking', 'calendar', 'check in', 'check-in'],
			icon: CalendarCheckIcon
		},
		{
			key: 'submissions',
			label: 'Submissions',
			description: 'Signed waiver records',
			path: 'submissions',
			aliases: ['submission', 'signed', 'signatures', 'records', 'waivers'],
			icon: FileTextIcon
		},
		{
			key: 'customers',
			label: 'Customers',
			description: 'Signer contacts and visits',
			path: 'customers',
			aliases: ['customer', 'contacts', 'people', 'signers'],
			icon: UsersRoundIcon
		},
		{
			key: 'waiver',
			label: 'Waiver',
			description: 'Edit and publish the waiver',
			path: 'waiver',
			aliases: ['builder', 'editor', 'template', 'publish'],
			icon: LayersIcon
		},
		{
			key: 'emails',
			label: 'Emails',
			description: 'Follow-up queue and editor',
			path: 'emails',
			aliases: ['email', 'email follow-ups', 'follow ups', 'followups', 'reminders'],
			icon: MailIcon
		},
		{
			key: 'integrations',
			label: 'Integrations',
			description: 'Booking providers and services',
			path: 'integrations',
			aliases: ['integration', 'bookeo', 'providers', 'connection', 'connect'],
			icon: PlugZapIcon
		},
		{
			key: 'settings',
			label: 'Workspace settings',
			description: 'Identity, email, and workspace setup',
			path: 'settings',
			aliases: ['settings', 'workspace settings', 'workspace setup', 'configuration'],
			icon: SlidersHorizontalIcon
		},
		{
			key: 'settings-general',
			label: 'General settings',
			description: 'Workspace name and URL slug',
			path: 'settings/general',
			aliases: ['general', 'workspace name', 'workspace slug', 'slug', 'url slug', 'identity'],
			icon: Building2Icon,
			showWhenEmpty: false
		},
		{
			key: 'settings-email',
			label: 'Email identity settings',
			description: 'Sender name and reply-to address',
			path: 'settings/email',
			aliases: ['email identity', 'sender', 'reply to', 'reply-to', 'from address'],
			icon: MailIcon,
			showWhenEmpty: false
		},
		{
			key: 'account',
			label: 'Account',
			description: 'Profile and user preferences',
			path: 'account',
			aliases: ['account', 'profile', 'user', 'billing'],
			icon: UserRoundIcon
		}
	];

	const navigationActions = $derived.by<ActionItem[]>(() => {
		if (!workspaceSlug) return [];
		return NAVIGATION_ACTIONS.map((action) => ({
			...action,
			href: `/app/${workspaceSlug}${action.path ? `/${action.path}` : ''}` as `/app/${string}`
		}));
	});

	const actionResults = $derived.by<ActionItem[]>(() => {
		const query = trimmedQuery.toLowerCase();
		if (!query) return navigationActions.filter((action) => action.showWhenEmpty !== false);
		return navigationActions.filter((action) =>
			[action.label, action.description, ...action.aliases].some((value) =>
				value.toLowerCase().includes(query)
			)
		);
	});

	const flatItems = $derived.by<FlatItem[]>(() => {
		const items: FlatItem[] = [];
		for (const action of actionResults) {
			items.push({
				kind: 'action',
				key: `action:${action.key}`,
				data: action,
				target: actionTarget(action)
			});
		}
		for (const customer of customerResults) {
			items.push({
				kind: 'customer',
				key: `customer:${customer.customerId}`,
				data: customer,
				target: customerTarget(customer.customerId)
			});
		}
		for (const booking of bookingResults) {
			items.push({
				kind: 'booking',
				key: `booking:${booking.bookingId}`,
				data: booking,
				target: bookingTarget(booking)
			});
		}
		for (const submission of submissionResults) {
			items.push({
				kind: 'submission',
				key: `submission:${submission.submissionId}`,
				data: submission,
				target: submissionTarget(submission.submissionId)
			});
		}
		return items;
	});
	const hasResults = $derived(flatItems.length > 0);

	$effect(() => {
		const itemCount = flatItems.length;
		untrack(() => {
			if (selectedIndex >= itemCount) {
				selectedIndex = 0;
			}
		});
	});

	$effect(() => {
		if (debouncedSearchInput === lastDebouncedSearchInput) return;
		lastDebouncedSearchInput = debouncedSearchInput;
		selectedIndex = 0;
	});

	$effect(() => {
		const nextSelectedIndex = selectedIndex;
		void tick().then(() => {
			const id = optionId(nextSelectedIndex);
			const node = listElement?.querySelector<HTMLElement>(`[data-result-id="${id}"]`);
			node?.scrollIntoView({ block: 'nearest' });
		});
	});

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

	function bookingTarget(booking: BookingResult): SearchTarget | null {
		if (!workspaceSlug) return null;
		return {
			pathname: `/app/${workspaceSlug}/bookings` as `/app/${string}`,
			query: queryString([
				['bookingId', booking.bookingId],
				['date', bookingDateValue(booking)]
			])
		};
	}

	function customerTarget(customerId: Id<'customers'>): SearchTarget | null {
		if (!workspaceSlug) return null;
		return {
			pathname: `/app/${workspaceSlug}/customers` as `/app/${string}`,
			query: queryString([['customerId', customerId]])
		};
	}

	function submissionTarget(submissionId: Id<'waiver_submissions'>): SearchTarget | null {
		if (!workspaceSlug) return null;
		return {
			pathname: `/app/${workspaceSlug}/submissions` as `/app/${string}`,
			query: queryString([
				['q', trimmedQuery],
				['submissionId', submissionId]
			])
		};
	}

	function actionTarget(action: ActionItem): SearchTarget {
		return {
			pathname: action.href,
			query: ''
		};
	}

	function getInitials(name: string): string {
		return (
			name
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((w) => w[0]?.toUpperCase() ?? '')
				.join('') || '?'
		);
	}

	async function goToResult(target: SearchTarget | null) {
		if (!target) return;
		open = false;
		onNavigate?.();
		const href = (target.query ? `${target.pathname}?${target.query}` : target.pathname) as
			| `/app/${string}`
			| `/app/${string}?${string}`;
		await goto(resolve(href), { noScroll: true });
	}

	function activateSelected() {
		const item = flatItems[selectedIndex];
		if (!item) return;
		void goToResult(item.target);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!flatItems.length) {
			if (event.key === 'Enter') event.preventDefault();
			return;
		}
		const lastIndex = flatItems.length - 1;
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = selectedIndex >= lastIndex ? 0 : selectedIndex + 1;
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = selectedIndex <= 0 ? lastIndex : selectedIndex - 1;
				break;
			case 'Home':
				event.preventDefault();
				selectedIndex = 0;
				break;
			case 'End':
				event.preventDefault();
				selectedIndex = lastIndex;
				break;
			case 'PageDown':
				event.preventDefault();
				selectedIndex = Math.min(lastIndex, selectedIndex + 5);
				break;
			case 'PageUp':
				event.preventDefault();
				selectedIndex = Math.max(0, selectedIndex - 5);
				break;
			case 'Enter':
				event.preventDefault();
				activateSelected();
				break;
		}
	}

	function clearQuery() {
		searchInput = '';
		debouncedSearchInput = '';
		selectedIndex = 0;
		void tick().then(() => searchInputElement?.focus());
	}

	const customerStartIndex = $derived(actionResults.length);
	const bookingStartIndex = $derived(actionResults.length + customerResults.length);
	const submissionStartIndex = $derived(
		actionResults.length + customerResults.length + bookingResults.length
	);
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		style="top: 12vh; translate: -50% 0;"
		class="grid h-[min(34rem,calc(100vh-8rem))] w-[calc(100vw-1.5rem)] max-w-2xl grid-rows-[auto_1fr_auto] gap-0 overflow-hidden rounded-2xl border border-border/80 bg-popover p-0 shadow-2xl ring-1 shadow-black/10 ring-foreground/5 sm:max-w-2xl"
	>
		<DialogTitle class="sr-only">Search workspace</DialogTitle>
		<DialogDescription class="sr-only">
			Search by customer name, email, activity, or booking number. Use arrow keys to navigate
			results and Enter to open.
		</DialogDescription>

		<!-- Search input row - always pinned at top -->
		<div class="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-popover px-4">
			<SearchIcon
				class={cn(
					'size-[18px] shrink-0 transition-colors',
					isSearching ? 'text-primary' : 'text-muted-foreground'
				)}
				aria-hidden="true"
			/>
			<input
				bind:this={searchInputElement}
				type="text"
				bind:value={searchInput}
				onkeydown={handleKeydown}
				placeholder="Search pages, customers, bookings, emails, booking #…"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
				role="combobox"
				aria-expanded={hasResults}
				aria-controls={listboxId}
				aria-activedescendant={hasResults ? optionId(selectedIndex) : undefined}
				aria-autocomplete="list"
				aria-label="Search pages, customers, and bookings"
				class="h-10 min-w-0 flex-1 bg-transparent text-[15px] tracking-tight text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
			/>
			{#if hasQuery}
				<button
					type="button"
					onclick={clearQuery}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none"
					aria-label="Clear search"
				>
					<XIcon class="size-4" aria-hidden="true" />
				</button>
			{/if}
			{#if isSearching}
				<span
					class="wd-search-spinner pointer-events-none size-3.5 shrink-0 rounded-full border-2 border-primary/25 border-t-primary"
					aria-hidden="true"
				></span>
			{/if}
		</div>

		<!-- Results region - scrollable, fixed height -->
		<div
			bind:this={listElement}
			id={listboxId}
			role="listbox"
			aria-label="Search results"
			class="min-h-0 overflow-y-auto bg-popover"
		>
			{#if isSearching && !hasDataResults && actionResults.length === 0}
				<div class="space-y-1 p-2" aria-busy="true">
					{#each [0, 1, 2, 3] as item (item)}
						<div class="flex items-center gap-3 px-3 py-2.5">
							<div class="size-9 shrink-0 animate-pulse rounded-xl bg-muted/70"></div>
							<div class="min-w-0 flex-1 space-y-1.5">
								<div class="h-3 w-48 animate-pulse rounded bg-muted/70"></div>
								<div class="h-2.5 w-64 animate-pulse rounded bg-muted/50"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if !hasResults}
				<div class="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
					<div
						class="flex size-11 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/60"
						aria-hidden="true"
					>
						<SearchIcon class="size-5 text-muted-foreground/70" />
					</div>
					<div class="space-y-1">
						<p class="text-[13px] font-medium text-foreground">
							{hasQuery ? 'Nothing matched' : 'Search this workspace'}
						</p>
						<p class="max-w-xs text-[12px] leading-relaxed text-muted-foreground">
							{hasQuery
								? `No pages, customers, bookings, or submissions found for "${trimmedQuery}".`
								: 'Jump to a page, find customers by name or email, or open a booking by its number.'}
						</p>
					</div>
					{#if !hasQuery}
						<div
							class="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80"
						>
							<span class="rounded-md bg-muted/70 px-2 py-1 ring-1 ring-border/60 ring-inset"
								>Try a page</span
							>
							<span class="text-muted-foreground/30">·</span>
							<span class="rounded-md bg-muted/70 px-2 py-1 ring-1 ring-border/60 ring-inset"
								>or a name</span
							>
							<span class="text-muted-foreground/30">·</span>
							<span class="rounded-md bg-muted/70 px-2 py-1 ring-1 ring-border/60 ring-inset"
								>or a booking number</span
							>
						</div>
					{/if}
				</div>
			{:else}
				{#if actionResults.length > 0}
					<section class="px-2 pt-2 pb-1.5">
						<h3
							class="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase"
						>
							Go to
							<span class="ml-1 font-medium tracking-normal text-muted-foreground/40 normal-case">
								{actionResults.length}
							</span>
						</h3>
						<div class="flex flex-col">
							{#each actionResults as action, idx (action.key)}
								{@const flatIndex = idx}
								{@const isSelected = flatIndex === selectedIndex}
								{@const id = optionId(flatIndex)}
								{@const ActionIcon = action.icon}
								<button
									type="button"
									data-result-id={id}
									{id}
									role="option"
									aria-selected={isSelected}
									tabindex="-1"
									onmouseenter={() => (selectedIndex = flatIndex)}
									onclick={() => void goToResult(actionTarget(action))}
									class={cn(
										'wd-result group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none',
										isSelected && 'wd-result-selected'
									)}
								>
									<span
										class="wd-result-icon flex size-6 shrink-0 items-center justify-center rounded-md"
										aria-hidden="true"
									>
										<ActionIcon class="size-[14px]" />
									</span>
									<span class="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
										{action.label}
									</span>
									<span
										class="hidden shrink-0 truncate text-[10.5px] tracking-normal text-muted-foreground/60 normal-case sm:inline"
										aria-hidden="true"
									>
										{action.description}
									</span>
									<CornerDownLeftIcon
										class="wd-result-enter size-3 shrink-0 text-muted-foreground/0"
										aria-hidden="true"
									/>
								</button>
							{/each}
						</div>
					</section>
				{/if}

				{#if customerResults.length > 0}
					<section class="px-2 pt-2 pb-1">
						<h3
							class="px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase"
						>
							Customers
							<span class="ml-1 font-medium tracking-normal text-muted-foreground/40 normal-case">
								{customerResults.length}
							</span>
						</h3>
						<div class="flex flex-col gap-0.5">
							{#each customerResults as customer, idx (customer.customerId)}
								{@const flatIndex = customerStartIndex + idx}
								{@const isSelected = flatIndex === selectedIndex}
								{@const id = optionId(flatIndex)}
								<button
									type="button"
									data-result-id={id}
									{id}
									role="option"
									aria-selected={isSelected}
									tabindex="-1"
									onmouseenter={() => (selectedIndex = flatIndex)}
									onclick={() => void goToResult(customerTarget(customer.customerId))}
									class={cn(
										'wd-result group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none',
										isSelected && 'wd-result-selected'
									)}
								>
									<span
										class="wd-result-avatar flex size-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold tracking-tight"
										aria-hidden="true"
									>
										{getInitials(customer.displayName)}
									</span>
									<span class="min-w-0 flex-1">
										<span class="flex items-center gap-2">
											<span class="truncate text-[13px] font-medium text-foreground">
												{customer.displayName}
											</span>
										</span>
										<span
											class="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
										>
											<UserRoundIcon class="size-3 shrink-0 opacity-60" aria-hidden="true" />
											<span class="truncate">{customer.primaryEmail}</span>
										</span>
									</span>
									<span class="flex shrink-0 items-center gap-2">
										<span
											class="rounded-md bg-muted/70 px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground tabular-nums ring-1 ring-border/40 ring-inset"
										>
											{customer.visitCount}
											{customer.visitCount === 1 ? 'visit' : 'visits'}
										</span>
										<CornerDownLeftIcon
											class="wd-result-enter size-3.5 text-muted-foreground/0"
											aria-hidden="true"
										/>
									</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}

				{#if bookingResults.length > 0}
					<section class="px-2 pt-1 pb-2">
						<h3
							class="px-2 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase"
						>
							Bookings
							<span class="ml-1 font-medium tracking-normal text-muted-foreground/40 normal-case">
								{bookingResults.length}
							</span>
						</h3>
						<div class="flex flex-col gap-0.5">
							{#each bookingResults as booking, idx (booking.bookingId)}
								{@const flatIndex = bookingStartIndex + idx}
								{@const isSelected = flatIndex === selectedIndex}
								{@const isCanceled = booking.status === 'canceled'}
								{@const bookingStart = formatTimestamp(booking.startTime, {
									dateStyle: 'medium',
									timeStyle: 'short'
								})}
								{@const id = optionId(flatIndex)}
								<button
									type="button"
									data-result-id={id}
									{id}
									role="option"
									aria-selected={isSelected}
									tabindex="-1"
									onmouseenter={() => (selectedIndex = flatIndex)}
									onclick={() => void goToResult(bookingTarget(booking))}
									class={cn(
										'wd-result group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none',
										isSelected && 'wd-result-selected'
									)}
								>
									<span
										class={cn(
											'wd-result-avatar flex size-9 shrink-0 items-center justify-center rounded-xl',
											isCanceled && 'is-canceled'
										)}
										aria-hidden="true"
									>
										<CalendarDaysIcon class="size-[17px]" />
									</span>
									<span class="min-w-0 flex-1">
										<span class="flex items-center gap-2">
											<span
												class={cn(
													'truncate text-[13px] font-medium text-foreground',
													isCanceled &&
														'text-muted-foreground line-through decoration-muted-foreground/60'
												)}
											>
												{booking.activityName}
											</span>
											{#if isCanceled}
												<span
													class="shrink-0 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[0.08em] text-destructive uppercase ring-1 ring-destructive/20 ring-inset"
												>
													Canceled
												</span>
											{/if}
										</span>
										<span
											class="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground"
										>
											<span class="truncate">{booking.leadCustomerName ?? 'Unknown customer'}</span>
											{#if bookingStart}
												<span class="text-muted-foreground/40">·</span>
												<span class="shrink-0 tabular-nums">{bookingStart}</span>
											{/if}
										</span>
									</span>
									<span class="flex shrink-0 items-center gap-2">
										<span
											class="rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground tabular-nums ring-1 ring-border/40 ring-inset"
										>
											#{booking.providerBookingId}
										</span>
										<CornerDownLeftIcon
											class="wd-result-enter size-3.5 text-muted-foreground/0"
											aria-hidden="true"
										/>
									</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}

				{#if submissionResults.length > 0}
					<section class="px-2 pt-1 pb-2">
						<h3
							class="px-2 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase"
						>
							Submissions
							<span class="ml-1 font-medium tracking-normal text-muted-foreground/40 normal-case">
								{submissionResults.length}
							</span>
						</h3>
						<div class="flex flex-col gap-0.5">
							{#each submissionResults as submission, idx (submission.submissionId)}
								{@const flatIndex = submissionStartIndex + idx}
								{@const isSelected = flatIndex === selectedIndex}
								{@const submittedAt = formatTimestamp(submission.submittedAt, {
									dateStyle: 'medium'
								})}
								{@const id = optionId(flatIndex)}
								<button
									type="button"
									data-result-id={id}
									{id}
									role="option"
									aria-selected={isSelected}
									tabindex="-1"
									onmouseenter={() => (selectedIndex = flatIndex)}
									onclick={() => void goToResult(submissionTarget(submission.submissionId))}
									class={cn(
										'wd-result group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none',
										isSelected && 'wd-result-selected'
									)}
								>
									<span
										class="wd-result-avatar flex size-9 shrink-0 items-center justify-center rounded-xl"
										aria-hidden="true"
									>
										<FileTextIcon class="size-[17px]" />
									</span>
									<span class="min-w-0 flex-1">
										<span class="flex items-center gap-2">
											<span class="truncate text-[13px] font-medium text-foreground">
												{submission.signerName}
											</span>
											{#if submission.minorCount > 0}
												<span
													class="shrink-0 text-[10.5px] font-medium text-muted-foreground/80 tabular-nums"
													title="{submission.minorCount} {submission.minorCount === 1
														? 'minor'
														: 'minors'}"
												>
													+{submission.minorCount}
												</span>
											{/if}
										</span>
										<span
											class="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground"
										>
											<span class="truncate">{submission.signerEmail}</span>
											{#if submission.bookingActivityName}
												<span class="text-muted-foreground/40">·</span>
												<span class="truncate">{submission.bookingActivityName}</span>
											{/if}
										</span>
									</span>
									<span class="flex shrink-0 items-center gap-2">
										{#if submittedAt}
											<span
												class="hidden rounded-md bg-muted/70 px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground tabular-nums ring-1 ring-border/40 ring-inset sm:inline"
											>
												{submittedAt}
											</span>
										{/if}
										<CornerDownLeftIcon
											class="wd-result-enter size-3.5 text-muted-foreground/0"
											aria-hidden="true"
										/>
									</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		</div>

		<!-- Footer hint bar - always visible, fixed height -->
		<div
			class="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-3 text-[11px] text-muted-foreground/80"
		>
			<div class="flex items-center gap-3">
				<span class="flex items-center gap-1.5">
					<kbd class="wd-search-kbd">↑</kbd>
					<kbd class="wd-search-kbd">↓</kbd>
					<span class="text-muted-foreground/70">Navigate</span>
				</span>
				<span class="flex items-center gap-1.5">
					<kbd class="wd-search-kbd">↵</kbd>
					<span class="text-muted-foreground/70">Open</span>
				</span>
				<span class="hidden items-center gap-1.5 sm:flex">
					<kbd class="wd-search-kbd">esc</kbd>
					<span class="text-muted-foreground/70">Close</span>
				</span>
			</div>
			<div class="flex items-center gap-1.5">
				{#if hasResults}
					<span class="text-muted-foreground/70 tabular-nums">
						{flatItems.length}
						{flatItems.length === 1 ? 'result' : 'results'}
					</span>
				{:else}
					<span class="hidden text-muted-foreground/50 sm:inline">Workspace search</span>
				{/if}
			</div>
		</div>
	</DialogContent>
</Dialog>

<style>
	.wd-result {
		transition:
			background-color 110ms ease,
			color 110ms ease;
	}

	:global(.wd-result-selected) {
		background: color-mix(in oklch, var(--primary) 10%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 28%, transparent);
	}

	:global(.dark .wd-result-selected) {
		background: color-mix(in oklch, var(--primary) 18%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 38%, transparent);
	}

	:global(.wd-result-selected .wd-result-enter) {
		color: color-mix(in oklch, var(--primary) 65%, var(--muted-foreground));
	}

	:global(.wd-result-avatar),
	:global(.wd-result-icon) {
		background: color-mix(in oklch, var(--foreground) 5%, var(--muted));
		color: var(--muted-foreground);
		box-shadow: inset 0 0 0 1px var(--border);
		transition:
			background-color 120ms ease,
			color 120ms ease,
			transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global(.wd-result-avatar.is-canceled) {
		opacity: 0.55;
	}

	:global(.wd-result-selected .wd-result-avatar),
	:global(.wd-result-selected .wd-result-icon) {
		transform: scale(1.04);
	}

	:global(.wd-result-selected .wd-result-avatar:not(.is-canceled)),
	:global(.wd-result-selected .wd-result-icon) {
		background: color-mix(in oklch, var(--primary) 12%, var(--muted));
		color: color-mix(in oklch, var(--primary) 70%, var(--foreground));
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 24%, transparent);
	}

	:global(.dark .wd-result-selected .wd-result-avatar:not(.is-canceled)),
	:global(.dark .wd-result-selected .wd-result-icon) {
		background: color-mix(in oklch, var(--primary) 22%, var(--card));
		color: color-mix(in oklch, var(--primary-foreground) 90%, white);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 38%, transparent);
	}

	.wd-search-spinner {
		animation: wd-search-spin 720ms linear infinite;
	}

	@keyframes wd-search-spin {
		to {
			transform: rotate(360deg);
		}
	}

	:global(.wd-search-kbd) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 0.25rem;
		border-radius: var(--radius-sm);
		background: color-mix(in oklch, var(--foreground) 4%, var(--popover));
		color: var(--muted-foreground);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 10px;
		line-height: 1;
		font-weight: 500;
		box-shadow: inset 0 0 0 1px var(--border);
	}

	:global(.dark .wd-search-kbd) {
		background: color-mix(in oklch, var(--foreground) 8%, var(--popover));
	}

	@media (prefers-reduced-motion: reduce) {
		.wd-result,
		:global(.wd-result-avatar) {
			transition: none;
		}
		.wd-search-spinner {
			animation: none;
		}
	}
</style>
