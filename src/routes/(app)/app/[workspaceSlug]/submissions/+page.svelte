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
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { formatBookingTimestamp } from '$lib/utils/date';
	import { queryString } from '$lib/utils/url';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';

	const PAGE_SIZE = 20;

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);
	const initialQuery = initialSearchQuery();

	let cursor = $state<string | null>(null);
	let cursorHistory = $state<Array<string | null>>([]);
	let currentPage = $state(1);
	let searchInput = $state(initialQuery);
	let searchQuery = $state(initialQuery);
	let lastWorkspaceId = $state<string | null>(null);
	let lastSearchQuery = initialQuery;
	let lastAppliedSearchQuery = initialQuery;
	let lastOpenedSubmissionKey: string | null = null;

	const submissionsQuery = useProtectedQuery(
		api.waivers.listRecentSubmissions,
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

	type SubmissionPage = FunctionReturnType<typeof api.waivers.listRecentSubmissions>;
	type RecentSubmission = SubmissionPage['submissions'][number];
	const submissionPage = $derived((submissionsQuery.data ?? null) as SubmissionPage | null);
	const recentSubmissions = $derived((submissionPage?.submissions ?? []) as RecentSubmission[]);
	const isLoadingSubmissions = $derived(submissionsQuery.isLoading || appContext.isLoading);
	const searchQueryParam = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	const submissionIdParam = $derived(
		page.url.searchParams.get('submissionId') as Id<'waiver_submissions'> | null
	);

	// lastSubmissionId stays set after first open so the sheet stays mounted
	// (preserves close animation and avoids re-mounting on subsequent opens).
	let lastSubmissionId = $state<Id<'waiver_submissions'> | null>(null);
	let detailOpen = $state(false);

	function initialSearchQuery() {
		return page.url.searchParams.get('q')?.trim() ?? '';
	}

	async function updateSubmissionsUrl(args: {
		searchQuery?: string;
		submissionId?: Id<'waiver_submissions'> | null;
		replaceState?: boolean;
	}) {
		const nextSearchQuery = args.searchQuery ?? searchQuery;
		lastAppliedSearchQuery = nextSearchQuery;
		lastOpenedSubmissionKey = args.submissionId ?? null;

		const query = queryString([
			['q', nextSearchQuery],
			['submissionId', args.submissionId ?? null]
		]);
		const pathname =
			`/app/${page.params.workspaceSlug}/submissions` as `/app/${string}/submissions`;
		const href = (query ? `${pathname}?${query}` : pathname) as
			| `/app/${string}/submissions`
			| `/app/${string}/submissions?${string}`;

		await goto(resolve(href), {
			replaceState: args.replaceState ?? true,
			noScroll: true,
			keepFocus: true
		});
	}

	function openSubmission(submissionId: Id<'waiver_submissions'>) {
		lastSubmissionId = submissionId;
		detailOpen = true;
		void updateSubmissionsUrl({
			searchQuery,
			submissionId,
			replaceState: false
		});
	}

	function handleSubmissionRowKeydown(
		event: KeyboardEvent,
		submissionId: Id<'waiver_submissions'>
	) {
		if (event.key !== 'Enter' && event.key !== ' ') return;

		event.preventDefault();
		openSubmission(submissionId);
	}

	function formatSubmittedDate(timestamp: number) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(timestamp));
	}

	function formatSubmittedTime(timestamp: number) {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(timestamp));
	}

	function formatDob(dob: string) {
		const [y, m, d] = dob.split('-').map(Number);
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(y, m - 1, d));
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
		lastAppliedSearchQuery = searchQuery;
		lastOpenedSubmissionKey = null;
		lastSubmissionId = null;
		detailOpen = false;
		resetPagination();
	});

	$effect(() => {
		if (searchQuery === lastSearchQuery) return;
		lastSearchQuery = searchQuery;
		resetPagination();
		lastSubmissionId = null;
		detailOpen = false;
		void updateSubmissionsUrl({
			searchQuery,
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
		if (searchQueryParam === lastAppliedSearchQuery) return;
		lastAppliedSearchQuery = searchQueryParam;
		lastSearchQuery = searchQueryParam;
		searchInput = searchQueryParam;
		searchQuery = searchQueryParam;
		resetPagination();
	});

	$effect(() => {
		if (!submissionIdParam) {
			if (detailOpen) detailOpen = false;
			lastOpenedSubmissionKey = null;
			return;
		}
		if (submissionIdParam === lastOpenedSubmissionKey) return;
		lastOpenedSubmissionKey = submissionIdParam;
		lastSubmissionId = submissionIdParam;
		detailOpen = true;
	});

	$effect(() => {
		if (detailOpen || !submissionIdParam) return;
		void updateSubmissionsUrl({
			searchQuery,
			submissionId: null,
			replaceState: true
		});
	});

	function goNextPage() {
		if (!submissionPage || submissionPage.isDone) return;
		cursorHistory = [...cursorHistory, cursor];
		cursor = submissionPage.continueCursor;
		currentPage += 1;
	}

	function goPreviousPage() {
		if (cursorHistory.length === 0) return;
		const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
		cursorHistory = cursorHistory.slice(0, -1);
		cursor = previousCursor;
		currentPage = Math.max(1, currentPage - 1);
	}

	function clearSearch() {
		if (!searchInput && !searchQuery) return;
		searchInput = '';
		searchQuery = '';
	}
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Submissions | Waiver Director</title>
</svelte:head>

{#if lastSubmissionId && currentWorkspace}
	<SubmissionDetailSheet
		bind:open={detailOpen}
		workspaceId={currentWorkspace.workspaceId}
		workspaceSlug={currentWorkspace.slug}
		submissionId={lastSubmissionId}
	/>
{/if}

<PageHeader title="Signed waiver records" subtitle="Click any row to view the full signed waiver.">
	{#snippet meta()}
		<div class="relative w-full lg:max-w-md">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				placeholder="Search by customer, activity, or booking number"
				bind:value={searchInput}
				class="h-9 w-full rounded-lg border border-input bg-background/60 pr-10 pl-11 text-sm shadow-xs transition-all placeholder:text-muted-foreground/70 hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
				aria-label="Search submissions"
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
	{#if isLoadingSubmissions}
		<div class="space-y-2 md:hidden">
			{#each [0, 1, 2, 3, 4, 5] as index (index)}
				<div class="rounded-xl border border-border bg-background p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1 space-y-2">
							<Skeleton class="h-4 w-36" />
							<Skeleton class="h-3.5 w-48 max-w-full" />
						</div>
						<Skeleton class="h-5 w-14 rounded-full" />
					</div>
					<div class="mt-4 grid grid-cols-2 gap-3">
						<Skeleton class="h-4 w-24" />
						<Skeleton class="h-4 w-28 justify-self-end" />
					</div>
				</div>
			{/each}
		</div>
		<div class="hidden overflow-hidden rounded-xl border border-border md:block">
			<Table class="table-fixed">
				<colgroup>
					<col class="w-[32%]" />
					<col class="w-[30%]" />
					<col class="w-[18%]" />
					<col class="w-[20%]" />
				</colgroup>
				<TableHeader>
					<TableRow class="border-border hover:bg-transparent">
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Name
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Visit
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Date of birth
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Submitted
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each [0, 1, 2, 3, 4, 5] as index (index)}
						<TableRow class="h-17 border-border hover:bg-transparent">
							<TableCell class="px-4 py-3">
								<Skeleton class="h-5 w-32" />
								<Skeleton class="mt-2 h-3.5 w-44" />
							</TableCell>
							<TableCell class="px-4 py-3">
								<Skeleton class="h-5 w-40" />
								<Skeleton class="mt-2 h-3.5 w-28" />
							</TableCell>
							<TableCell class="px-4 py-3">
								<Skeleton class="h-5 w-28" />
							</TableCell>
							<TableCell class="px-4 py-3">
								<Skeleton class="h-5 w-32" />
								<Skeleton class="mt-2 h-3.5 w-16" />
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{:else if !currentWorkspace}
		<div
			class="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
		>
			Workspace not found.
		</div>
	{:else if recentSubmissions.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/30 px-4 py-16 text-center"
		>
			<div
				class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
			>
				<FileTextIcon class="size-5" aria-hidden="true" />
			</div>
			<div class="space-y-1">
				<p class="text-sm font-medium">
					{searchQuery ? 'No matching submissions' : 'No submissions yet'}
				</p>
				<p class="text-xs text-muted-foreground">
					{searchQuery
						? 'Try a different name, email, or booking number.'
						: 'Once guests sign the live waiver, records will appear here.'}
				</p>
			</div>
		</div>
	{:else}
		<div class="space-y-2 md:hidden">
			{#each recentSubmissions as submission (submission.submissionId)}
				{@const bookingDate = formatBookingTimestamp(submission.bookingStartTime)}
				<button
					type="button"
					class="group w-full rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
					onclick={() => openSubmission(submission.submissionId)}
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
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
							<p class="mt-1 truncate text-xs text-muted-foreground">{submission.signerEmail}</p>
						</div>
						<ChevronRightIcon
							class="mt-0.5 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
							aria-hidden="true"
						/>
					</div>
					<div class="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs">
						<div class="min-w-0">
							<p class="truncate font-medium">
								{submission.bookingActivityName ?? 'General waiver'}
							</p>
							{#if bookingDate}
								<p class="mt-0.5 truncate text-muted-foreground">
									{bookingDate}
								</p>
							{:else}
								<span
									class="mt-1 inline-flex items-center rounded-full border border-dashed border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground"
								>
									No booking attached
								</span>
							{/if}
						</div>
						<div class="text-right text-muted-foreground tabular-nums">
							<p>{formatSubmittedDate(submission.submittedAt)}</p>
							<p class="mt-0.5">{formatSubmittedTime(submission.submittedAt)}</p>
						</div>
					</div>
				</button>
			{/each}
		</div>
		<div class="hidden overflow-hidden rounded-xl border border-border md:block">
			<Table class="table-fixed">
				<colgroup>
					<col class="w-[32%]" />
					<col class="w-[30%]" />
					<col class="w-[18%]" />
					<col class="w-[20%]" />
				</colgroup>
				<TableHeader>
					<TableRow class="border-border hover:bg-transparent">
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Name
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Visit
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Date of birth
						</TableHead>
						<TableHead
							class="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
						>
							Submitted
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each recentSubmissions as submission (submission.submissionId)}
						{@const bookingDate = formatBookingTimestamp(submission.bookingStartTime)}
						<TableRow
							class="h-17 cursor-pointer border-border transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
							role="button"
							tabindex={0}
							onclick={() => openSubmission(submission.submissionId)}
							onkeydown={(event) => handleSubmissionRowKeydown(event, submission.submissionId)}
						>
							<TableCell class="px-4 py-3">
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
								<p class="mt-1 truncate text-xs text-muted-foreground">
									{submission.signerEmail}
								</p>
							</TableCell>
							<TableCell class="px-4 py-3">
								<p class="truncate text-sm font-medium">
									{submission.bookingActivityName ?? 'General waiver'}
								</p>
								{#if bookingDate}
									<p class="mt-1 truncate text-xs text-muted-foreground tabular-nums">
										{bookingDate}
									</p>
								{:else}
									<span
										class="mt-1 inline-flex items-center rounded-full border border-dashed border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground"
									>
										No booking attached
									</span>
								{/if}
							</TableCell>
							<TableCell class="px-4 py-3 text-sm text-muted-foreground">
								{formatDob(submission.signerDateOfBirth)}
							</TableCell>
							<TableCell class="px-4 py-3 text-xs text-muted-foreground tabular-nums">
								<p>{formatSubmittedDate(submission.submittedAt)}</p>
								<p class="mt-1">{formatSubmittedTime(submission.submittedAt)}</p>
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}

	{#if submissionPage && (cursorHistory.length > 0 || !submissionPage.isDone)}
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
				<Button size="sm" variant="outline" disabled={submissionPage.isDone} onclick={goNextPage}>
					Next
					<ChevronRightIcon class="size-4" aria-hidden="true" />
				</Button>
			</div>
		</div>
	{/if}
</PageShell>
