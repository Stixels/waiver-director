<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { dev } from '$app/environment';
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
	import { cn } from '$lib/utils';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import LinkIcon from '@lucide/svelte/icons/link';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import UnplugIcon from '@lucide/svelte/icons/unplug';
	import UserIcon from '@lucide/svelte/icons/user';

	const BOOKING_PROVIDERS = [
		{
			key: 'bookeo',
			name: 'Bookeo',
			initial: 'B',
			status: 'Available',
			description: 'Sync bookings and customers.',
			enabled: true,
			color: '#77bc1f'
		},
		{
			key: 'resova',
			name: 'Resova',
			initial: 'R',
			status: 'Planned',
			description: 'Booking sync support planned.',
			enabled: false,
			color: '#64748b'
		},
		{
			key: 'xola',
			name: 'Xola',
			initial: 'X',
			status: 'Planned',
			description: 'Booking sync support planned.',
			enabled: false,
			color: '#64748b'
		},
		{
			key: 'fareharbor',
			name: 'FareHarbor',
			initial: 'F',
			status: 'Planned',
			description: 'Booking sync support planned.',
			enabled: false,
			color: '#64748b'
		}
	];

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

	let syncHorizonMonths = $state(12);
	let manualApiKey = $state('');
	let isStartingConnect = $state(false);
	let isConnectingManually = $state(false);
	let isDisconnecting = $state(false);
	let showManualFallback = $state(false);

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

	function statusCopy(value: Integration['status']) {
		if (value === 'connected') return 'Bookeo is connected and ready to sync booking data.';
		if (value === 'syncing') return 'Initial booking import is running in the background.';
		if (value === 'error') return 'Bookeo is connected, but sync needs attention.';
		return 'Connect Bookeo to organize waiver submissions by booking.';
	}

	function formatTimestamp(timestamp: number | null) {
		if (!timestamp) return 'Not recorded';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}

	function normalizeSyncHorizon(value: number) {
		if (!Number.isFinite(value)) return 12;
		return Math.min(12, Math.max(1, Math.round(value)));
	}

	function handleSyncHorizonInput(event: Event) {
		syncHorizonMonths = normalizeSyncHorizon(
			Number((event.currentTarget as HTMLInputElement).value)
		);
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
		<header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div class="min-w-0 space-y-1">
				<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Integrations</p>
				<h1 class="text-2xl font-semibold tracking-tight">Booking provider connections</h1>
				<p class="max-w-2xl text-sm text-muted-foreground">
					Choose a booking provider for this workspace. Bookeo can be connected now; Resova, Xola,
					and FareHarbor are planned provider options.
				</p>
			</div>
		</header>

		{#if isLoading}
			<section class="overflow-hidden rounded-xl border border-border">
				<div class="border-b border-border/70 p-5">
					<Skeleton class="h-6 w-40" />
					<Skeleton class="mt-3 h-4 w-full max-w-lg" />
				</div>
				<div class="border-b border-border/70 bg-card/30 p-3">
					<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
						<Skeleton class="h-20 w-full rounded-lg" />
						<Skeleton class="h-20 w-full rounded-lg" />
						<Skeleton class="h-20 w-full rounded-lg" />
						<Skeleton class="h-20 w-full rounded-lg" />
					</div>
				</div>
				<div class="p-5">
					<Skeleton class="h-44 w-full rounded-lg" />
				</div>
			</section>
		{:else if !currentWorkspace}
			<div
				class="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
			>
				Workspace not found.
			</div>
		{:else}
			<article class="overflow-hidden rounded-xl border border-border">
				<div class="border-b border-border/70 bg-card/30 p-5">
					<div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h2 class="text-sm font-semibold tracking-tight">Booking providers</h2>
							<p class="text-xs text-muted-foreground">
								Select one provider per workspace. More providers will unlock as they become
								available.
							</p>
						</div>
					</div>

					<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{#each BOOKING_PROVIDERS as provider (provider.key)}
							<div
								class={cn(
									'min-h-18 rounded-lg border bg-background p-3 transition-colors',
									provider.enabled ? 'border-primary/50' : 'border-border opacity-70'
								)}
							>
								<div class="flex h-full items-center gap-3">
									<div
										class="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-black text-white"
										style={`background: ${provider.color};`}
										aria-hidden="true"
									>
										{provider.initial}
									</div>
									<div class="flex min-w-0 flex-1 flex-col gap-1">
										<div class="flex min-w-0 items-center gap-2">
											<p class="truncate text-sm font-medium">{provider.name}</p>
											<Badge
												variant={provider.enabled ? statusBadgeVariant(status) : 'outline'}
												class="h-5 shrink-0 capitalize"
											>
												{#if provider.enabled}
													<span
														class={cn('size-1.5 rounded-full', statusDotClass(status))}
														aria-hidden="true"
													></span>
													{statusLabel(status)}
												{:else}
													{provider.status}
												{/if}
											</Badge>
										</div>
										<p class="truncate text-xs text-muted-foreground">
											{provider.description}
										</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="space-y-4 p-5">
					{#if bookeoIntegration && isConnected}
						<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div class="min-w-0 space-y-1">
								<h3 class="text-sm font-semibold">Connected provider</h3>
								<p class="text-sm text-muted-foreground">{statusCopy(status)}</p>
							</div>
							<Button
								size="sm"
								variant="ghost"
								class="self-start"
								onclick={disconnect}
								disabled={convex.disabled || !canManage || isDisconnecting}
							>
								<UnplugIcon class="size-3.5" aria-hidden="true" />
								{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
							</Button>
						</div>

						<div class="grid gap-3 sm:grid-cols-3">
							<div class="rounded-lg border border-border bg-card/40 p-3">
								<div class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
									<UserIcon class="size-3.5" aria-hidden="true" />
									<span class="tracking-wide uppercase">Account</span>
								</div>
								<p class="mt-1.5 truncate text-sm font-medium">
									{bookeoIntegration.accountId ?? 'Connected'}
								</p>
							</div>
							<div class="rounded-lg border border-border bg-card/40 p-3">
								<div class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
									<CircleCheckIcon class="size-3.5" aria-hidden="true" />
									<span class="tracking-wide uppercase">Booking window</span>
								</div>
								<p class="mt-1.5 text-sm font-medium">
									{bookeoIntegration.syncHorizonMonths} months future
								</p>
							</div>
							<div class="rounded-lg border border-border bg-card/40 p-3">
								<div class="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
									<LinkIcon class="size-3.5" aria-hidden="true" />
									<span class="tracking-wide uppercase">Connected</span>
								</div>
								<p class="mt-1.5 text-sm font-medium">
									{formatTimestamp(bookeoIntegration.connectedAt)}
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
									<p class="text-sm font-semibold text-destructive">Integration needs attention</p>
									<p class="text-xs leading-relaxed break-words text-destructive/90">
										{bookeoIntegration.lastSyncError}
									</p>
								</div>
							</div>
						{/if}
					{:else if !canManage}
						<div
							class="rounded-xl border border-dashed border-border bg-card/30 px-4 py-12 text-center"
						>
							<p class="text-sm font-medium">Owner access required</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Only workspace owners can connect booking providers.
							</p>
						</div>
					{:else}
						<div class="space-y-4">
							<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch">
								<div class="rounded-lg border border-border bg-card/30 p-4">
									<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div class="space-y-1">
											<p id="sync-horizon-label" class="text-sm font-medium">Booking window</p>
											<p class="text-xs leading-relaxed text-muted-foreground">
												Backfill this far ahead now. New and updated bookings continue syncing
												automatically.
											</p>
										</div>
										<div
											class="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-right"
										>
											<p class="text-lg font-semibold tabular-nums">{syncHorizonMonths}</p>
											<p class="text-[11px] text-muted-foreground">
												{syncHorizonMonths === 1 ? 'month' : 'months'}
											</p>
										</div>
									</div>

									<div class="mt-4 space-y-2">
										<input
											type="range"
											min="1"
											max="12"
											step="1"
											value={syncHorizonMonths}
											oninput={handleSyncHorizonInput}
											class="w-full accent-primary"
											aria-labelledby="sync-horizon-label"
										/>
										<div
											class="flex items-center justify-between text-[11px] text-muted-foreground"
										>
											<span>1 month</span>
											<span>12 months</span>
										</div>
									</div>
								</div>

								<div class="rounded-lg border border-border bg-card/30 p-4">
									<div class="flex h-full flex-col justify-between gap-4">
										<div class="min-w-0 space-y-1">
											<h3 class="flex items-center gap-2 text-sm font-semibold">
												<LinkIcon class="size-3.5 text-primary" aria-hidden="true" />
												Connect Bookeo
											</h3>
											<p class="text-xs leading-relaxed text-muted-foreground">
												Authorize access in Bookeo with the required permissions. Future booking
												changes sync automatically.
											</p>
										</div>
										<Button
											class="w-full"
											onclick={startBookeoConnect}
											disabled={convex.disabled || isStartingConnect}
										>
											{#if isStartingConnect}
												Opening Bookeo...
											{:else}
												Connect with Bookeo
												<ExternalLinkIcon class="size-3.5" aria-hidden="true" />
											{/if}
										</Button>
									</div>
								</div>
							</div>

							{#if dev}
								<div class="border-t border-border/70 pt-4">
									<button
										type="button"
										class="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
										onclick={() => (showManualFallback = !showManualFallback)}
										aria-expanded={showManualFallback}
									>
										<ChevronDownIcon
											class={cn(
												'size-3.5 transition-transform',
												showManualFallback && 'rotate-180'
											)}
											aria-hidden="true"
										/>
										<KeyRoundIcon class="size-3.5" aria-hidden="true" />
										Development: connect with an API key
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
												<p class="text-xs leading-relaxed text-muted-foreground">
													Development only. Production setup should use Bookeo authorization so
													required permissions are requested consistently.
												</p>
											</div>
											<Button
												type="submit"
												size="sm"
												variant="outline"
												disabled={convex.disabled ||
													manualApiKey.trim().length === 0 ||
													isConnectingManually}
											>
												{isConnectingManually ? 'Connecting...' : 'Connect with API key'}
											</Button>
										</form>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</article>
		{/if}
	</div>
</div>
