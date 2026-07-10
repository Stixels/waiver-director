<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	type Integration = FunctionReturnType<
		typeof api.marketingIntegrations.getWorkspaceMarketingIntegration
	>;
	type Audience = { id: string; name: string; memberCount: number };

	interface Props {
		workspaceId: Id<'workspaces'>;
		integration: Integration;
		provider: 'mailchimp' | 'constant_contact';
		canManage: boolean;
		disconnectDialogOpen?: boolean;
	}

	let {
		workspaceId,
		integration,
		provider,
		canManage,
		disconnectDialogOpen = $bindable(false)
	}: Props = $props();
	const convex = useConvexClient();
	const providerName = $derived(provider === 'mailchimp' ? 'Mailchimp' : 'Constant Contact');
	const destinationLabel = $derived(provider === 'mailchimp' ? 'audience' : 'list');

	let isStartingConnect = $state(false);
	let isLoadingAudiences = $state(false);
	let isSavingAudience = $state(false);
	let isDisconnecting = $state(false);
	let audienceDialogOpen = $state(false);
	let audiences = $state<Audience[]>([]);
	let selectedAudienceId = $state('');

	function formatTimestamp(timestamp: number | null) {
		if (!timestamp) return 'Not recorded';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(timestamp));
	}

	async function connect() {
		if (convex.disabled || !canManage) return;
		isStartingConnect = true;
		try {
			const result = await convex.action(
				provider === 'mailchimp' ? api.mailchimp.startConnect : api.constantContact.startConnect,
				{ workspaceId }
			);
			window.location.href = result.authorizationUrl;
		} catch (error) {
			toast.error(getConvexErrorMessage(error, `Unable to start ${providerName} connection.`));
		} finally {
			isStartingConnect = false;
		}
	}

	async function openAudiencePicker() {
		if (convex.disabled || !canManage) return;
		audienceDialogOpen = true;
		selectedAudienceId = integration?.audienceId ?? '';
		isLoadingAudiences = true;
		try {
			audiences = await convex.action(
				provider === 'mailchimp' ? api.mailchimp.listAudiences : api.constantContact.listLists,
				{ workspaceId }
			);
			if (!selectedAudienceId && audiences.length === 1) {
				selectedAudienceId = audiences[0].id;
			}
		} catch (error) {
			toast.error(
				getConvexErrorMessage(error, `Unable to load ${providerName} ${destinationLabel}s.`)
			);
		} finally {
			isLoadingAudiences = false;
		}
	}

	async function saveAudience() {
		if (convex.disabled || !selectedAudienceId || !canManage) return;
		isSavingAudience = true;
		try {
			if (provider === 'mailchimp') {
				await convex.action(api.mailchimp.chooseAudience, {
					workspaceId,
					audienceId: selectedAudienceId
				});
			} else {
				await convex.action(api.constantContact.chooseList, {
					workspaceId,
					listId: selectedAudienceId
				});
			}
			audienceDialogOpen = false;
			toast.success(
				`${providerName} ${destinationLabel} selected. Marketing opt-in is now available on waivers.`
			);
		} catch (error) {
			toast.error(
				getConvexErrorMessage(error, `Unable to select that ${providerName} ${destinationLabel}.`)
			);
		} finally {
			isSavingAudience = false;
		}
	}

	async function disconnect() {
		if (convex.disabled || !canManage) return;
		isDisconnecting = true;
		try {
			await convex.mutation(api.marketingIntegrations.disconnectMarketingIntegration, {
				workspaceId,
				provider
			});
			disconnectDialogOpen = false;
			toast.success(`${providerName} disconnected.`);
		} catch (error) {
			toast.error(getConvexErrorMessage(error, `Unable to disconnect ${providerName}.`));
		} finally {
			isDisconnecting = false;
		}
	}
</script>

