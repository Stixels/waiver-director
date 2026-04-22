<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { publicEnv } from '$lib/config/public';

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);

	const bookingsQuery = useProtectedQuery(
		api.bookings.listWorkspaceBookings,
		() => (currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);
	const waiverQuery = useProtectedQuery(
		api.waivers.getWorkspaceWaiver,
		() => (currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);

	type Booking = FunctionReturnType<typeof api.bookings.listWorkspaceBookings>[number];
	const bookings = $derived((bookingsQuery.data ?? []) as Booking[]);
	const publicSlug = $derived(waiverQuery.data?.publicSlug ?? null);
	const isLoading = $derived(
		bookingsQuery.isLoading || waiverQuery.isLoading || appContext.isLoading
	);

	function formatTimestamp(timestamp: string | null) {
		if (!timestamp) return 'Not scheduled';
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return 'Not scheduled';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	function bookingPublicUrl(booking: Booking) {
		if (!publicSlug) return '';
		const baseUrl =
			publicEnv.appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
		return new URL(`/w/${publicSlug}/b/${booking.lookupToken}`, baseUrl).toString();
	}

	async function copyBookingLink(booking: Booking) {
		const url = bookingPublicUrl(booking);
		if (!url) return;
		await navigator.clipboard.writeText(url);
		toast.success('Booking waiver link copied.');
	}
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Bookings | Waiver Director</title>
</svelte:head>

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-6xl min-w-0 space-y-5">
		<div class="space-y-1">
			<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Bookings</p>
			<h1 class="text-2xl font-semibold tracking-tight">Synced booking groups</h1>
			<p class="text-sm text-muted-foreground">
				Track expected participants, signed counts, and booking-specific waiver links.
			</p>
		</div>

		{#if isLoading}
			<div class="rounded-xl border border-border">
				{#each [0, 1, 2, 3, 4] as index (index)}
					<div class="grid grid-cols-5 gap-4 border-b border-border p-4 last:border-b-0">
						<Skeleton class="h-5 w-32" />
						<Skeleton class="h-5 w-36" />
						<Skeleton class="h-5 w-28" />
						<Skeleton class="h-5 w-20" />
						<Skeleton class="h-8 w-24" />
					</div>
				{/each}
			</div>
		{:else if !currentWorkspace}
			<div
				class="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
			>
				Workspace not found.
			</div>
		{:else if bookings.length === 0}
			<div
				class="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
			>
				No bookings have synced yet. Connect Bookeo from Integrations to start importing bookings.
			</div>
		{:else}
			<div class="rounded-xl border border-border">
				<Table class="table-fixed">
					<colgroup>
						<col class="w-[27%]" />
						<col class="w-[19%]" />
						<col class="w-[18%]" />
						<col class="w-[12%]" />
						<col class="w-[12%]" />
						<col class="w-[12%]" />
					</colgroup>
					<TableHeader>
						<TableRow class="border-border hover:bg-transparent">
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Booking
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Time
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Lead
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Status
							</TableHead>
							<TableHead
								class="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Signed
							</TableHead>
							<TableHead
								class="text-right text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
							>
								Link
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each bookings as booking (booking.bookingId)}
							<TableRow class="border-border">
								<TableCell>
									<p class="truncate text-sm font-medium">{booking.title}</p>
									<p class="mt-0.5 text-xs text-muted-foreground">#{booking.providerBookingId}</p>
								</TableCell>
								<TableCell class="text-sm text-muted-foreground">
									{formatTimestamp(booking.startTime)}
								</TableCell>
								<TableCell>
									<p class="truncate text-sm">{booking.leadCustomerName ?? 'Unknown'}</p>
									<p class="truncate text-xs text-muted-foreground">
										{booking.leadCustomerEmail ?? 'No email'}
									</p>
								</TableCell>
								<TableCell>
									<Badge variant={booking.status === 'active' ? 'secondary' : 'outline'}>
										{booking.status}
									</Badge>
								</TableCell>
								<TableCell class="text-sm text-muted-foreground">
									{booking.signedCount} / {booking.participantCount}
								</TableCell>
								<TableCell class="text-right">
									<Button
										size="sm"
										variant="outline"
										onclick={() => copyBookingLink(booking)}
										disabled={!publicSlug || booking.status !== 'active'}
									>
										Copy
									</Button>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		{/if}
	</div>
</div>
