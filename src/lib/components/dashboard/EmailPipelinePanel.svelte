<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import FollowUpPreviewDialog from '$lib/components/emails/FollowUpPreviewDialog.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
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
		followUpId: Id<'email_follow_ups'>;
		signerName: string;
		signerEmail: string;
		scheduledAt: number | null;
		submittedAt: number;
	};

	let {
		workspaceId,
		workspaceName,
		pipeline,
		recentQueued,
		isLoading
	}: {
		workspaceId: Id<'workspaces'> | null | undefined;
		workspaceName: string | null | undefined;
		pipeline: Pipeline | null | undefined;
		recentQueued: RecentQueued[] | null | undefined;
		isLoading: boolean;
	} = $props();

	const workspaceSlug = $derived(page.params.workspaceSlug ?? '');
	let selectedFollowUpId = $state<Id<'email_follow_ups'> | null>(null);
	let followUpPreviewOpen = $state(false);
	const chipSkeletonRows = [0, 1, 2, 3, 4];
	const queuedSkeletonRows = [0, 1, 2, 3, 4, 5];

	type ChipTone = 'primary' | 'green' | 'destructive' | 'amber' | 'muted';

	const statusChips = $derived([
		{
			label: 'Queued',
			count: pipeline?.queued ?? 0,
			tone: 'primary' as ChipTone,
			hint: 'ready'
		},
		{
			label: 'Sent',
			count: pipeline?.sent ?? 0,
			tone: 'green' as ChipTone,
			hint: 'delivered'
		},
		{
			label: 'Failed',
			count: pipeline?.failed ?? 0,
			tone: ((pipeline?.failed ?? 0) > 0 ? 'destructive' : 'muted') as ChipTone,
			hint: (pipeline?.failed ?? 0) > 0 ? 'needs review' : 'none'
		},
		{
			label: 'Blocked',
			count: pipeline?.blocked ?? 0,
			tone: ((pipeline?.blocked ?? 0) > 0 ? 'amber' : 'muted') as ChipTone,
			hint: (pipeline?.blocked ?? 0) > 0 ? 'sender setup' : 'none'
		},
		{
			label: 'Unscheduled',
			count: pipeline?.unscheduled ?? 0,
			tone: 'muted' as ChipTone,
			hint: 'no schedule'
		}
	]);

	function chipClasses(tone: ChipTone): string {
		switch (tone) {
			case 'primary':
				return 'border-primary/25 bg-primary/8 text-primary dark:border-primary/40 dark:bg-primary/15 dark:text-[color-mix(in_oklch,var(--primary)_32%,var(--primary-foreground))]';
			case 'green':
				return 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400';
			case 'destructive':
				return 'border-destructive/30 bg-destructive/8 text-destructive';
			case 'amber':
				return 'border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-400';
			default:
				return 'border-border bg-muted/40 text-muted-foreground';
		}
	}

	function dotClasses(tone: ChipTone): string {
		switch (tone) {
			case 'primary':
				return 'bg-primary';
			case 'green':
				return 'bg-emerald-500';
			case 'destructive':
				return 'bg-destructive';
			case 'amber':
				return 'bg-amber-500';
			default:
				return 'bg-muted-foreground/45';
		}
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

	function formatCappedCount(value: number) {
		return value >= 1000 ? '1000+' : value.toLocaleString();
	}

	function openFollowUp(followUpId: Id<'email_follow_ups'>) {
		selectedFollowUpId = followUpId;
		followUpPreviewOpen = true;
	}
</script>

{#if workspaceId && workspaceName}
	<FollowUpPreviewDialog
		bind:open={followUpPreviewOpen}
		{workspaceId}
		{workspaceSlug}
		{workspaceName}
		followUpId={selectedFollowUpId}
	/>
{/if}

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
	<CardContent class="flex min-h-0 flex-1 flex-col gap-3 p-4">
		{#if isLoading && pipeline == null}
			<div class="flex flex-wrap gap-1.5">
				{#each chipSkeletonRows as row (row)}
					<Skeleton class="h-7 w-24" />
				{/each}
			</div>
		{:else}
			<div class="flex flex-wrap gap-1.5">
				{#each statusChips as chip (chip.label)}
					<div
						class="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs {chipClasses(
							chip.tone
						)}"
						title={`${chip.label}: ${chip.hint}`}
					>
						<span class="size-1.5 shrink-0 rounded-full {dotClasses(chip.tone)}"></span>
						<span class="font-semibold tabular-nums">
							{formatCappedCount(chip.count)}
						</span>
						<span>{chip.label}</span>
					</div>
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
					<button
						type="button"
						onclick={() => openFollowUp(item.followUpId)}
						class="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
					>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{item.signerName}</p>
							<p class="truncate text-xs text-muted-foreground">{item.signerEmail}</p>
						</div>
						<p class="ml-3 shrink-0 text-xs text-muted-foreground tabular-nums">
							{formatScheduledAt(item.scheduledAt)}
						</p>
					</button>
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
