<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import bookeoIcon from '$lib/assets/providers/bookeo-icon.webp';
	import constantContactIcon from '$lib/assets/providers/constant-contact-icon.webp';
	import fareharborIcon from '$lib/assets/providers/fareharbor-icon.webp';
	import mailchimpIcon from '$lib/assets/providers/mailchimp-icon.webp';
	import resovaIcon from '$lib/assets/providers/resova-icon.webp';
	import xolaIcon from '$lib/assets/providers/xola-icon.webp';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetFooter,
		SheetHeader,
		SheetTitle
	} from '$lib/components/ui/sheet';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import UnplugIcon from '@lucide/svelte/icons/unplug';

	type Integration = FunctionReturnType<typeof api.integrations.listWorkspaceIntegrations>[number];
	type ProviderAvailability = 'available' | 'coming_soon';
	type ProviderState = Integration['status'] | ProviderAvailability;
	type ProviderCategory = 'booking' | 'email';
	type ProviderDefinition = {
		key: string;
		name: string;
		category: ProviderCategory;
		availability: ProviderAvailability;
		status: string;
		description: string;
		detailDescription: string;
		logo?: string;
		initial?: string;
	};

	const BOOKING_PROVIDERS: ProviderDefinition[] = [
		{
			key: 'bookeo',
			name: 'Bookeo',
			category: 'booking',
			availability: 'available',
			status: 'Available',
			description: 'Sync bookings and customers.',
			detailDescription: 'Sync bookings and capture participant emails via Bookeo authorization.',
			logo: bookeoIcon
		},
		{
			key: 'resova',
			name: 'Resova',
			category: 'booking',
			availability: 'coming_soon',
			status: 'Coming soon',
			description: 'Booking sync support coming soon.',
			detailDescription:
				'Resova support will use the same booking and waiver matching workflow once available.',
			logo: resovaIcon
		},
		{
			key: 'xola',
			name: 'Xola',
			category: 'booking',
			availability: 'coming_soon',
			status: 'Coming soon',
			description: 'Booking sync support coming soon.',
			detailDescription:
				'Xola support will connect future booking data to waiver signing once available.',
			logo: xolaIcon
		},
		{
			key: 'fareharbor',
			name: 'FareHarbor',
			category: 'booking',
			availability: 'coming_soon',
			status: 'Coming soon',
			description: 'Booking sync support coming soon.',
			detailDescription:
				'FareHarbor support is planned for booking imports and booking-linked waiver signing.',
			logo: fareharborIcon
		}
	];

	const EMAIL_PROVIDERS: ProviderDefinition[] = [
		{
			key: 'mailchimp',
			name: 'Mailchimp',
			category: 'email',
			availability: 'coming_soon',
			status: 'Coming soon',
			description: 'Push signer contacts to Mailchimp audiences.',
			detailDescription:
				'Mailchimp will let you send participant emails to a selected audience after waiver signing.',
			logo: mailchimpIcon
		},
		{
			key: 'constant-contact',
			name: 'Constant Contact',
			category: 'email',
			availability: 'coming_soon',
			status: 'Coming soon',
			description: 'Sync signer contacts to Constant Contact lists.',
			detailDescription:
				'Constant Contact will let you route participant emails to a selected contact list after waiver signing.',
			logo: constantContactIcon
		}
	];

	const PROVIDER_SECTIONS = [
		{
			key: 'booking',
			label: 'Booking',
			providers: BOOKING_PROVIDERS
		},
		{
			key: 'email',
			label: 'Email',
			providers: EMAIL_PROVIDERS
		}
	] as const;

	const ALL_PROVIDERS = [...BOOKING_PROVIDERS, ...EMAIL_PROVIDERS];

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

	const integrations = $derived((integrationsQuery.data ?? []) as Integration[]);
	const connectedIntegration = $derived(
		integrations.find(
			(integration) =>
				integration.status === 'connected' ||
				integration.status === 'syncing' ||
				integration.status === 'error'
		) ?? null
	);
	const connectedProviderName = $derived(
		connectedIntegration ? providerNameFor(connectedIntegration.provider) : 'booking provider'
	);
	const canManage = $derived(
		connectedIntegration?.canManage !== undefined
			? connectedIntegration.canManage
			: currentWorkspace?.role === 'owner'
	);
	const isLoading = $derived(integrationsQuery.isLoading || appContext.isLoading);

	let syncHorizonMonths = $state(12);
	let manualApiKey = $state('');
	let selectedProviderKey = $state('bookeo');
	let connectSheetOpen = $state(false);
	let isStartingConnect = $state(false);
	let isConnectingManually = $state(false);
	let isDisconnecting = $state(false);
	let showManualFallback = $state(false);
	let disconnectDialogOpen = $state(false);
	let disconnectConfirmation = $state('');
	const disconnectConfirmationPhrase = 'DISCONNECT';
	const canConfirmDisconnect = $derived(
		disconnectConfirmation.trim().toUpperCase() === disconnectConfirmationPhrase
	);
	const selectedProvider = $derived(providerForKey(selectedProviderKey) ?? BOOKING_PROVIDERS[0]);
	const selectedIntegration = $derived(integrationForProvider(selectedProvider.key));
	const selectedProviderState = $derived(providerStateFor(selectedProvider));
	const selectedProviderIsConnected = $derived(
		Boolean(selectedIntegration && selectedIntegration.status !== 'disconnected')
	);
	const webhookEventsQuery = useProtectedQuery(
		api.integrations.listRecentWebhookEvents,
		() =>
			currentWorkspace && selectedIntegration
				? {
						workspaceId: currentWorkspace.workspaceId,
						integrationId: selectedIntegration.integrationId
					}
				: 'skip',
		() => ({ keepPreviousData: true })
	);
	type WebhookEvent = FunctionReturnType<typeof api.integrations.listRecentWebhookEvents>[number];
	const webhookEvents = $derived((webhookEventsQuery.data ?? []) as WebhookEvent[]);

	function statusLabel(value: ProviderState) {
		if (value === 'connected') return 'Connected';
		if (value === 'syncing') return 'Syncing';
		if (value === 'error') return 'Attention needed';
		if (value === 'available') return 'Available';
		if (value === 'coming_soon') return 'Coming soon';
		return 'Not connected';
	}

	function statusDotClass(value: ProviderState) {
		if (value === 'connected') return 'bg-emerald-500';
		if (value === 'syncing') return 'bg-amber-500 animate-pulse';
		if (value === 'error') return 'bg-destructive';
		if (value === 'available') return 'bg-emerald-500';
		return 'bg-muted-foreground/60';
	}

	function statusBadgeVariant(value: ProviderState) {
		if (value === 'error') return 'destructive' as const;
		if (value === 'connected' || value === 'available') return 'secondary' as const;
		return 'outline' as const;
	}

	function providerForKey(providerKey: string) {
		return ALL_PROVIDERS.find((provider) => provider.key === providerKey) ?? null;
	}

	function providerInitial(provider: ProviderDefinition) {
		return provider.initial ?? provider.name.slice(0, 1);
	}

	function integrationForProvider(providerKey: string) {
		return integrations.find((integration) => integration.provider === providerKey) ?? null;
	}

	function providerStateFor(provider: ProviderDefinition): ProviderState {
		const integration = integrationForProvider(provider.key);
		if (integration && integration.status !== 'disconnected') return integration.status;
		return provider.availability;
	}

	function providerNameFor(providerKey: string) {
		return ALL_PROVIDERS.find((provider) => provider.key === providerKey)?.name ?? providerKey;
	}

	function statusCopy(integration: Integration) {
		const providerName = providerNameFor(integration.provider);
		if (integration.status === 'connected') {
			return `${providerName} is connected and ready to sync booking data.`;
		}
		if (integration.status === 'syncing') {
			return `${providerName} initial booking import is running in the background.`;
		}
		if (integration.status === 'error') {
			return `${providerName} is connected, but sync needs attention.`;
		}
		return `Connect ${providerName} to organize waiver submissions by booking.`;
	}

	function formatTimestamp(timestamp: number | null) {
		if (!timestamp) return 'Not recorded';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}

	function formatWebhookTimestamp(timestamp: number) {
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}

	function webhookEventLabel(event: WebhookEvent) {
		const type = event.eventType ? event.eventType.toLowerCase() : 'webhook';
		if (event.status === 'failed') return `Failed ${type} event`;
		if (event.status === 'ignored') return `Ignored ${type} event`;
		if (event.status === 'received') return `Received ${type} event`;
		return `Processed ${type} event`;
	}

	function webhookStatusClass(status: WebhookEvent['status']) {
		if (status === 'processed') return 'bg-emerald-500';
		if (status === 'failed') return 'bg-destructive';
		if (status === 'ignored') return 'bg-amber-500';
		return 'bg-muted-foreground';
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
		const apiKeyTrimmed = manualApiKey.trim();
		isConnectingManually = true;
		try {
			await convex.action(api.integrations.connectBookeoManually, {
				workspaceId: currentWorkspace.workspaceId,
				apiKey: apiKeyTrimmed,
				syncHorizonMonths
			});
			manualApiKey = '';
			connectSheetOpen = false;
			toast.success('Bookeo connected. Initial sync has started.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to connect Bookeo.'));
		} finally {
			isConnectingManually = false;
		}
	}

	function requestDisconnect() {
		disconnectConfirmation = '';
		disconnectDialogOpen = true;
	}

	async function disconnect() {
		if (!currentWorkspace || !connectedIntegration || convex.disabled || !canConfirmDisconnect)
			return;
		const providerName = providerNameFor(connectedIntegration.provider);
		isDisconnecting = true;
		try {
			await convex.action(api.integrations.disconnectBookingIntegration, {
				workspaceId: currentWorkspace.workspaceId,
				integrationId: connectedIntegration.integrationId
			});
			disconnectDialogOpen = false;
			disconnectConfirmation = '';
			toast.success(`${providerName} disconnected.`);
		} catch (error) {
			toast.error(getConvexErrorMessage(error, `Unable to disconnect ${providerName}.`));
		} finally {
			isDisconnecting = false;
		}
	}
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Integrations | Waiver Director</title>
</svelte:head>

