<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Badge, type BadgeVariant } from '$lib/components/ui/badge';
	import MailIcon from '@lucide/svelte/icons/mail';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	type Pipeline = {
		queued: number;
		sent: number;
		failed: number;
		blocked: number;
		unscheduled: number;
	};

	type RecentQueued = {
		followUpId: string;
		signerName: string;
		signerEmail: string;
		scheduledAt: number | null;
		submittedAt: number;
	};

	let {
		pipeline,
		recentQueued,
		isLoading
	}: {
		pipeline: Pipeline | null | undefined;
		recentQueued: RecentQueued[] | null | undefined;
		isLoading: boolean;
	} = $props();

	const workspaceSlug = $derived(page.params.workspaceSlug);
	const chipSkeletonRows = [0, 1, 2, 3, 4];
	const queuedSkeletonRows = [0, 1, 2, 3, 4, 5];

	const statusChips = $derived([
		{ label: 'Queued', count: pipeline?.queued ?? 0, variant: 'secondary' as const },
		{ label: 'Sent', count: pipeline?.sent ?? 0, variant: 'secondary' as const },
		{
			label: 'Failed',
			count: pipeline?.failed ?? 0,
			variant: (pipeline?.failed ?? 0) > 0 ? ('destructive' as const) : ('outline' as const)
		},
		{ label: 'Blocked', count: pipeline?.blocked ?? 0, variant: 'outline' as const },
		{ label: 'Unscheduled', count: pipeline?.unscheduled ?? 0, variant: 'outline' as const }
	]);

	function badgeVariant(variant: BadgeVariant) {
		return variant;
	}

	function formatScheduledAt(scheduledAt: number | null): string {
		if (!scheduledAt) return '--';
		return new Date(scheduledAt).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<Card class="flex h-[420px] flex-col overflow-hidden md:h-[520px]">
	<CardHeader class="flex flex-row items-center justify-between border-b py-4">
		<div class="flex items-center gap-2">
			<MailIcon class="size-4 text-muted-foreground" />
			<CardTitle class="text-base font-semibold">Email Follow-ups</CardTitle>
		</div>
		<a
			href={resolve(
				`/app/${workspaceSlug}/emails/follow-ups` as `/app/${string}/emails/follow-ups`
			)}
			class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
		>
			View all
			<ExternalLinkIcon class="size-3" />
		</a>
	</CardHeader>
	<CardContent class="flex min-h-0 flex-1 flex-col gap-4 p-4">
		<!-- Status chips -->
		{#if isLoading && pipeline == null}
			<div class="flex flex-wrap gap-2">
				{#each chipSkeletonRows as row (row)}
					<Skeleton class="h-6 w-24" />
				{/each}
			</div>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each statusChips as chip (chip.label)}
					<Badge variant={badgeVariant(chip.variant)} class="h-6 gap-1.5 rounded-md px-2.5 text-xs">
						<span>{chip.label}</span>
						<span class="font-semibold tabular-nums">
							{chip.count.toLocaleString()}
						</span>
					</Badge>
				{/each}
			</div>
		{/if}

		<!-- Recent queued -->
		{#if isLoading && recentQueued == null}
			<div class="min-h-0 flex-1 space-y-2 overflow-hidden rounded-md border p-3">
				{#each queuedSkeletonRows as row (row)}
					<div class="flex items-center justify-between gap-3">
						<div class="space-y-2">
							<Skeleton class="h-4 w-32" />
							<Skeleton class="h-3 w-40" />
						</div>
						<Skeleton class="h-4 w-20 shrink-0" />
					</div>
				{/each}
			</div>
		{:else if recentQueued && recentQueued.length > 0}
			<div
				class="min-h-0 flex-1 divide-y divide-border/50 overflow-auto rounded-md border border-border/50"
			>
				{#each recentQueued as item (item.followUpId)}
					<div class="flex items-center justify-between px-3 py-2.5">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{item.signerName}</p>
							<p class="truncate text-xs text-muted-foreground">{item.signerEmail}</p>
						</div>
						<p class="ml-3 shrink-0 text-xs text-muted-foreground tabular-nums">
							{formatScheduledAt(item.scheduledAt)}
						</p>
					</div>
				{/each}
			</div>
		{:else}
			<div
				class="flex min-h-0 flex-1 items-center justify-center rounded-md border border-border/50"
			>
				<p class="text-center text-sm text-muted-foreground">No queued follow-ups</p>
			</div>
		{/if}
	</CardContent>
</Card>
