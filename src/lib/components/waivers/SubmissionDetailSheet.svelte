<script lang="ts">
	import { resolve } from '$app/paths';
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
	import { formatBookingTimestamp } from '$lib/utils/date';
	import { queryString } from '$lib/utils/url';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import TicketIcon from '@lucide/svelte/icons/ticket';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
		workspaceSlug: string;
		submissionId: Id<'waiver_submissions'>;
	}

	let { open = $bindable(), workspaceId, workspaceSlug, submissionId }: Props = $props();

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

	function participantSummary(minorCount: number) {
		if (minorCount === 0) return '1 adult signer';
		return `1 adult signer, ${minorCount} ${minorCount === 1 ? 'minor' : 'minors'}`;
	}

	function bookingDateParam(startTime: string | undefined) {
		if (!startTime) return null;
		const dateOnly = startTime.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/)?.[1];
		if (dateOnly) return dateOnly;
		const parsedDate = new Date(startTime);
		if (Number.isNaN(parsedDate.getTime())) return null;
		const year = parsedDate.getFullYear();
		const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
		const day = String(parsedDate.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function bookingPath(bookingId: Id<'bookings'>, startTime: string | undefined) {
		const query = queryString([
			['date', bookingDateParam(startTime)],
			['bookingId', bookingId]
		]);
		return `/app/${workspaceSlug}/bookings?${query}` as `/app/${string}/bookings?${string}`;
	}

	function customerPath(customerId: Id<'customers'>) {
		const query = queryString([['customerId', customerId]]);
		return `/app/${workspaceSlug}/customers?${query}` as `/app/${string}/customers?${string}`;
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="h-[96vh] w-[calc(100vw-1rem)] max-w-none gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-w-[1120px]"
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
			<DialogHeader class="shrink-0 border-b border-border px-4 py-4 pr-12 sm:px-6 sm:pr-14">
				<div class="space-y-3">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div class="min-w-0">
							<DialogTitle class="truncate text-base font-semibold">
								{submission.signerName}
							</DialogTitle>
							<DialogDescription class="text-xs text-muted-foreground">
								{submission.signerEmail}
							</DialogDescription>
						</div>
						<div
							class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
						>
							<CalendarClockIcon class="size-3.5" aria-hidden="true" />
							<span>
								{formatTimestamp(submission.submittedAt)}
							</span>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
						{#if submission.customerId}
							<a
								href={resolve(customerPath(submission.customerId))}
								class="-mx-1 inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:bg-muted/60 hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
							>
								<UsersRoundIcon class="size-3" aria-hidden="true" />
								<span class="truncate">Customer</span>
							</a>
						{/if}
						{#if submission.booking}
							{@const formattedStart = formatBookingTimestamp(submission.booking.startTime, {
								dateStyle: 'medium',
								timeStyle: 'short'
							})}
							{#if submission.bookingId}
								<a
									href={resolve(bookingPath(submission.bookingId, submission.booking.startTime))}
									class="-mx-1 inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:bg-muted/60 hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
								>
									<TicketIcon class="size-3" aria-hidden="true" />
									<span class="shrink-0">#{submission.booking.providerBookingId}</span>
									<span class="truncate font-normal text-muted-foreground">
										{submission.booking.activityName}
									</span>
								</a>
							{:else}
								<div class="flex min-w-0 items-center gap-1.5">
									<TicketIcon class="size-3" aria-hidden="true" />
									<span class="shrink-0 font-medium text-foreground">
										#{submission.booking.providerBookingId}
									</span>
									<span class="truncate">
										{submission.booking.activityName}
									</span>
								</div>
							{/if}
							{#if formattedStart}
								<div class="flex items-center gap-1.5 tabular-nums">
									<CalendarClockIcon class="size-3" aria-hidden="true" />
									<span>{formattedStart}</span>
								</div>
							{/if}
						{:else}
							<div class="flex items-center gap-1.5">
								<FileTextIcon class="size-3" aria-hidden="true" />
								<span class="font-medium text-foreground">General waiver</span>
								<span
									class="rounded-full border border-dashed border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground"
								>
									No booking attached
								</span>
							</div>
						{/if}
						<div class="flex items-center gap-1.5">
							<UsersRoundIcon class="size-3" aria-hidden="true" />
							<span>{participantSummary(submission.minors.length)}</span>
						</div>
					</div>
				</div>
			</DialogHeader>

			<div class="min-h-0 flex-1 overflow-y-auto bg-muted/20">
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
			</div>
		{/if}
	</DialogContent>
</Dialog>