{#if connectedIntegration}
	<Dialog bind:open={disconnectDialogOpen}>
		<DialogContent class="max-w-md">
			<DialogHeader>
				<DialogTitle>Disconnect {connectedProviderName}?</DialogTitle>
				<DialogDescription>
					Waiver Director will stop receiving booking updates from {connectedProviderName} for this workspace.
					Existing bookings and signed waiver records remain in Waiver Director.
				</DialogDescription>
			</DialogHeader>

			<div class="space-y-2">
				<Label for="disconnect-confirmation" class="text-xs">
					Type <span class="font-semibold text-foreground">{disconnectConfirmationPhrase}</span> to disconnect.
				</Label>
				<Input
					id="disconnect-confirmation"
					bind:value={disconnectConfirmation}
					autocomplete="off"
					disabled={isDisconnecting}
				/>
			</div>

			<DialogFooter>
				<Button
					type="button"
					variant="outline"
					onclick={() => (disconnectDialogOpen = false)}
					disabled={isDisconnecting}
				>
					Cancel
				</Button>
				<Button
					type="button"
					variant="destructive"
					onclick={disconnect}
					disabled={convex.disabled || !canConfirmDisconnect || isDisconnecting}
				>
					{isDisconnecting ? 'Disconnecting...' : `Disconnect ${connectedProviderName}`}
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
{/if}

<Sheet bind:open={connectSheetOpen}>
	<SheetContent side="right" class="w-full! gap-0 overflow-hidden p-0 sm:max-w-lg!">
		<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
			<SheetTitle>Connect {selectedProvider.name}</SheetTitle>
			<SheetDescription>
				Choose the import window and authorize access with the provider.
			</SheetDescription>
		</SheetHeader>

		<div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
			<div class="flex items-start gap-3 border-b py-4 pt-0">
				<span
					class="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-sm font-semibold"
				>
					{#if selectedProvider.logo}
						<img
							class="size-full object-cover"
							src={selectedProvider.logo}
							alt=""
							width="36"
							height="36"
						/>
					{:else}
						<span>{providerInitial(selectedProvider)}</span>
					{/if}
				</span>
				<div class="min-w-0">
					<p class="text-sm font-semibold">{selectedProvider.name}</p>
					<p class="text-xs leading-relaxed text-muted-foreground">
						{selectedProvider.detailDescription}
					</p>
				</div>
			</div>

			<div class="border-b py-4">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<p id="sync-horizon-label" class="text-sm font-semibold">Booking window</p>
						<p class="text-xs leading-relaxed text-muted-foreground">
							Backfill this far ahead now. New and updated bookings continue syncing automatically.
						</p>
					</div>
					<div class="w-20 shrink-0 rounded-lg border bg-background px-3 py-2 text-right">
						<p class="text-lg leading-none font-semibold">{syncHorizonMonths}</p>
						<span class="text-xs text-muted-foreground">
							{syncHorizonMonths === 1 ? 'month' : 'months'}
						</span>
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
					<div class="flex items-center justify-between text-[11px] text-muted-foreground">
						<span>1 month</span>
						<span>12 months</span>
					</div>
				</div>
			</div>

			{#if dev}
				<div class="border-b py-4">
					<button
						type="button"
						class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
						onclick={() => (showManualFallback = !showManualFallback)}
						aria-expanded={showManualFallback}
					>
						<ChevronDownIcon
							class={cn('size-3.5 transition-transform', showManualFallback && 'rotate-180')}
							aria-hidden="true"
						/>
						<KeyRoundIcon class="size-3.5" aria-hidden="true" />
						Development: connect with an API key
					</button>

					{#if showManualFallback}
						<form
							class="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/20 p-4"
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
									Development only. Production setup should use Bookeo authorization so required
									permissions are requested consistently.
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

		<SheetFooter class="shrink-0 border-t border-border px-6 py-4">
			<Button variant="outline" onclick={() => (connectSheetOpen = false)}>Cancel</Button>
			<Button onclick={startBookeoConnect} disabled={convex.disabled || isStartingConnect}>
				{#if isStartingConnect}
					Opening Bookeo...
				{:else}
					Connect with Bookeo
					<ExternalLinkIcon class="size-3.5" aria-hidden="true" />
				{/if}
			</Button>
		</SheetFooter>
	</SheetContent>
</Sheet>

<PageHeader
	title="Integrations"
	subtitle="Connect booking and email providers for this workspace."
/>

<PageShell>
	{#if isLoading}
		<section class="grid min-h-128 overflow-hidden border-y md:grid-cols-[15rem_minmax(0,1fr)]">
			<div class="flex min-h-60 flex-col gap-4 border-b p-3 md:border-r md:border-b-0">
				<Skeleton class="h-4 w-24" />
				<Skeleton class="h-10 w-full rounded-md" />
				<Skeleton class="h-10 w-full rounded-md" />
				<Skeleton class="h-4 w-16" />
				<Skeleton class="h-10 w-full rounded-md" />
				<Skeleton class="h-10 w-full rounded-md" />
			</div>
			<div class="flex min-w-0 flex-col gap-5 p-5">
				<div class="flex min-w-0 items-start gap-4">
					<Skeleton class="size-12 rounded-md" />
					<div class="min-w-0 flex-1">
						<Skeleton class="h-6 w-36" />
						<Skeleton class="mt-3 h-4 w-full max-w-lg" />
					</div>
				</div>
				<Skeleton class="h-36 w-full rounded-md" />
				<Skeleton class="h-24 w-full rounded-md" />
			</div>
		</section>
	{:else if !currentWorkspace}
		<div
			class="rounded-md border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
		>
			Workspace not found.
		</div>
	{:else}
		<article class="grid min-h-128 overflow-hidden border-y md:grid-cols-[15rem_minmax(0,1fr)]">
			<aside
				class="flex flex-col gap-4 border-b p-3 md:border-r md:border-b-0"
				aria-label="Integration providers"
			>
				<p class="px-2 pb-0.5 text-sm font-semibold">Integrations</p>
				{#each PROVIDER_SECTIONS as section (section.key)}
					<section class="flex flex-col gap-1">
						<p
							class="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
						>
							{section.label}
						</p>
						<div class="flex flex-col gap-0.5">
							{#each section.providers as provider (provider.key)}
								{@const providerStatus = providerStateFor(provider)}
								{@const providerIntegration = integrationForProvider(provider.key)}
								{@const isSelected = selectedProviderKey === provider.key}
								<button
									type="button"
									class={cn(
										'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none',
										isSelected && 'bg-muted text-foreground'
									)}
									onclick={() => (selectedProviderKey = provider.key)}
									aria-current={isSelected ? 'true' : undefined}
								>
									<span
										class="inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-xs font-semibold text-foreground"
									>
										{#if provider.logo}
											<img
												class="size-full object-cover"
												src={provider.logo}
												alt=""
												width="24"
												height="24"
											/>
										{:else}
											<span>{providerInitial(provider)}</span>
										{/if}
									</span>
									<span class="flex min-w-0 flex-1 flex-col">
										<span class="flex min-w-0 items-center gap-1.5">
											<span class="truncate font-medium">{provider.name}</span>
											{#if providerIntegration && providerIntegration.status !== 'disconnected'}
												<span
													class={cn(
														'size-1.5 shrink-0 rounded-full',
														statusDotClass(providerStatus)
													)}
												></span>
											{/if}
										</span>
										<span class="truncate text-xs text-muted-foreground"
											>{statusLabel(providerStatus)}</span
										>
									</span>
								</button>
							{/each}
						</div>
					</section>
				{/each}
			</aside>

			<div class="flex min-w-0 flex-col gap-5 p-5">
				<div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div class="flex min-w-0 items-start gap-4">
						<span
							class="inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-base font-semibold"
						>
							{#if selectedProvider.logo}
								<img
									class="size-full object-cover"
									src={selectedProvider.logo}
									alt=""
									width="40"
									height="40"
								/>
							{:else}
								<span>{providerInitial(selectedProvider)}</span>
							{/if}
						</span>
						<div class="min-w-0 flex-1 space-y-1">
							<div class="flex min-w-0 flex-wrap items-center gap-2">
								<h2 class="truncate text-xl font-semibold tracking-tight">
									{selectedProvider.name}
								</h2>
								<Badge variant={statusBadgeVariant(selectedProviderState)} class="h-5 shrink-0">
									<span
										class={cn('size-1.5 rounded-full', statusDotClass(selectedProviderState))}
										aria-hidden="true"
									></span>
									{statusLabel(selectedProviderState)}
								</Badge>
							</div>
							<p class="text-sm leading-relaxed text-muted-foreground">
								{#if selectedProviderIsConnected && selectedIntegration}
									{statusCopy(selectedIntegration)}
								{:else}
									{selectedProvider.detailDescription}
								{/if}
							</p>
						</div>
					</div>

					{#if selectedProviderIsConnected && selectedIntegration}
						<Button
							size="sm"
							variant="outline"
							class="shrink-0 self-start"
							onclick={requestDisconnect}
							disabled={convex.disabled || !canManage || isDisconnecting}
						>
							<UnplugIcon class="size-3.5" aria-hidden="true" />
							Disconnect
						</Button>
					{/if}
				</div>

				{#if selectedProviderIsConnected && selectedIntegration}
					<section class="flex min-w-0 flex-col gap-4 border-t pt-4">
						<div class="grid gap-3 md:grid-cols-3">
							<div class="rounded-lg border bg-card p-4">
								<p class="text-xs font-medium text-muted-foreground">Account ID</p>
								<p class="mt-2 text-sm font-semibold">
									{selectedIntegration.accountId ?? 'Connected'}
								</p>
							</div>
							<div class="rounded-lg border bg-card p-4">
								<p class="text-xs font-medium text-muted-foreground">Booking window</p>
								<p class="mt-2 text-sm font-semibold">
									{selectedIntegration.syncHorizonMonths} months future
								</p>
							</div>
							<div class="rounded-lg border bg-card p-4">
								<p class="text-xs font-medium text-muted-foreground">Connected</p>
								<p class="mt-2 text-sm font-semibold">
									{formatTimestamp(selectedIntegration.connectedAt)}
								</p>
							</div>
						</div>

						{#if webhookEvents.length > 0}
							<div class="divide-y rounded-lg border bg-card">
								<div class="px-3 py-2 text-xs font-medium text-muted-foreground">
									Recent activity
								</div>
								{#each webhookEvents as event (event.eventId)}
									<div class="flex gap-3 p-3">
										<span
											class={cn(
												'mt-1.5 size-1.5 shrink-0 rounded-full',
												webhookStatusClass(event.status)
											)}
											aria-hidden="true"
										></span>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{webhookEventLabel(event)}</p>
											<p class="truncate text-xs text-muted-foreground">
												{formatWebhookTimestamp(event.receivedAt)}
												{#if event.itemId}
													<span aria-hidden="true">·</span>
													<span>{event.itemId}</span>
												{/if}
											</p>
											{#if event.errorMessage}
												<p class="mt-1 truncate text-xs text-destructive">
													{event.errorMessage}
												</p>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else if webhookEventsQuery.isLoading}
							<div class="rounded-lg border bg-card p-3">
								<div class="flex gap-3">
									<Skeleton class="size-2 rounded-full" />
									<div class="min-w-0 flex-1 space-y-2">
										<Skeleton class="h-4 w-56" />
										<Skeleton class="h-3 w-32" />
									</div>
								</div>
							</div>
						{:else}
							<p class="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
								No recent activity.
							</p>
						{/if}

						{#if selectedIntegration.missingRequiredPermissions.length > 0}
							<div
								class="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive"
							>
								<ShieldAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								<div class="min-w-0 space-y-1">
									<p class="text-sm font-semibold">Missing required permissions</p>
									<p class="text-xs leading-relaxed wrap-break-word text-destructive/80">
										{connectedProviderName} has not granted: {selectedIntegration.missingRequiredPermissions.join(
											', '
										)}. Reconnect from {connectedProviderName}'s settings to restore full sync.
									</p>
								</div>
							</div>
						{/if}

						{#if selectedIntegration.lastSyncError}
							<div
								class="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive"
							>
								<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								<div class="min-w-0 space-y-1">
									<p class="text-sm font-semibold">Integration needs attention</p>
									<p class="text-xs leading-relaxed wrap-break-word text-destructive/80">
										{selectedIntegration.lastSyncError}
									</p>
								</div>
							</div>
						{/if}
					</section>
				{:else if selectedProvider.availability === 'available'}
					<section class="flex min-w-0 flex-col gap-4 border-t pt-4">
						<div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div class="min-w-0 space-y-1">
								<h3 class="text-sm font-semibold">Ready to connect</h3>
								<p class="text-sm leading-relaxed text-muted-foreground">
									Authorize access in Bookeo with the required permissions. Future booking changes
									sync automatically.
								</p>
							</div>
						</div>

						{#if !canManage}
							<div class="rounded-lg border border-dashed bg-card/50 p-10 text-center">
								<p class="text-sm font-medium">Owner access required</p>
								<p class="mt-1 text-xs text-muted-foreground">
									Only workspace owners can connect booking providers.
								</p>
							</div>
						{:else if connectedIntegration}
							<div class="rounded-lg border border-dashed bg-card/50 p-10 text-center">
								<p class="text-sm font-medium">{connectedProviderName} is already connected</p>
								<p class="mt-1 text-xs text-muted-foreground">
									Disconnect the current booking provider before connecting another one.
								</p>
							</div>
						{:else}
							<div class="overflow-hidden border-y" aria-label="Connection workflow">
								<div class="flex gap-3 border-b py-3">
									<span
										class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
									>
										1
									</span>
									<div>
										<p class="text-sm font-medium">Choose the import window</p>
										<p class="text-sm leading-relaxed text-muted-foreground">
											Set how far ahead Bookeo bookings should be imported during setup.
										</p>
									</div>
								</div>
								<div class="flex gap-3 border-b py-3">
									<span
										class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
									>
										2
									</span>
									<div>
										<p class="text-sm font-medium">Authorize in Bookeo</p>
										<p class="text-sm leading-relaxed text-muted-foreground">
											Bookeo asks for the required permissions and returns you to Waiver Director.
										</p>
									</div>
								</div>
								<div class="flex gap-3 py-3">
									<span
										class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
									>
										3
									</span>
									<div>
										<p class="text-sm font-medium">Initial sync starts</p>
										<p class="text-sm leading-relaxed text-muted-foreground">
											Bookings import in the background and future updates arrive through webhooks.
										</p>
									</div>
								</div>
							</div>
							<Button class="self-start" onclick={() => (connectSheetOpen = true)}>
								Connect {selectedProvider.name}
								<ExternalLinkIcon class="size-3.5" aria-hidden="true" />
							</Button>
						{/if}
					</section>
				{:else}
					<section class="flex min-w-0 flex-col items-start gap-4 border-t pt-4">
						<h3 class="text-sm font-semibold">{selectedProvider.status}</h3>
						<p class="text-sm leading-relaxed text-muted-foreground">
							{selectedProvider.description} This provider is shown here so the integrations model can
							grow by category without changing the page structure later.
						</p>
						<Button variant="outline" size="sm" disabled>Not available yet</Button>
					</section>
				{/if}
			</div>
		</article>
	{/if}
</PageShell>
