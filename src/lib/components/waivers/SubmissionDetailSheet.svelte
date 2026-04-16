<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useQuery } from 'convex-svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import WaiverReadonlyDocument from '$lib/components/waivers/WaiverReadonlyDocument.svelte';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
		submissionId: Id<'waiver_submissions'>;
	}

	let { open = $bindable(), workspaceId, submissionId }: Props = $props();

	type Submission = NonNullable<FunctionReturnType<typeof api.waivers.getSubmission>>;
	const clerk = useClerkContext();
	const canLoadProtectedData = $derived(
		clerk.isLoaded && Boolean(clerk.auth.userId) && Boolean(clerk.auth.sessionId)
	);

	const submissionQuery = useQuery(
		api.waivers.getSubmission,
		() => (canLoadProtectedData ? { workspaceId, submissionId } : 'skip'),
		() => ({ keepPreviousData: true })
	);

	const submission = $derived(submissionQuery.data as Submission | null);
	const isLoadingSubmission = $derived(!canLoadProtectedData || submissionQuery.isLoading);

	function formatTimestamp(ts: number) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(
			new Date(ts)
		);
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="h-[96vh] w-[calc(100vw-1rem)] max-w-none gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-w-[min(1500px,calc(100vw-4rem))]"
	>
		{#if !submission}
			<div class="flex flex-1 items-center justify-center">
				<p class="text-sm text-muted-foreground">
					{isLoadingSubmission ? 'Loading…' : 'Submission not found.'}
				</p>
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
						title={submission.waiver.title}
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
									<p class="mt-1 text-foreground">{submission.signerDateOfBirth}</p>
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
