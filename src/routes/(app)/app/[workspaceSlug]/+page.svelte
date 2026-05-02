<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import DashboardKpiRow from '$lib/components/dashboard/DashboardKpiRow.svelte';
	import DashboardLivePanel from '$lib/components/dashboard/DashboardLivePanel.svelte';
	import EmailPipelinePanel from '$lib/components/dashboard/EmailPipelinePanel.svelte';

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	function toDateInputValue(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	// Compute today's local-time boundaries once and keep stable
	const today = $derived.by(() => {
		const now = new Date();
		const [y, m, d] = toDateInputValue(now).split('-').map(Number);
		const start = new Date(y, m - 1, d);
		const end = new Date(y, m - 1, d + 1);
		return { startAt: start.getTime(), endAt: end.getTime() };
	});

	// 14-day window supports the visible 7-day trend plus a prior-week comparison.
	const trendStartAt = $derived.by(() => {
		const now = new Date();
		const [y, m, d] = toDateInputValue(now).split('-').map(Number);
		return new Date(y, m - 1, d - 13).getTime();
	});

	const snapshotQuery = useProtectedQuery(
		api.dashboard.getDashboardSnapshot,
		() =>
			currentWorkspace
				? {
						workspaceId: currentWorkspace.workspaceId,
						todayStartAt: today.startAt,
						todayEndAt: today.endAt,
						trendStartAt
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);

	const snapshot = $derived(snapshotQuery.data ?? null);
	const isLoading = $derived(snapshotQuery.isLoading || appContext.isLoading);
	const isInitialLoading = $derived(isLoading && !snapshot);
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Dashboard | Waiver Director</title>
</svelte:head>

<PageHeader
	title="Dashboard"
	subtitle="Today's operational overview — {new Date().toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	})}"
/>

<PageShell>
	<DashboardKpiRow
		kpi={snapshot?.kpi}
		trends={snapshot?.kpiTrends}
		comparisons={snapshot?.kpiComparisons}
		isLoading={isInitialLoading}
	/>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
		{#if currentWorkspace}
			<DashboardLivePanel
				workspaceId={currentWorkspace.workspaceId}
				todayStartAt={today.startAt}
				todayEndAt={today.endAt}
			/>
		{/if}
		<EmailPipelinePanel
			workspaceId={currentWorkspace?.workspaceId}
			workspaceName={currentWorkspace?.name}
			pipeline={snapshot?.emailPipeline}
			recentQueued={snapshot?.recentQueued}
			isLoading={isInitialLoading}
		/>
	</div>
</PageShell>
