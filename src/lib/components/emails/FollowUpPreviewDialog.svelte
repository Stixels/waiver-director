<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { escapeHtml } from '$lib/utils/rich-text';
	import { queryString } from '$lib/utils/url';
	import { useConvexClient } from 'convex-svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { toast } from 'svelte-sonner';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import TicketIcon from '@lucide/svelte/icons/ticket';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';

	type FollowUp = NonNullable<FunctionReturnType<typeof api.emails.getFollowUp>>;

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
		workspaceSlug: string;
		workspaceName: string;
		followUpId: Id<'email_follow_ups'> | null;
		onOpenChange?: (open: boolean) => void;
	}

	let {
		open = $bindable(),
		workspaceId,
		workspaceSlug,
		workspaceName,
		followUpId,
		onOpenChange
	}: Props = $props();

	const convex = useConvexClient();
	const metaLinkClass =
		'group/link inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-foreground/30 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none';
	const metaItemClass =
		'min-w-0 border-t border-border px-4 py-3 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0';
	const metaLabelClass =
		'mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase';

	let rowLoading = $state<Id<'email_follow_ups'> | null>(null);

	const followUpQuery = useProtectedQuery(
		api.emails.getFollowUp,
		() => (followUpId ? { workspaceId, followUpId } : 'skip'),
		() => ({ keepPreviousData: true })
	);
	const editorContentQuery = useProtectedQuery(
		api.emails.getEmailEditorContent,
		() => ({ workspaceId }),
		() => ({ keepPreviousData: true })
	);
	const senderSettingsQuery = useProtectedQuery(
		api.emails.getWorkspaceEmailSenderSettings,
		() => ({ workspaceId }),
		() => ({ keepPreviousData: true })
	);

	const followUp = $derived((followUpQuery.data ?? null) as FollowUp | null);
	const editorContent = $derived(editorContentQuery.data ?? null);
	const senderSettings = $derived(senderSettingsQuery.data ?? null);
	const isLoading = $derived(followUpQuery.isLoading && !followUp);
	const workspaceCanSendEmail = $derived(Boolean(senderSettings?.canSendEmails));
	const senderUnavailableMessage = $derived(
		senderSettings?.platformFromEmail
			? 'Verify a reply-to email before sending follow-ups.'
			: 'Sender domain is not configured. Set RESEND_FROM_EMAIL before sending follow-ups.'
	);
	const followUpLoadErrorMessage = $derived(
		followUpQuery.error
			? getConvexErrorMessage(followUpQuery.error, 'Unable to load this follow-up.')
			: 'This follow-up no longer exists or is unavailable.'
	);

	function formatTimestamp(ts: number) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(ts)
		);
	}

	function parseTimestamp(value: string | null | undefined) {
		if (!value) return null;
		const timestamp = Date.parse(value);
		return Number.isNaN(timestamp) ? null : timestamp;
	}

	function formatActivityDate(item: FollowUp | number) {
		const bookingStartAt = typeof item === 'number' ? null : parseTimestamp(item.bookingStartTime);
		const submittedAt = typeof item === 'number' ? item : item.submittedAt;
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
			new Date(bookingStartAt ?? submittedAt)
		);
	}

	function closeDialog() {
		open = false;
		onOpenChange?.(false);
	}

	function bookingDateParam(startTime: string | null | undefined) {
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

	function submissionPath(submissionId: Id<'waiver_submissions'>) {
		const query = queryString([['submissionId', submissionId]]);
		return `/app/${workspaceSlug}/submissions?${query}` as `/app/${string}/submissions?${string}`;
	}

	function bookingPath(bookingId: Id<'bookings'>, startTime: string | null | undefined) {
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

	function resolveTemplate(template: string, item: FollowUp) {
		const bookingId = item.bookingNumber ? `#${item.bookingNumber}` : '';
		return template
			.replace(/\{\{customer_name\}\}|\{customer_name\}/g, item.signerName)
			.replace(/\{\{booking_id\}\}|\{booking_id\}/g, bookingId)
			.replace(/\{\{business_name\}\}|\{business_name\}/g, workspaceName)
			.replace(/\{\{activity_date\}\}|\{activity_date\}/g, formatActivityDate(item));
	}

	function resolveHtmlTemplate(template: string, item: FollowUp) {
		const bookingId = item.bookingNumber ? `#${item.bookingNumber}` : '';
		return template
			.replace(/\{\{customer_name\}\}|\{customer_name\}/g, escapeHtml(item.signerName))
			.replace(/\{\{booking_id\}\}|\{booking_id\}/g, escapeHtml(bookingId))
			.replace(/\{\{business_name\}\}|\{business_name\}/g, escapeHtml(workspaceName))
			.replace(/\{\{activity_date\}\}|\{activity_date\}/g, escapeHtml(formatActivityDate(item)));
	}

	const resolvedSubject = $derived.by(() => {
		if (!followUp) return '';
		if (followUp.sentSubject) return followUp.sentSubject;
		return resolveTemplate(followUp.subjectTemplate ?? editorContent?.subject ?? '', followUp);
	});

	const resolvedBodyHtml = $derived.by(() => {
		if (!followUp) return '';
		if (followUp.sentBodyHtml) return followUp.sentBodyHtml;
		return resolveHtmlTemplate(followUp.bodyTemplate ?? editorContent?.body ?? '<p></p>', followUp);
	});

	async function handleRowAction(action: 'send' | 'unschedule') {
		if (!followUp) return;
		if (action === 'send' && !workspaceCanSendEmail) {
			toast.error(senderUnavailableMessage);
			return;
		}

		rowLoading = followUp._id;
		try {
			if (action === 'send') {
				await convex.mutation(api.emails.sendFollowUpNow, { followUpId: followUp._id });
				toast.message('Follow-up queued for delivery.');
			} else {
				await convex.mutation(api.emails.unscheduleFollowUp, { followUpId: followUp._id });
				toast.success('Follow-up unscheduled.');
			}
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Action failed.'));
		} finally {
			rowLoading = null;
		}
	}
</script>

<Dialog bind:open {onOpenChange}>
	<DialogContent class="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-[860px]">
		{#if isLoading}
			<DialogHeader class="shrink-0 border-b border-border px-4 py-4 sm:px-6">
				<DialogTitle><Skeleton class="h-5 w-44" /></DialogTitle>
				<DialogDescription><Skeleton class="mt-1 h-3.5 w-56" /></DialogDescription>
			</DialogHeader>
			<div class="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 px-4 py-5 sm:px-6">
				<Skeleton class="h-16 w-full rounded-lg" />
				<Skeleton class="h-48 w-full rounded-xl" />
			</div>
		{:else if followUp}
			<DialogHeader class="shrink-0 border-b border-border p-0">
				<div class="border-b border-border px-4 py-4">
					<div
						class="flex flex-col gap-2 pr-8 sm:flex-row sm:items-start sm:justify-between sm:pr-10"
					>
						<DialogTitle class="truncate text-base font-semibold">
							{followUp.signerName}
						</DialogTitle>
						<DialogDescription class="truncate text-xs text-muted-foreground sm:text-right">
							{followUp.signerEmail}
						</DialogDescription>
					</div>
				</div>

				<div class="grid bg-muted/10 sm:grid-cols-[1fr_1.05fr_1.35fr_1.05fr]">
					<div class={metaItemClass}>
						<div class={metaLabelClass}>
							<CalendarClockIcon class="size-3" aria-hidden="true" />
							Signed
						</div>
						<p class="min-w-0 truncate text-xs font-medium text-foreground tabular-nums">
							{formatActivityDate(followUp.submittedAt)}
						</p>
						{#if followUp.status === 'queued' && followUp.scheduledAt != null}
							<p class="shrink-0 text-[11px] text-muted-foreground tabular-nums">
								Scheduled for {formatTimestamp(followUp.scheduledAt)}
							</p>
						{/if}
					</div>

					<div class={metaItemClass}>
						<div class={metaLabelClass}>
							<UsersRoundIcon class="size-3" aria-hidden="true" />
							Customer
						</div>
						{#if followUp.customerId}
							<a href={resolve(customerPath(followUp.customerId))} class={metaLinkClass}>
								<span class="truncate">{followUp.signerName}</span>
								<span
									class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
								>
									<ArrowRightIcon class="size-2.5" aria-hidden="true" />
								</span>
							</a>
						{:else}
							<p class="min-w-0 truncate text-xs text-muted-foreground">No link</p>
						{/if}
					</div>

					<div class={metaItemClass}>
						<div class={metaLabelClass}>
							<TicketIcon class="size-3" aria-hidden="true" />
							Booking
						</div>
						{#if followUp.bookingId && followUp.bookingNumber}
							<a
								href={resolve(bookingPath(followUp.bookingId, followUp.bookingStartTime))}
								class={metaLinkClass}
							>
								<span class="shrink-0">#{followUp.bookingNumber}</span>
								{#if followUp.bookingActivityName}
									<span class="truncate font-normal text-foreground/70">
										{followUp.bookingActivityName}
									</span>
								{/if}
								<span
									class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
								>
									<ArrowRightIcon class="size-2.5" aria-hidden="true" />
								</span>
							</a>
						{:else if followUp.bookingNumber}
							<p class="min-w-0 truncate text-xs font-medium text-foreground">
								#{followUp.bookingNumber}
								{#if followUp.bookingActivityName}
									<span class="font-normal text-muted-foreground">
										{followUp.bookingActivityName}
									</span>
								{/if}
							</p>
						{:else}
							<p class="min-w-0 truncate text-xs text-muted-foreground">No booking</p>
						{/if}
					</div>

					<div class={metaItemClass}>
						<div class={metaLabelClass}>
							<FileTextIcon class="size-3" aria-hidden="true" />
							Submission
						</div>
						<a href={resolve(submissionPath(followUp.submissionId))} class={metaLinkClass}>
							<span class="truncate">Waiver</span>
							<span
								class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
							>
								<ArrowRightIcon class="size-2.5" aria-hidden="true" />
							</span>
						</a>
					</div>
				</div>
			</DialogHeader>

			<div class="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-5 sm:px-6">
				<div class="space-y-5">
					<section class="space-y-1.5">
						<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
							Subject
						</p>
						<p class="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
							{resolvedSubject}
						</p>
					</section>

					<section class="space-y-1.5">
						<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
							Body
						</p>
						<WaiverRichText
							html={resolvedBodyHtml}
							class="overflow-hidden rounded-xl border border-border bg-background px-4 py-3 text-sm leading-7 wrap-break-word text-foreground shadow-sm"
						/>
					</section>
				</div>
			</div>

			{#if ['queued', 'unscheduled', 'failed', 'blocked'].includes(followUp.status)}
				<div class="flex items-center justify-between border-t border-border px-6 py-4">
					{#if followUp.status === 'queued'}
						<Button
							variant="destructive"
							size="sm"
							onclick={() => handleRowAction('unschedule')}
							disabled={rowLoading === followUp._id}
						>
							Unschedule follow-up
						</Button>
					{:else}
						<span></span>
					{/if}
					<div class="flex gap-2">
						<span title={!workspaceCanSendEmail ? senderUnavailableMessage : undefined}>
							<Button
								size="sm"
								onclick={() => handleRowAction('send')}
								disabled={rowLoading === followUp._id || !workspaceCanSendEmail}
							>
								{rowLoading === followUp._id ? 'Sending...' : 'Send now'}
							</Button>
						</span>
					</div>
				</div>
			{/if}
		{:else}
			<DialogHeader class="shrink-0 border-b border-border px-4 py-4 sm:px-6">
				<DialogTitle class="text-base font-semibold">Follow-up unavailable</DialogTitle>
				<DialogDescription class="text-sm text-muted-foreground">
					{followUpLoadErrorMessage}
				</DialogDescription>
			</DialogHeader>
			<div class="min-h-0 flex-1 bg-muted/20 px-4 py-5 sm:px-6">
				<div
					class="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground"
				>
					The selected follow-up could not be opened. It may have been deleted or moved out of this
					workspace.
				</div>
			</div>
			<div class="flex justify-end border-t border-border px-6 py-4">
				<Button size="sm" variant="outline" onclick={closeDialog}>Close</Button>
			</div>
		{/if}
	</DialogContent>
</Dialog>
