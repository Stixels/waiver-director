<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import SubmissionDetailSheet from '$lib/components/waivers/SubmissionDetailSheet.svelte';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';

	let { data } = $props();

	type RecentSubmission = FunctionReturnType<typeof api.waivers.listRecentSubmissions>[number];

	const submissionsQuery = useProtectedQuery(
		api.waivers.listRecentSubmissions,
		() => ({ workspaceId: data.currentWorkspace.workspaceId }),
		() => ({ keepPreviousData: true })
	);

	const recentSubmissions = $derived((submissionsQuery.data ?? []) as RecentSubmission[]);
	const isLoadingSubmissions = $derived(submissionsQuery.isLoading);

	// lastSubmissionId stays set after first open so the sheet stays mounted
	// (preserves close animation and avoids re-mounting on subsequent opens).
	let lastSubmissionId = $state<Id<'waiver_submissions'> | null>(null);
	let detailOpen = $state(false);

	function openSubmission(submissionId: Id<'waiver_submissions'>) {
		lastSubmissionId = submissionId;
		detailOpen = true;
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
</script>

<svelte:head>
	<title>{data.currentWorkspace.name} Submissions | Waiver Director</title>
</svelte:head>

{#if lastSubmissionId}
	<SubmissionDetailSheet
		bind:open={detailOpen}
		workspaceId={data.currentWorkspace.workspaceId}
		submissionId={lastSubmissionId}
	/>
{/if}

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-5xl min-w-0 space-y-5">
		<div class="space-y-1">
			<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Submissions</p>
			<h1 class="text-2xl font-semibold tracking-tight">Signed waiver records</h1>
			<p class="text-sm text-muted-foreground">Click any row to view the full signed waiver.</p>
		</div>

		{#if isLoadingSubmissions}
			<div
				class="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground"
			>
				Loading signed submissions…
			</div>
		{:else if recentSubmissions.length === 0}
			<div
				class="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground"
			>
				No submissions yet. Once guests sign the live waiver, records will appear here.
			</div>
		{:else}
			<div class="rounded-xl border border-border">
				<Table>
					<TableHeader>
						<TableRow class="border-border hover:bg-transparent">
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Name
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Email
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Date of birth
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
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
	</div>
</div>
