<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { toast } from 'svelte-sonner';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import SubmissionDetailSheet from '$lib/components/waivers/SubmissionDetailSheet.svelte';
	import QrCodeDialog from '$lib/components/waivers/QrCodeDialog.svelte';
	import { Button } from '$lib/components/ui/button';
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
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import LinkIcon from '@lucide/svelte/icons/link';
	import QrCodeIcon from '@lucide/svelte/icons/qr-code';
	import UserIcon from '@lucide/svelte/icons/user';
	import UsersIcon from '@lucide/svelte/icons/users';

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
	const progressPct = $derived(
		expectedCount > 0 ? Math.min(100, Math.round((signedCount / expectedCount) * 100)) : 0
	);

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
			toast.success('Booking waiver link copied.');
		} catch (error) {
			console.error('[bookings/detail] unable to copy booking link', error);
			toast.error('Unable to copy booking link.');
		}
	}

	function formatStartTime(timestamp: string | number | null) {
		if (!timestamp) return null;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	function formatSignedAt(timestamp: string | number | null) {
		if (!timestamp) return null;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}

	function formatSignedUser(user: SignedUser) {
		return user.kind === 'minor' ? `${user.name} (minor)` : user.name;
	}

	function getInitials(name: string): string {
		return name
			.split(' ')
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
			<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
				<div class="grid gap-4 pr-8 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
					<div class="space-y-2">
						<Skeleton class="h-3 w-16" />
						<SheetTitle><Skeleton class="h-5 w-48" /></SheetTitle>
						<SheetDescription class="space-y-1">
							<Skeleton class="h-3.5 w-36" />
							<Skeleton class="h-3.5 w-28" />
						</SheetDescription>
					</div>
					<div class="space-y-2">
						<Skeleton class="h-3 w-20" />
						<Skeleton class="h-4 w-36" />
						<Skeleton class="h-3.5 w-44" />
					</div>
				</div>
			</SheetHeader>
			<div class="min-h-0 flex-1 space-y-px overflow-y-auto">
				<div class="px-6 py-5">
					<Skeleton class="mb-3 h-3 w-24" />
					<Skeleton class="h-10 w-32" />
					<Skeleton class="mt-3 h-1.5 w-full rounded-full" />
					<Skeleton class="mt-2 h-3.5 w-40" />
				</div>
				<div class="border-t border-border px-6 py-4">
					<div class="flex gap-2">
						<Skeleton class="h-6 flex-1 rounded-md" />
						<Skeleton class="h-6 flex-1 rounded-md" />
					</div>
				</div>
				<div class="border-t border-border px-6 py-5">
					<Skeleton class="mb-4 h-4 w-20" />
					<div class="space-y-1">
						{#each [0, 1, 2] as i (i)}
							<div class="flex items-center gap-3 px-2.5 py-2">
								<Skeleton class="size-8 rounded-full" />
								<div class="flex-1 space-y-1.5">
									<Skeleton class="h-3.5 w-32" />
									<Skeleton class="h-3 w-44" />
								</div>
								<Skeleton class="h-3 w-20" />
							</div>
						{/each}
					</div>
				</div>
			</div>
		{:else if !detail}
			<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
				<SheetTitle>Booking not found</SheetTitle>
				<SheetDescription>This booking is no longer available.</SheetDescription>
			</SheetHeader>
		{:else}
			<!-- Header -->
			<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
				<div class="grid gap-4 pr-8 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
					<div class="min-w-0 space-y-2">
						<div class="flex items-center gap-2">
							<p
								class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
							>
								Booking
							</p>
							{#if isCanceled}
								<span
									class="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-destructive uppercase"
								>
									Canceled
								</span>
							{/if}
						</div>
						<SheetTitle
							class={cn(
								'min-w-0 truncate text-base leading-snug font-semibold',
								isCanceled && 'text-muted-foreground line-through decoration-muted-foreground/50'
							)}
						>
							{detail.booking.activityName}
						</SheetTitle>
						<div class="space-y-1 text-xs text-muted-foreground">
							{#if detail.booking.startTime && formatStartTime(detail.booking.startTime)}
								<p class="flex min-w-0 items-center gap-1.5">
									<ClockIcon class="size-3 shrink-0" aria-hidden="true" />
									<span class="truncate tabular-nums"
										>{formatStartTime(detail.booking.startTime)}</span
									>
								</p>
							{/if}
							<p class="truncate tabular-nums">Booking #{detail.booking.providerBookingId}</p>
						</div>
					</div>

					<div class="min-w-0 space-y-2">
						<p class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
							Customer
						</p>
						<div class="space-y-1 text-xs text-muted-foreground">
							<p class="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
								<UserIcon class="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
								<span class="truncate">{detail.booking.leadCustomerName ?? 'Unknown customer'}</span
								>
							</p>
							{#if detail.booking.leadCustomerEmail}
								<p class="truncate text-muted-foreground">{detail.booking.leadCustomerEmail}</p>
							{:else}
								<p class="truncate text-muted-foreground">No email on booking</p>
							{/if}
						</div>
					</div>
				</div>
			</SheetHeader>

			<!-- Body -->
			<div class="min-h-0 flex-1 overflow-y-auto">
				<!-- Coverage -->
				<section class="px-6 py-5">
					<p
						class="mb-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
					>
						Waiver coverage
					</p>

					<div class="flex items-baseline gap-2">
						<span
							class={cn(
								'text-4xl leading-none font-semibold tabular-nums',
								isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
							)}
						>
							{signedCount}
						</span>
						<span class="text-xl leading-none font-normal text-muted-foreground tabular-nums">
							/ {expectedCount}
						</span>
						<span class="ml-0.5 text-sm text-muted-foreground">guests signed</span>
					</div>

					<div
						class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-valuenow={signedCount}
						aria-valuemin={0}
						aria-valuemax={expectedCount}
						aria-label="Waiver coverage"
					>
						<div
							class={cn(
								'h-full rounded-full transition-all duration-700 ease-out',
								isComplete ? 'bg-emerald-500' : signedCount > 0 ? 'bg-primary' : 'w-0'
							)}
							style="width: {progressPct}%"
						></div>
					</div>

					<p class="mt-2 text-xs text-muted-foreground">
						{#if expectedCount === 0}
							No participants on this booking yet
						{:else if isComplete}
							<span
								class="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"
							>
								<CircleCheckIcon class="size-3.5" aria-hidden="true" />
								All waivers signed
							</span>
						{:else}
							{remainingCount}
							{remainingCount === 1 ? 'guest' : 'guests'} still to sign
						{/if}
					</p>
				</section>

				<!-- Share actions -->
				<div class="border-t border-border px-6 py-4">
					<div class="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							class="flex-1"
							onclick={copyBookingLink}
							disabled={!canShare}
							title={isCanceled
								? 'Canceled bookings cannot be shared'
								: !publicSlug
									? 'Publish a waiver to share links'
									: 'Copy booking waiver link'}
						>
							<LinkIcon class="size-3" aria-hidden="true" />
							Copy link
						</Button>
						<Button
							size="sm"
							variant="outline"
							class="flex-1"
							onclick={() => (qrDialogOpen = true)}
							disabled={!canShare}
							title={isCanceled
								? 'Canceled bookings cannot be shared'
								: !publicSlug
									? 'Publish a waiver to share QR codes'
									: 'Show booking QR code'}
						>
							<QrCodeIcon class="size-3" aria-hidden="true" />
							QR code
						</Button>
					</div>
				</div>

				<!-- Guest roster -->
				<section class="border-t border-border px-6 py-5">
					<div class="mb-4 flex items-center justify-between gap-3">
						<div class="flex items-center gap-2">
							<UsersIcon class="size-4 text-muted-foreground" aria-hidden="true" />
							<h3 class="text-sm font-semibold">Guests</h3>
						</div>
						{#if detail.signedUsers.length > 0 || remainingCount > 0}
							<div class="flex items-center gap-1.5">
								{#if signedCount > 0}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
									>
										<CircleCheckIcon class="size-3" aria-hidden="true" />
										{signedCount} signed
									</span>
								{/if}
								{#if remainingCount > 0}
									<span
										class="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
									>
										{remainingCount} pending
									</span>
								{/if}
							</div>
						{/if}
					</div>

					{#if detail.signedUsers.length === 0 && remainingCount === 0}
						<div
							class="rounded-xl border border-dashed border-border bg-card/20 px-4 py-8 text-center"
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
						<div class="space-y-0.5">
							{#each detail.signedUsers as user, index (`${user.submissionId}-${user.name}-${index}`)}
								<button
									type="button"
									class="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
									onclick={() => openSubmission(user.submissionId)}
								>
									<span
										class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
										aria-hidden="true"
									>
										{getInitials(user.name)}
									</span>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm leading-snug font-medium">
											{formatSignedUser(user)}
										</p>
										<p class="truncate text-xs leading-snug text-muted-foreground">
											{user.email ?? 'Signed as a minor'}
										</p>
									</div>
									<p class="shrink-0 text-xs text-muted-foreground tabular-nums">
										{formatSignedAt(user.submittedAt)}
									</p>
								</button>
							{/each}

							{#if remainingCount > 0}
								<div
									class="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-2.5 py-2.5"
								>
									<span
										class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
										aria-hidden="true"
									>
										<ClockIcon class="size-3.5" />
									</span>
									<p class="text-xs text-muted-foreground">
										<span class="font-medium text-foreground tabular-nums">{remainingCount}</span>
										{remainingCount === 1 ? 'guest has' : 'guests have'} not signed yet
									</p>
								</div>
							{/if}
						</div>
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
