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
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import LinkIcon from '@lucide/svelte/icons/link';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import UnplugIcon from '@lucide/svelte/icons/unplug';
	import UserIcon from '@lucide/svelte/icons/user';

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
	const status = $derived(bookeoIntegration?.status ?? 'disconnected');
	const isConnected = $derived(
		status === 'connected' || status === 'syncing' || status === 'error'
	);

	let syncHorizonMonths = $state<3 | 6 | 12>(6);
	let manualApiKey = $state('');
	let isStartingConnect = $state(false);
	let isConnectingManually = $state(false);
	let isSyncing = $state(false);
	let isDisconnecting = $state(false);
	let showManualFallback = $state(false);

	function formatTimestamp(timestamp: number | null) {
		if (!timestamp) return 'Never';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}

	function statusLabel(value: Integration['status']) {
		if (value === 'connected') return 'Connected';
		if (value === 'syncing') return 'Syncing';
		if (value === 'error') return 'Attention needed';
		return 'Not connected';
	}

	function statusDotClass(value: Integration['status']) {
		if (value === 'connected') return 'bg-emerald-500';
		if (value === 'syncing') return 'bg-amber-500 animate-pulse';
		if (value === 'error') return 'bg-destructive';
		return 'bg-muted-foreground/60';
	}

	function statusBadgeVariant(value: Integration['status']) {
		if (value === 'error') return 'destructive' as const;
		if (value === 'connected') return 'secondary' as const;
		return 'outline' as const;
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
	<div class="mx-auto w-full max-w-6xl min-w-0 space-y-6">
		<div class="space-y-1">
			<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Integrations</p>
			<h1 class="text-2xl font-semibold tracking-tight">Booking provider connections</h1>
			<p class="text-sm text-muted-foreground">
				Connect one booking provider per workspace to pull bookings and group waiver submissions
				automatically. Bookeo is available in this release.
			</p>
		</div>

		{#if isLoading}
			<Card>
				<CardHeader>
					<Skeleton class="h-5 w-36" />
					<Skeleton class="mt-2 h-4 w-64" />
				</CardHeader>
				<CardContent>
					<Skeleton class="h-24 w-full" />
				</CardContent>
			</Card>
		{:else if !currentWorkspace}
			<div
				class="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
			>
				Workspace not found.
			</div>
		{:else}
			<Card class="overflow-hidden">
				<CardHeader class="border-b border-border/60">
					<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex min-w-0 items-start gap-3">
							<div
								class="flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-black text-white shadow-sm"
								style="background: linear-gradient(135deg, #8BC635 0%, #77BC1F 100%);"
								aria-hidden="true"
							>
								B
							</div>
							<div class="min-w-0 space-y-1">
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="text-base font-semibold tracking-tight">Bookeo</h2>
									<Badge variant={statusBadgeVariant(status)} class="capitalize">
										<span
											class={cn('size-1.5 rounded-full', statusDotClass(status))}
											aria-hidden="true"
										></span>
										{statusLabel(status)}
									</Badge>
								</div>
								<p class="text-xs leading-relaxed text-muted-foreground sm:text-sm">
									Sync bookings and customers into Waiver Director, then group waiver submissions by
									booking automatically.
								</p>
							</div>
						</div>

						{#if isConnected}
							<div class="flex shrink-0 flex-wrap gap-2">
								<Button
									size="sm"
									variant="outline"
									onclick={syncNow}
									disabled={!canManage || isSyncing || status === 'syncing'}
								>
									<RefreshCwIcon
										class={cn('size-3.5', (isSyncing || status === 'syncing') && 'animate-spin')}
										aria-hidden="true"
									/>
									{status === 'syncing' ? 'Syncing...' : isSyncing ? 'Queueing...' : 'Sync now'}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onclick={disconnect}
									disabled={!canManage || isDisconnecting}
								>
									<UnplugIcon class="size-3.5" aria-hidden="true" />
									{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
								</Button>
							</div>
						{/if}
					</div>
				</CardHeader>

				<CardContent class="space-y-5 pt-4 pb-5">
					{#if bookeoIntegration && isConnected}
						<div class="grid gap-3 sm:grid-cols-3">
							<div class="rounded-lg border border-border bg-card/40 p-3">
								<div class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
									<UserIcon class="size-3.5" aria-hidden="true" />
									<span class="tracking-wide uppercase">Account</span>
								</div>
								<p class="mt-1.5 truncate text-sm font-medium">
									{bookeoIntegration.accountName ?? bookeoIntegration.accountId ?? 'Connected'}
								</p>
							</div>
							<div class="rounded-lg border border-border bg-card/40 p-3">
								<div class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
									<ClockIcon class="size-3.5" aria-hidden="true" />
									<span class="tracking-wide uppercase">Sync horizon</span>
								</div>
								<p class="mt-1.5 text-sm font-medium">
									{bookeoIntegration.syncHorizonMonths} months future
								</p>
							</div>
							<div class="rounded-lg border border-border bg-card/40 p-3">
								<div class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
									<RefreshCwIcon class="size-3.5" aria-hidden="true" />
									<span class="tracking-wide uppercase">Last sync</span>
								</div>
								<p class="mt-1.5 text-sm font-medium">
									{formatTimestamp(bookeoIntegration.lastSyncAt)}
								</p>
							</div>
						</div>

						{#if bookeoIntegration.missingRequiredPermissions.length > 0}
							<div class="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
								<ShieldAlertIcon
									class="mt-0.5 size-4 shrink-0 text-destructive"
									aria-hidden="true"
								/>
								<div class="min-w-0 space-y-1">
									<p class="text-sm font-semibold text-destructive">Missing required permissions</p>
									<p class="text-xs leading-relaxed text-destructive/90">
										Bookeo has not granted: {bookeoIntegration.missingRequiredPermissions.join(
											', '
										)}. Reconnect from Bookeo's API settings to restore full sync.
									</p>
								</div>
							</div>
						{/if}

						{#if bookeoIntegration.lastSyncError}
							<div class="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
								<TriangleAlertIcon
									class="mt-0.5 size-4 shrink-0 text-destructive"
									aria-hidden="true"
								/>
								<div class="min-w-0 space-y-1">
									<p class="text-sm font-semibold text-destructive">Last sync failed</p>
									<p class="text-xs leading-relaxed break-words text-destructive/90">
										{bookeoIntegration.lastSyncError}
									</p>
								</div>
							</div>
						{/if}
					{:else if !canManage}
						<div class="rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center">
							<p class="text-sm text-muted-foreground">
								Only workspace owners can connect booking providers.
							</p>
						</div>
					{:else}
						<div class="space-y-2">
							<Label for="sync-horizon">Initial sync horizon</Label>
							<p class="text-xs text-muted-foreground">
								How far into the future to pull bookings on the first sync. Future syncs use the
								same window.
							</p>
							<select
								id="sync-horizon"
								class="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
								bind:value={syncHorizonMonths}
							>
								<option value={3}>3 months future</option>
								<option value={6}>6 months future</option>
								<option value={12}>12 months future</option>
							</select>
						</div>

						<Separator />

						<div class="space-y-4">
							<div class="space-y-1">
								<h3 class="flex items-center gap-2 text-sm font-semibold">
									<LinkIcon class="size-3.5 text-primary" aria-hidden="true" />
									Connect with Bookeo
								</h3>
								<p class="text-xs text-muted-foreground">
									Recommended — you'll be redirected to Bookeo to authorize access.
								</p>
							</div>
							<Button onclick={startBookeoConnect} disabled={isStartingConnect}>
								{#if isStartingConnect}
									Opening Bookeo...
								{:else}
									Connect with Bookeo
									<ExternalLinkIcon class="size-3.5" aria-hidden="true" />
								{/if}
							</Button>
						</div>

						<div class="pt-1">
							<button
								type="button"
								class="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
								onclick={() => (showManualFallback = !showManualFallback)}
								aria-expanded={showManualFallback}
							>
								<ChevronDownIcon
									class={cn('size-3.5 transition-transform', showManualFallback && 'rotate-180')}
									aria-hidden="true"
								/>
								<KeyRoundIcon class="size-3.5" aria-hidden="true" />
								Advanced — connect with an API key instead
							</button>

							{#if showManualFallback}
								<form
									class="mt-3 space-y-3 rounded-lg border border-border bg-muted/20 p-4"
									onsubmit={(event) => {
										event.preventDefault();
										void connectManually();
									}}
								>
									<div class="space-y-1.5">
										<Label for="manual-api-key" class="text-xs">Bookeo API key</Label>
										<Input
											id="manual-api-key"
											type="password"
											bind:value={manualApiKey}
											placeholder="Paste Bookeo API key"
											autocomplete="off"
										/>
										<p class="text-xs text-muted-foreground">
											Find your key under Bookeo → Settings → API access. OAuth is preferred — use
											this only if authorization is blocked.
										</p>
									</div>
									<Button
										type="submit"
										size="sm"
										variant="outline"
										disabled={manualApiKey.trim().length === 0 || isConnectingManually}
									>
										{isConnectingManually ? 'Connecting...' : 'Connect with API key'}
									</Button>
								</form>
							{/if}
						</div>
					{/if}
				</CardContent>
			</Card>
		{/if}
	</div>
</div>
