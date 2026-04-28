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
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import MailIcon from '@lucide/svelte/icons/mail';
	import TicketIcon from '@lucide/svelte/icons/ticket';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';

	const metaItemClass =
		'min-w-0 border-t border-border pt-2 first:border-t-0 first:pt-0 sm:border-t-0 sm:border-l sm:px-3 sm:pt-0 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0';
	const metaLabelClass =
		'mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase';
	const metaLinkClass =
		'group/link inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-foreground/30 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none';

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

	function minorSummary(minorCount: number) {
		if (minorCount === 0) return null;
		return `${minorCount} ${minorCount === 1 ? 'minor' : 'minors'}`;
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

	function followUpPath(followUpId: Id<'email_follow_ups'>) {
		const query = queryString([['followUpId', followUpId]]);
		return `/app/${workspaceSlug}/emails?${query}` as `/app/${string}/emails?${string}`;
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
			<DialogHeader class="shrink-0 border-b border-border px-4 py-4 sm:px-6">
				<div class="space-y-3">
					<div
						class="flex flex-col gap-2 pr-8 sm:flex-row sm:items-start sm:justify-between sm:pr-10"
					>
						<div class="min-w-0">
							<DialogTitle class="truncate text-base font-semibold">
								{submission.signerName}
							</DialogTitle>
							<DialogDescription class="mt-0.5 truncate text-xs text-muted-foreground">
								{submission.signerEmail}
							</DialogDescription>
						</div>
					</div>

					<div
						class="grid gap-2 border-y border-border py-2 sm:grid-cols-[1fr_1.05fr_1.35fr_1.05fr] sm:gap-0"
					>
						<div class={metaItemClass}>
							<div class={metaLabelClass}>
								<CalendarClockIcon class="size-3" aria-hidden="true" />
								Signed
							</div>
							<p class="min-w-0 truncate text-xs font-medium text-foreground tabular-nums">
								{formatTimestamp(submission.submittedAt)}
							</p>
						</div>

						{#if submission.customerId}
							<div class={metaItemClass}>
								<div class={metaLabelClass}>
									<UsersRoundIcon class="size-3" aria-hidden="true" />
									Customer
								</div>
								<a href={resolve(customerPath(submission.customerId))} class={metaLinkClass}>
									<span class="truncate">{submission.signerName}</span>
									<span
										class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
									>
										<ArrowRightIcon class="size-2.5" aria-hidden="true" />
									</span>
								</a>
								{#if minorSummary(submission.minors.length)}
									<p class="shrink-0 text-[11px] text-muted-foreground tabular-nums">
										+ {minorSummary(submission.minors.length)}
									</p>
								{/if}
							</div>
						{:else}
							<div class={metaItemClass}>
								<div class={metaLabelClass}>
									<UsersRoundIcon class="size-3" aria-hidden="true" />
									Customer
								</div>
								<p class="min-w-0 truncate text-xs text-muted-foreground">No link</p>
								{#if minorSummary(submission.minors.length)}
									<p class="shrink-0 text-[11px] text-muted-foreground tabular-nums">
										+ {minorSummary(submission.minors.length)}
									</p>
								{/if}
							</div>
						{/if}

						{#if submission.booking}
							{@const formattedStart = formatBookingTimestamp(submission.booking.startTime, {
								dateStyle: 'medium',
								timeStyle: 'short'
							})}
							<div class={metaItemClass}>
								<div class={metaLabelClass}>
									<TicketIcon class="size-3" aria-hidden="true" />
									Booking
								</div>
								{#if submission.bookingId}
									<a
										href={resolve(bookingPath(submission.bookingId, submission.booking.startTime))}
										class={metaLinkClass}
									>
										<span class="shrink-0">#{submission.booking.providerBookingId}</span>
										<span class="truncate font-normal text-foreground/70">
											{submission.booking.activityName}
										</span>
										<span
											class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
										>
											<ArrowRightIcon class="size-2.5" aria-hidden="true" />
										</span>
									</a>
								{:else}
									<p class="min-w-0 truncate text-xs font-medium text-foreground">
										#{submission.booking.providerBookingId}
										<span class="font-normal text-muted-foreground">
											{submission.booking.activityName}
										</span>
									</p>
								{/if}
								{#if formattedStart}
									<p
										class="hidden shrink-0 text-[11px] text-muted-foreground tabular-nums xl:block"
									>
										{formattedStart}
									</p>
								{/if}
							</div>
						{:else}
							<div class={metaItemClass}>
								<div class={metaLabelClass}>
									<FileTextIcon class="size-3" aria-hidden="true" />
									Booking
								</div>
								<span class="min-w-0 truncate text-xs font-medium text-foreground">
									General waiver
								</span>
								<span class="ml-1 text-[11px] text-muted-foreground">No booking</span>
							</div>
						{/if}

						<div class={metaItemClass}>
							<div class={metaLabelClass}>
								<MailIcon class="size-3" aria-hidden="true" />
								Follow-up
							</div>
							{#if submission.followUpId}
								<a href={resolve(followUpPath(submission.followUpId))} class={metaLinkClass}>
									<span class="truncate">Email</span>
									<span
										class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
									>
										<ArrowRightIcon class="size-2.5" aria-hidden="true" />
									</span>
								</a>
							{:else}
								<p class="min-w-0 truncate text-xs text-muted-foreground">No follow-up</p>
							{/if}
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
