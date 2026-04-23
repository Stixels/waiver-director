<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { toast } from 'svelte-sonner';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
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
	import UserIcon from '@lucide/svelte/icons/user';
	import UsersIcon from '@lucide/svelte/icons/users';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
		bookingId: Id<'bookings'>;
		publicSlug: string | null;
	}

	let { open = $bindable(), workspaceId, bookingId, publicSlug }: Props = $props();

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
	const percent = $derived(
		expectedCount === 0 ? 0 : Math.min(100, Math.round((signedCount / expectedCount) * 100))
	);
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
		await navigator.clipboard.writeText(url);
		toast.success('Booking waiver link copied.');
	}

	function formatTimestamp(timestamp: string | number | null) {
		if (!timestamp) return null;
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	function formatSignedUser(user: SignedUser) {
		return user.kind === 'minor' ? `${user.name} (minor)` : user.name;
	}
</script>

<Sheet bind:open>
	<SheetContent side="right" class="w-full gap-0 overflow-hidden p-0 sm:max-w-xl">
		{#if isLoading}
			<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
				<SheetTitle><Skeleton class="h-5 w-48" /></SheetTitle>
				<SheetDescription><Skeleton class="h-3.5 w-64" /></SheetDescription>
			</SheetHeader>
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
				<Skeleton class="h-24 w-full rounded-xl" />
				<Skeleton class="h-32 w-full rounded-xl" />
			</div>
		{:else if !detail}
			<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
				<SheetTitle>Booking not found</SheetTitle>
				<SheetDescription>This booking is no longer available.</SheetDescription>
			</SheetHeader>
		{:else}
			<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
				<div class="flex items-start justify-between gap-4 pr-8">
					<div class="min-w-0 space-y-1">
						<SheetTitle
							class={cn(
								'truncate text-base font-semibold',
								isCanceled && 'line-through decoration-muted-foreground/60'
							)}
						>
							{detail.booking.productName ?? detail.booking.title}
						</SheetTitle>
						<SheetDescription class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
							<span class="inline-flex items-center gap-1">
								<UserIcon class="size-3" aria-hidden="true" />
								{detail.booking.leadCustomerName ?? 'Unknown customer'}
							</span>
							{#if detail.booking.startTime && formatTimestamp(detail.booking.startTime)}
								<span class="text-muted-foreground/50" aria-hidden="true">·</span>
								<span class="inline-flex items-center gap-1">
									<ClockIcon class="size-3" aria-hidden="true" />
									{formatTimestamp(detail.booking.startTime)}
								</span>
							{/if}
							{#if isCanceled}
								<span class="text-muted-foreground/50" aria-hidden="true">·</span>
								<span class="font-medium text-destructive">Canceled</span>
							{/if}
						</SheetDescription>
					</div>
				</div>
			</SheetHeader>

			<div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
				<section
					class={cn(
						'rounded-xl border p-4',
						isComplete ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card/30'
					)}
				>
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0">
							<p
								class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
							>
								Waiver coverage
							</p>
							<p class="mt-2 text-3xl font-semibold tabular-nums">
								{signedCount}
								<span class="text-xl font-medium text-muted-foreground">/ {expectedCount}</span>
							</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{#if expectedCount === 0}
									No participants on this booking yet
								{:else if isComplete}
									<span class="inline-flex items-center gap-1 font-medium text-emerald-600">
										<CircleCheckIcon class="size-3.5" aria-hidden="true" />
										All waivers signed
									</span>
								{:else}
									{remainingCount} still to sign
								{/if}
							</p>
						</div>
						<Button
							size="sm"
							onclick={copyBookingLink}
							disabled={!canShare}
							title={isCanceled
								? 'Canceled bookings cannot be shared'
								: !publicSlug
									? 'Publish a waiver to share links'
									: 'Copy booking waiver link'}
						>
							<LinkIcon class="size-3" aria-hidden="true" />
							Share link
						</Button>
					</div>
					<div
						class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-valuenow={percent}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-label="Signed waiver progress"
					>
						<div
							class={cn(
								'h-full rounded-full transition-all',
								isCanceled
									? 'bg-muted-foreground/40'
									: isComplete
										? 'bg-emerald-500'
										: signedCount === 0
											? 'bg-muted-foreground/60'
											: 'bg-primary'
							)}
							style="width: {percent}%"
						></div>
					</div>
				</section>

				<section class="space-y-3">
					<div class="flex items-center justify-between gap-3">
						<div class="flex items-center gap-2">
							<UsersIcon class="size-4 text-muted-foreground" aria-hidden="true" />
							<h3 class="text-sm font-semibold">Guests</h3>
						</div>
						<p class="text-xs text-muted-foreground tabular-nums">
							{signedCount} signed
							{#if remainingCount > 0}
								<span class="text-muted-foreground/50">·</span>
								{remainingCount} pending
							{/if}
						</p>
					</div>

					{#if detail.signedUsers.length === 0}
						<div class="rounded-xl border border-dashed border-border bg-card/20 p-6 text-center">
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
						<div class="overflow-hidden rounded-xl border border-border">
							{#each detail.signedUsers as user, index (`${user.submissionId}-${user.name}-${index}`)}
								<div
									class="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
								>
									<div class="flex min-w-0 items-center gap-3">
										<span
											class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"
											aria-hidden="true"
										>
											<CircleCheckIcon class="size-3.5" />
										</span>
										<div class="min-w-0">
											<p class="truncate text-sm font-medium">{formatSignedUser(user)}</p>
											<p class="truncate text-xs text-muted-foreground">
												{user.email ?? 'Signed as a minor'}
											</p>
										</div>
									</div>
									<p class="shrink-0 text-xs text-muted-foreground tabular-nums">
										{formatTimestamp(user.submittedAt)}
									</p>
								</div>
							{/each}

							{#if remainingCount > 0}
								<div
									class="flex items-center gap-3 border-t border-dashed border-border bg-muted/30 px-3 py-2.5"
								>
									<span
										class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
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
