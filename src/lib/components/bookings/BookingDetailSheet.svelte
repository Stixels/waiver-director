<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { toast } from 'svelte-sonner';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import SubmissionDetailSheet from '$lib/components/waivers/SubmissionDetailSheet.svelte';
	import QrCodeDialog from '$lib/components/waivers/QrCodeDialog.svelte';
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetHeader,
		SheetTitle
	} from '$lib/components/ui/sheet';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { publicEnv } from '$lib/config/public';
	import { cn } from '$lib/utils';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import LinkIcon from '@lucide/svelte/icons/link';
	import QrCodeIcon from '@lucide/svelte/icons/qr-code';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
		workspaceSlug: string;
		bookingId: Id<'bookings'>;
		publicSlug: string | null;
	}

	let { open = $bindable(), workspaceId, workspaceSlug, bookingId, publicSlug }: Props = $props();
	let selectedSubmissionId = $state<Id<'waiver_submissions'> | null>(null);
	let submissionDetailOpen = $state(false);
	let qrDialogOpen = $state(false);
	let copied = $state(false);

	type BookingDetail = NonNullable<
		FunctionReturnType<typeof api.bookings.getWorkspaceBookingDetail>
	>;
	type SignedUser = BookingDetail['signedUsers'][number];

	const bookingQuery = useProtectedQuery(
		api.bookings.getWorkspaceBookingDetail,
		() => ({ workspaceId, bookingId }),
		() => ({ keepPreviousData: true })
	);

	const detail = $derived((bookingQuery.data ?? null) as BookingDetail | null);
	const isLoading = $derived(bookingQuery.isLoading);
	const isCanceled = $derived(detail?.booking.status === 'canceled');
	const signedCount = $derived(detail?.booking.signedCount ?? 0);
	const expectedCount = $derived(detail?.booking.participantCount ?? 0);
	const remainingCount = $derived(Math.max(0, expectedCount - signedCount));
	const isComplete = $derived(expectedCount > 0 && signedCount >= expectedCount);
	const canShare = $derived(!!publicSlug && !isCanceled && !!detail);

	function bookingPublicUrl() {
		if (!publicSlug || !detail) return '';
		const baseUrl =
			publicEnv.appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
		return new URL(`/w/${publicSlug}/b/${detail.booking.lookupToken}`, baseUrl).toString();
	}

	async function copyBookingLink() {
		const url = bookingPublicUrl();
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (error) {
			console.error('[bookings/detail] unable to copy booking link', error);
			toast.error('Unable to copy booking link.');
		}
	}

	function formatStartTime(timestamp: string | number | null) {
		if (timestamp == null) return null;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	function formatRelativeTime(timestamp: string | number | null) {
		if (timestamp == null) return null;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return null;
		const diff = (Date.now() - date.getTime()) / 1000;
		if (diff < 60) return 'just now';
		if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
	}

	function getInitials(name: string): string {
		return name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((n) => n[0] ?? '')
			.join('')
			.toUpperCase();
	}

	function openSubmission(submissionId: Id<'waiver_submissions'>) {
		selectedSubmissionId = submissionId;
		submissionDetailOpen = true;
	}
</script>

{#if selectedSubmissionId}
	<SubmissionDetailSheet
		bind:open={submissionDetailOpen}
		{workspaceId}
		{workspaceSlug}
		submissionId={selectedSubmissionId}
	/>
{/if}

<Sheet bind:open>
	<SheetContent side="right" class="w-full! gap-0 overflow-hidden p-0 sm:max-w-xl!">
		{#if isLoading}
			<!-- Skeleton -->
			<SheetHeader class="shrink-0 border-b border-border px-4 py-4">
				<div class="flex items-start gap-3 pr-8">
					<Skeleton class="size-10 shrink-0 rounded-full" />
					<div class="flex-1 space-y-2 pt-0.5">
						<Skeleton class="h-4 w-44" />
						<Skeleton class="h-3 w-52" />
						<Skeleton class="h-3 w-36" />
					</div>
				</div>
				<Skeleton class="mt-3 h-[6px] w-full rounded-sm" />
				<Skeleton class="mt-1.5 h-3.5 w-32" />
			</SheetHeader>
			<div class="grid grid-cols-2 shrink-0 border-b border-border">
				<div class="flex flex-col items-center gap-1.5 border-r border-border py-3">
					<Skeleton class="size-[18px] rounded" />
					<Skeleton class="h-2.5 w-12" />
				</div>
				<div class="flex flex-col items-center gap-1.5 py-3">
					<Skeleton class="size-[18px] rounded" />
					<Skeleton class="h-2.5 w-14" />
				</div>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				<Skeleton class="mb-2.5 h-3 w-20" />
				{#each [0, 1, 2] as i (i)}
					<div class="flex items-center gap-3 rounded-lg px-2 py-1.5">
						<Skeleton class="size-8 shrink-0 rounded-full" />
						<div class="flex-1 space-y-1.5">
							<Skeleton class="h-3.5 w-28" />
							<Skeleton class="h-3 w-40" />
						</div>
						<Skeleton class="h-3 w-10" />
					</div>
				{/each}
			</div>
		{:else if !detail}
			<SheetHeader class="shrink-0 border-b border-border px-4 py-4">
				<SheetTitle>Booking not found</SheetTitle>
				<SheetDescription>This booking is no longer available.</SheetDescription>
			</SheetHeader>
		{:else}
			<!-- ── Header: status ring + info + segmented bar ───────────────────── -->
			<SheetHeader class="shrink-0 border-b border-border px-4 pb-3 pt-4">
				<div class="flex items-start gap-3 pr-9">
					<!-- Completion ring -->
					<div
						class={cn(
							'flex size-10 shrink-0 items-center justify-center rounded-full border-2',
							isComplete
								? 'border-emerald-500'
								: isCanceled
									? 'border-destructive'
									: 'border-primary'
						)}
						aria-hidden="true"
					>
						<span
							class={cn(
								'text-[11px] font-bold tabular-nums leading-none',
								isComplete ? 'text-emerald-500' : 'text-foreground'
							)}
						>
							{signedCount}/{expectedCount}
						</span>
					</div>

					<!-- Activity info -->
					<div class="min-w-0 flex-1 pt-0.5">
						{#if isCanceled}
							<span
								class="mb-1 inline-block rounded border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive"
							>
								Canceled
							</span>
						{/if}
						<SheetTitle
							class={cn(
								'truncate text-[15px] font-semibold leading-snug tracking-tight',
								isCanceled && 'text-muted-foreground line-through decoration-muted-foreground/50'
							)}
						>
							{detail.booking.activityName}
						</SheetTitle>
						<!-- Time + booking ID -->
						<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
							{#if detail.booking.startTime != null && formatStartTime(detail.booking.startTime)}
								<span class="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
									<ClockIcon class="size-3" aria-hidden="true" />
									<span class="tabular-nums">{formatStartTime(detail.booking.startTime)}</span>
								</span>
							{/if}
							<span class="font-mono text-[11px] tabular-nums text-muted-foreground/80"
								>#{detail.booking.providerBookingId}</span
							>
						</div>
						<!-- Customer name · email -->
						<div class="mt-0.5 flex min-w-0 items-center gap-1 text-[11px]">
							<span class="truncate font-medium text-foreground/80"
								>{detail.booking.leadCustomerName ?? 'Unknown customer'}</span
							>
							{#if detail.booking.leadCustomerEmail}
								<span class="shrink-0 text-muted-foreground/50">·</span>
								<span class="truncate font-mono text-muted-foreground"
									>{detail.booking.leadCustomerEmail}</span
								>
							{/if}
						</div>
					</div>
				</div>

				<!-- Segmented coverage bar -->
				{#if expectedCount > 0}
					<div class="mt-3 flex gap-[3px]" aria-hidden="true">
						{#each Array.from({ length: expectedCount }, (_, i) => i) as i (i)}
							<div
								class={cn(
									'h-[7px] flex-1 rounded-sm border transition-colors duration-300',
									i < signedCount
										? isComplete
											? 'border-emerald-500 bg-emerald-500'
											: 'border-primary/25 bg-primary dark:border-primary/40'
										: 'border-border/80 bg-muted/70 dark:bg-muted/80'
								)}
							></div>
						{/each}
					</div>
					<!-- Fixed-height status line: no layout shift -->
					<div class="mt-1.5 flex h-[18px] items-center">
						{#if isComplete}
							<span
								class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500"
							>
								<CircleCheckIcon class="size-3" aria-hidden="true" />
								All waivers signed
							</span>
						{:else}
							<p class="text-[11px] text-muted-foreground">
								{remainingCount}
								{remainingCount === 1 ? 'guest' : 'guests'} still to sign
							</p>
						{/if}
					</div>
				{/if}
			</SheetHeader>

			<!-- ── Share: icon-heavy 2-column ──────────────────────────────────── -->
			<div class="grid shrink-0 grid-cols-2 border-b border-border">
				<button
					type="button"
					class={cn(
						'flex flex-col items-center gap-1.5 border-r border-border py-3 transition-colors',
						canShare
							? 'cursor-pointer text-primary hover:bg-primary/5 dark:text-[color-mix(in_oklch,var(--primary)_32%,var(--primary-foreground))]'
							: 'cursor-not-allowed text-muted-foreground/30'
					)}
					onclick={() => canShare && (qrDialogOpen = true)}
					disabled={!canShare}
					title={isCanceled
						? 'Canceled bookings cannot be shared'
						: !publicSlug
							? 'Publish a waiver to share QR codes'
							: 'Show booking QR code'}
				>
					<QrCodeIcon class="size-[18px]" aria-hidden="true" />
					<span class="text-[11px] font-medium">QR code</span>
				</button>
				<button
					type="button"
					class={cn(
						'flex flex-col items-center gap-1.5 py-3 transition-colors',
						copied
							? 'text-emerald-500'
							: canShare
								? 'cursor-pointer text-muted-foreground hover:bg-muted/40 hover:text-foreground'
								: 'cursor-not-allowed text-muted-foreground/30'
					)}
					onclick={copyBookingLink}
					disabled={!canShare}
					title={isCanceled
						? 'Canceled bookings cannot be shared'
						: !publicSlug
							? 'Publish a waiver to share links'
							: 'Copy booking waiver link'}
				>
					{#if copied}
						<CircleCheckIcon class="size-[18px]" aria-hidden="true" />
					{:else}
						<LinkIcon class="size-[18px]" aria-hidden="true" />
					{/if}
					<span class="text-[11px] font-medium">{copied ? 'Copied!' : 'Copy link'}</span>
				</button>
			</div>

			<!-- ── Guest roster ─────────────────────────────────────────────────── -->
			<div class="min-h-0 flex-1 overflow-y-auto">
				<section class="px-4 py-3">
					<div class="mb-2 flex items-center justify-between px-2">
						<span class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
							Guests{#if detail.signedUsers.length > 0}&nbsp;·&nbsp;{detail.signedUsers.length} signed{/if}
						</span>
						{#if remainingCount > 0 && !isCanceled}
							<span class="text-[11px] text-muted-foreground">{remainingCount} pending</span>
						{/if}
					</div>

					{#if detail.signedUsers.length === 0 && remainingCount === 0}
						<div
							class="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center"
						>
							<p class="text-sm font-medium">No waivers signed yet</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{#if canShare}
									Share the booking link to invite guests to sign.
								{:else if isCanceled}
									This booking has been canceled.
								{:else}
									Publish a waiver to start collecting signatures.
								{/if}
							</p>
						</div>
					{:else}
						{#if detail.signedUsers.length === 0}
							<div class="px-2 py-6 text-center">
								<p class="text-xs text-muted-foreground/50">No waivers signed yet</p>
							</div>
						{:else}
							<div class="flex flex-col">
								{#each detail.signedUsers as user, index (`${user.submissionId}-${user.name}-${index}`)}
									<button
										type="button"
										class="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
										onclick={() => openSubmission(user.submissionId)}
									>
										<!-- Avatar -->
										<span
											class={cn(
												'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
												user.kind === 'minor'
													? 'bg-amber-500/15 text-amber-500'
													: 'border border-primary/25 bg-primary/8 text-primary dark:border-primary/40 dark:bg-primary/15 dark:text-[color-mix(in_oklch,var(--primary)_32%,var(--primary-foreground))]'
											)}
											aria-hidden="true"
										>
											{getInitials(user.name)}
										</span>
										<!-- Name + email -->
										<div class="min-w-0 flex-1">
											<div class="flex min-w-0 items-center gap-1.5">
												<p class="truncate text-[13px] font-medium leading-snug">{user.name}</p>
												{#if user.kind === 'minor'}
													<span
														class="shrink-0 rounded border border-amber-500/20 bg-amber-500/10 px-1 py-px text-[10px] font-medium leading-tight text-amber-500"
													>
														minor
													</span>
												{/if}
											</div>
											<p class="truncate text-[11px] leading-snug text-muted-foreground">
												{user.email ?? 'Signed as minor'}
											</p>
										</div>
										<!-- Time + chevron -->
										<div class="flex shrink-0 items-center gap-1">
											<span class="text-[11px] tabular-nums text-muted-foreground">
												{formatRelativeTime(user.submittedAt)}
											</span>
											<ChevronRightIcon
												class="size-3 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
												aria-hidden="true"
											/>
										</div>
									</button>
								{/each}
							</div>
						{/if}

						{#if remainingCount > 0 && !isCanceled}
							<div
								class="mx-2 mt-2 rounded-md border border-primary/25 bg-primary/8 px-3 py-2 dark:border-primary/40 dark:bg-primary/15"
							>
								<p class="text-[11px] text-muted-foreground">
									{remainingCount}
									{remainingCount === 1 ? 'guest' : 'guests'} still to sign
								</p>
							</div>
						{/if}
					{/if}
				</section>
			</div>
		{/if}
	</SheetContent>
</Sheet>

{#if detail && canShare}
	<QrCodeDialog
		bind:open={qrDialogOpen}
		title="Booking QR code"
		description="Scan to open the waiver for {detail.booking.activityName}."
		url={bookingPublicUrl()}
		copySuccessMessage="Booking waiver link copied."
		copyErrorMessage="Unable to copy booking link."
		logContext="bookings/detail"
	/>
{/if}
