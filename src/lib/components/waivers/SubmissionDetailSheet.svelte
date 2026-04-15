<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useQuery } from 'convex-svelte';
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

	const submissionQuery = useQuery(
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
				{/if}
			</div>
		{/if}
	</DialogContent>
</Dialog>
