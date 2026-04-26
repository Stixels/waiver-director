<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { page } from '$app/state';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
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

	function queryString(entries: Array<[string, string | null]>) {
		return entries
			.filter((entry): entry is [string, string] => entry[1] !== null && entry[1].length > 0)
			.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
			.join('&');
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
		const href = query ? `${page.url.pathname}?${query}` : page.url.pathname;

		await goto(resolve(href as Pathname), {
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

	function formatTimestamp(timestamp: number) {
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
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
		submissionId={lastSubmissionId}
	/>
{/if}

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-6xl min-w-0 space-y-6">
		<div class="space-y-1">
			<h1 class="text-2xl font-semibold tracking-tight">Signed waiver records</h1>
			<p class="text-sm text-muted-foreground">Click any row to view the full signed waiver.</p>
		</div>

		<div class="relative w-full lg:max-w-md">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				placeholder="Search by name, email, or booking number"
				bind:value={searchInput}
				class="h-10 w-full rounded-lg border border-input bg-card/50 pr-10 pl-11 text-sm shadow-xs transition-all placeholder:text-muted-foreground/70 hover:bg-card focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
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

		{#if isLoadingSubmissions}
			<div class="overflow-hidden rounded-xl border border-border">
				<Table class="table-fixed">
					<colgroup>
						<col class="w-[21.25%]" />
						<col class="w-[38%]" />
						<col class="w-[18.35%]" />
						<col class="w-[22.4%]" />
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
								Email
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
							<TableRow class="border-border hover:bg-transparent">
								<TableCell>
									<Skeleton class="h-5 w-32" />
								</TableCell>
								<TableCell>
									<Skeleton class="h-5 w-44" />
								</TableCell>
								<TableCell>
									<Skeleton class="h-5 w-28" />
								</TableCell>
								<TableCell>
									<Skeleton class="h-5 w-36" />
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
			<div class="overflow-hidden rounded-xl border border-border">
				<Table class="table-fixed">
					<colgroup>
						<col class="w-[21.25%]" />
						<col class="w-[38%]" />
						<col class="w-[18.35%]" />
						<col class="w-[22.4%]" />
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
								Email
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
							<TableRow
								class="cursor-pointer border-border transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
								role="button"
								tabindex={0}
								onclick={() => openSubmission(submission.submissionId)}
								onkeydown={(event) => handleSubmissionRowKeydown(event, submission.submissionId)}
							>
								<TableCell>
									<p class="text-sm font-medium">{submission.signerName}</p>
									{#if submission.minorCount > 0}
										<p class="mt-0.5 text-xs text-muted-foreground">
											+{submission.minorCount}
											{submission.minorCount === 1 ? 'minor' : 'minors'}
										</p>
									{/if}
									{#if submission.bookingActivityName}
										{@const bookingDate = formatBookingTimestamp(submission.bookingStartTime)}
										<p class="mt-0.5 truncate text-xs text-muted-foreground">
											{submission.bookingActivityName}
											{#if bookingDate}
												- {bookingDate}
											{/if}
										</p>
									{/if}
								</TableCell>
								<TableCell class="text-sm text-muted-foreground">
									{submission.signerEmail}
								</TableCell>
								<TableCell class="text-sm text-muted-foreground">
									{formatDob(submission.signerDateOfBirth)}
								</TableCell>
								<TableCell class="text-xs text-muted-foreground">
									{formatTimestamp(submission.submittedAt)}
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
	</div>
</div>