<Dialog bind:open={audienceDialogOpen}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>Choose a {providerName} {destinationLabel}</DialogTitle>
			<DialogDescription>
				Only signers who explicitly opt in will be added to this audience.
			</DialogDescription>
		</DialogHeader>

		<div class="min-h-20">
			{#if isLoadingAudiences}
				<p class="flex min-h-20 items-center text-sm text-muted-foreground" aria-live="polite">
					Loading audiences...
				</p>
			{:else if audiences.length === 0}
				<div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
					No {destinationLabel}s were found in this {providerName} account. Create one in
					{providerName}, then try again.
				</div>
			{:else}
				<label class="space-y-2 text-sm font-medium" for="marketing-destination">
					<span>{destinationLabel}</span>
					<select
						id="marketing-destination"
						class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						bind:value={selectedAudienceId}
					>
						<option value="">Select an audience</option>
						{#each audiences as audience (audience.id)}
							<option value={audience.id}>
								{audience.name} ({audience.memberCount.toLocaleString()} contacts)
							</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={() => (audienceDialogOpen = false)}>Cancel</Button>
			<Button
				onclick={saveAudience}
				disabled={convex.disabled || !selectedAudienceId || isSavingAudience}
			>
				{isSavingAudience ? 'Saving...' : `Use this ${destinationLabel}`}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<Dialog bind:open={disconnectDialogOpen}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>Disconnect {providerName}?</DialogTitle>
			<DialogDescription>
				The marketing opt-in will be removed from public waivers immediately. Existing signed
				waivers and {providerName} contacts are not changed.
			</DialogDescription>
		</DialogHeader>
		<DialogFooter>
			<Button variant="outline" onclick={() => (disconnectDialogOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={disconnect} disabled={isDisconnecting}>
				{isDisconnecting ? 'Disconnecting...' : `Disconnect ${providerName}`}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<section class="flex min-w-0 flex-col gap-4 border-t pt-4">
	{#if !canManage}
		<div class="rounded-lg border border-dashed bg-card/50 p-10 text-center">
			<p class="text-sm font-medium">Owner access required</p>
			<p class="mt-1 text-xs text-muted-foreground">
				Only workspace owners can connect or configure {providerName}.
			</p>
		</div>
	{:else if !integration || integration.status === 'disconnected'}
		<div class="space-y-1">
			<h3 class="text-sm font-semibold">Connect your {providerName} account</h3>
			<p class="text-sm leading-relaxed text-muted-foreground">
				Authorize Waiver Director, then choose the {destinationLabel} that should receive opted-in signers.
			</p>
		</div>
		<div class="overflow-hidden border-y" aria-label={`${providerName} connection workflow`}>
			<div class="flex gap-3 border-b py-3">
				<span
					class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
					>1</span
				>
				<div>
					<p class="text-sm font-medium">Authorize {providerName}</p>
					<p class="text-sm text-muted-foreground">
						Sign in and approve access through {providerName}.
					</p>
				</div>
			</div>
			<div class="flex gap-3 py-3">
				<span
					class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
					>2</span
				>
				<div>
					<p class="text-sm font-medium">Choose a {destinationLabel}</p>
					<p class="text-sm text-muted-foreground">
						Opted-in waiver signers are added automatically after submission.
					</p>
				</div>
			</div>
		</div>
		<Button class="self-start" onclick={connect} disabled={convex.disabled || isStartingConnect}>
			{isStartingConnect ? `Opening ${providerName}...` : `Connect ${providerName}`}
			<ExternalLinkIcon class="size-3.5" aria-hidden="true" />
		</Button>
	{:else if integration.status === 'pending_configuration'}
		<div class="rounded-lg border bg-card p-5">
			<h3 class="text-sm font-semibold">{providerName} authorized</h3>
			<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
				Choose a {destinationLabel} to enable the optional marketing checkbox on public waivers.
			</p>
			<Button class="mt-4" onclick={openAudiencePicker} disabled={isLoadingAudiences}>
				{isLoadingAudiences ? `Loading ${destinationLabel}s...` : `Choose ${destinationLabel}`}
			</Button>
		</div>
	{:else}
		<div class="grid gap-3 md:grid-cols-2">
			<div class="rounded-lg border bg-card p-4">
				<p class="text-xs font-medium text-muted-foreground">{destinationLabel}</p>
				<p class="mt-2 text-sm font-semibold">{integration.audienceName ?? 'Not selected'}</p>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<p class="text-xs font-medium text-muted-foreground">Connected</p>
				<p class="mt-2 text-sm font-semibold">{formatTimestamp(integration.connectedAt)}</p>
			</div>
		</div>

		{#if integration.lastSyncError}
			<div
				class="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive"
			>
				<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<div>
					<p class="text-sm font-semibold">A recent contact sync failed</p>
					<p class="mt-1 text-xs leading-relaxed text-destructive/80">
						{integration.lastSyncError}
					</p>
				</div>
			</div>
		{/if}

		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" onclick={openAudiencePicker}>
				<RefreshCwIcon class="size-3.5" aria-hidden="true" />
				Change {destinationLabel}
			</Button>
		</div>
	{/if}
</section>
