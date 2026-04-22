<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	const appContext = useAppContext();
	const convex = useConvexClient();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);

	const integrationsQuery = useProtectedQuery(
		api.integrations.listWorkspaceIntegrations,
		() => (currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);

	type Integration = FunctionReturnType<typeof api.integrations.listWorkspaceIntegrations>[number];
	const integrations = $derived((integrationsQuery.data ?? []) as Integration[]);
	const bookeoIntegration = $derived(
		integrations.find((integration) => integration.provider === 'bookeo') ?? null
	);
	const canManage = $derived(bookeoIntegration?.canManage ?? currentWorkspace?.role === 'owner');
	const isLoading = $derived(integrationsQuery.isLoading || appContext.isLoading);

	let syncHorizonMonths = $state<3 | 6 | 12>(6);
	let manualApiKey = $state('');
	let isStartingConnect = $state(false);
	let isConnectingManually = $state(false);
	let isSyncing = $state(false);
	let isDisconnecting = $state(false);

	function formatTimestamp(timestamp: number | null) {
		if (!timestamp) return 'Never';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}

	function statusVariant(status: Integration['status']) {
		if (status === 'connected') return 'secondary';
		if (status === 'syncing') return 'outline';
		if (status === 'error') return 'destructive';
		return 'outline';
	}

	async function startBookeoConnect() {
		if (!currentWorkspace || convex.disabled) return;
		isStartingConnect = true;
		try {
			const result = await convex.action(api.integrations.startBookeoConnect, {
				workspaceId: currentWorkspace.workspaceId,
				syncHorizonMonths
			});
			window.location.href = result.authorizationUrl;
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to start Bookeo connection.'));
		} finally {
			isStartingConnect = false;
		}
	}

	async function connectManually() {
		if (!currentWorkspace || convex.disabled) return;
		isConnectingManually = true;
		try {
			await convex.action(api.integrations.connectBookeoManually, {
				workspaceId: currentWorkspace.workspaceId,
				apiKey: manualApiKey,
				syncHorizonMonths
			});
			manualApiKey = '';
			toast.success('Bookeo connected. Initial sync has started.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to connect Bookeo.'));
		} finally {
			isConnectingManually = false;
		}
	}

	async function syncNow() {
		if (!currentWorkspace || !bookeoIntegration || convex.disabled) return;
		isSyncing = true;
		try {
			await convex.action(api.integrations.syncBookeoNow, {
				workspaceId: currentWorkspace.workspaceId,
				integrationId: bookeoIntegration.integrationId
			});
			toast.success('Bookeo sync queued.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to queue Bookeo sync.'));
		} finally {
			isSyncing = false;
		}
	}

	async function disconnect() {
		if (!currentWorkspace || !bookeoIntegration || convex.disabled) return;
		isDisconnecting = true;
		try {
			await convex.mutation(api.integrations.disconnectBookingIntegration, {
				workspaceId: currentWorkspace.workspaceId,
				integrationId: bookeoIntegration.integrationId
			});
			toast.success('Bookeo disconnected.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to disconnect Bookeo.'));
		} finally {
			isDisconnecting = false;
		}
	}
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Integrations | Waiver Director</title>
</svelte:head>

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-5xl min-w-0 space-y-6">
		<div class="space-y-1">
			<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Integrations</p>
			<h1 class="text-2xl font-semibold tracking-tight">Booking provider connections</h1>
			<p class="text-sm text-muted-foreground">
				Connect one booking provider per workspace. Bookeo is available in this release.
			</p>
		</div>

		{#if isLoading}
			<div class="rounded-xl border border-border p-5">
				<Skeleton class="h-5 w-36" />
				<Skeleton class="mt-4 h-24 w-full" />
			</div>
		{:else if !currentWorkspace}
			<div
				class="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
			>
				Workspace not found.
			</div>
		{:else}
			<section class="rounded-xl border border-border p-5">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div class="min-w-0 space-y-2">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-lg font-semibold tracking-tight">Bookeo</h2>
							<Badge variant={statusVariant(bookeoIntegration?.status ?? 'disconnected')}>
								{bookeoIntegration?.status ?? 'disconnected'}
							</Badge>
						</div>
						<p class="text-sm text-muted-foreground">
							Sync bookings and customers into Waiver Director, then group waiver submissions by
							booking.
						</p>
					</div>

					{#if bookeoIntegration && bookeoIntegration.status !== 'disconnected'}
						<div class="flex gap-2">
							<Button
								size="sm"
								variant="outline"
								onclick={syncNow}
								disabled={!canManage || isSyncing}
							>
								{isSyncing ? 'Queueing...' : 'Sync now'}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onclick={disconnect}
								disabled={!canManage || isDisconnecting}
							>
								{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
							</Button>
						</div>
					{/if}
				</div>

				{#if bookeoIntegration && bookeoIntegration.status !== 'disconnected'}
					<div class="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
						<div>
							<p class="text-xs font-semibold text-muted-foreground">Account</p>
							<p class="mt-1 truncate text-sm">
								{bookeoIntegration.accountName ?? bookeoIntegration.accountId ?? 'Connected'}
							</p>
						</div>
						<div>
							<p class="text-xs font-semibold text-muted-foreground">Sync horizon</p>
							<p class="mt-1 text-sm">{bookeoIntegration.syncHorizonMonths} months future</p>
						</div>
						<div>
							<p class="text-xs font-semibold text-muted-foreground">Last sync</p>
							<p class="mt-1 text-sm">{formatTimestamp(bookeoIntegration.lastSyncAt)}</p>
						</div>
					</div>

					{#if bookeoIntegration.missingRequiredPermissions.length > 0}
						<div
							class="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
						>
							Bookeo is missing required permissions:
							{bookeoIntegration.missingRequiredPermissions.join(', ')}.
						</div>
					{/if}

					{#if bookeoIntegration.lastSyncError}
						<div
							class="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
						>
							{bookeoIntegration.lastSyncError}
						</div>
					{/if}
				{:else}
					<div class="mt-5 border-t border-border pt-5">
						{#if !canManage}
							<p class="text-sm text-muted-foreground">
								Only workspace owners can connect booking providers.
							</p>
						{:else}
							<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
								<div class="space-y-4">
									<div class="space-y-2">
										<Label for="sync-horizon">Initial sync horizon</Label>
										<select
											id="sync-horizon"
											class="h-9 w-full rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
											bind:value={syncHorizonMonths}
										>
											<option value={3}>3 months future</option>
											<option value={6}>6 months future</option>
											<option value={12}>12 months future</option>
										</select>
									</div>

									<Button onclick={startBookeoConnect} disabled={isStartingConnect}>
										{isStartingConnect ? 'Opening Bookeo...' : 'Connect with Bookeo'}
									</Button>
								</div>

								<form
									class="space-y-4"
									onsubmit={(event) => {
										event.preventDefault();
										void connectManually();
									}}
								>
									<div class="space-y-2">
										<Label for="manual-api-key">Manual API key fallback</Label>
										<Input
											id="manual-api-key"
											type="password"
											bind:value={manualApiKey}
											placeholder="Paste Bookeo API key"
											autocomplete="off"
										/>
									</div>
									<Button
										type="submit"
										variant="outline"
										disabled={manualApiKey.trim().length === 0 || isConnectingManually}
									>
										{isConnectingManually ? 'Connecting...' : 'Connect manually'}
									</Button>
								</form>
							</div>
						{/if}
					</div>
				{/if}
			</section>
		{/if}
	</div>
</div>
