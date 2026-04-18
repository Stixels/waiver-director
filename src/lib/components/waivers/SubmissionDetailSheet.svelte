<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import WaiverReadonlyDocument from '$lib/components/waivers/WaiverReadonlyDocument.svelte';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
		submissionId: Id<'waiver_submissions'>;
	}

	let { open = $bindable(), workspaceId, submissionId }: Props = $props();

	type Submission = NonNullable<FunctionReturnType<typeof api.waivers.getSubmission>>;

	const submissionQuery = useProtectedQuery(
		api.waivers.getSubmission,
		() => ({ workspaceId, submissionId }),
		() => ({ keepPreviousData: true })
	);

	const submission = $derived(submissionQuery.data as Submission | null);
	const isLoadingSubmission = $derived(submissionQuery.isLoading);

	function formatTimestamp(ts: number) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(
			new Date(ts)
		);
	}

	function formatDob(dob: string) {
		const [y, m, d] = dob.split('-').map(Number);
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(y, m - 1, d));
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="h-[96vh] w-[calc(100vw-1rem)] max-w-none gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-w-[min(1500px,calc(100vw-4rem))]"
	>
		{#if isLoadingSubmission}
			<DialogHeader class="shrink-0 border-b border-border px-6 py-5">
				<DialogTitle><Skeleton class="h-5 w-48" /></DialogTitle>
				<DialogDescription><Skeleton class="h-3.5 w-40" /></DialogDescription>
			</DialogHeader>

			<div class="min-h-0 flex-1 overflow-y-auto bg-muted/20">
				<div class="mx-auto max-w-5xl p-4 sm:p-6">
					<div class="rounded-2xl border border-border bg-background p-6 shadow-sm">
						<div class="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
							<div class="space-y-6">
								<section class="space-y-4">
									<Skeleton class="h-8 w-72 max-w-full" />
									<div class="space-y-2">
										<Skeleton class="h-4 w-full" />
										<Skeleton class="h-4 w-11/12" />
										<Skeleton class="h-4 w-2/3" />
									</div>
								</section>
								<section class="space-y-4">
									<Skeleton class="h-4 w-32" />
									{#each [0, 1, 2, 3] as index (index)}
										<div class="rounded-lg border border-border p-4">
											<Skeleton class="h-4 w-48" />
											<Skeleton class="mt-3 h-9 w-full" />
										</div>
									{/each}
								</section>
							</div>
							<aside class="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
								<Skeleton class="h-4 w-24" />
								<Skeleton class="h-4 w-40" />
								<Skeleton class="h-4 w-36" />
								<Skeleton class="h-24 w-full" />
							</aside>
						</div>
					</div>
				</div>
			</div>
		{:else if !submission}
			<div class="flex flex-1 items-center justify-center">
				<p class="text-sm text-muted-foreground">Submission not found.</p>
			</div>
		{:else}
			<DialogHeader class="shrink-0 border-b border-border px-6 py-5">
				<DialogTitle class="text-base font-semibold">{submission.signerName}</DialogTitle>
				<DialogDescription class="text-xs text-muted-foreground">
					Submitted {formatTimestamp(submission.submittedAt)}
				</DialogDescription>
			</DialogHeader>

			<div class="min-h-0 flex-1 overflow-y-auto bg-muted/20">
				{#if submission.waiver}
					<WaiverReadonlyDocument
						workspaceName={submission.workspaceName}
						introCopy={submission.waiver.introCopy}
						fields={submission.waiver.fields}
						signerName={submission.signerName}
						signerEmail={submission.signerEmail}
						signerDateOfBirth={submission.signerDateOfBirth}
						minors={submission.minors}
						answers={submission.answers}
						signatureDataUrl={submission.signatureDataUrl}
						submittedAt={submission.submittedAt}
					/>
				{:else}
					<div class="mx-auto max-w-3xl p-4 sm:p-6">
						<section class="rounded-2xl border border-border bg-background p-6 shadow-sm">
							<p class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
								Waiver version unavailable
							</p>
							<h3 class="mt-2 text-lg font-semibold tracking-tight">
								This signed record is preserved, but its original waiver body is no longer
								available.
							</h3>
							<p class="mt-2 text-sm text-muted-foreground">
								Workspace: {submission.workspaceName}
							</p>
							<div class="mt-5 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
								<div>
									<p class="text-xs font-semibold tracking-[0.12em] uppercase">Signer</p>
									<p class="mt-1 text-foreground">{submission.signerName}</p>
								</div>
								<div>
									<p class="text-xs font-semibold tracking-[0.12em] uppercase">Email</p>
									<p class="mt-1 text-foreground">{submission.signerEmail}</p>
								</div>
								<div>
									<p class="text-xs font-semibold tracking-[0.12em] uppercase">Date of birth</p>
									<p class="mt-1 text-foreground">{formatDob(submission.signerDateOfBirth)}</p>
								</div>
								<div>
									<p class="text-xs font-semibold tracking-[0.12em] uppercase">Submitted</p>
									<p class="mt-1 text-foreground">{formatTimestamp(submission.submittedAt)}</p>
								</div>
							</div>
						</section>
					</div>
				{/if}
			</div>
		{/if}
	</DialogContent>
</Dialog>
