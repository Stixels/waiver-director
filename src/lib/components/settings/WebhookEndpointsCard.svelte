<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import SecretRevealDialog from './SecretRevealDialog.svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SendIcon from '@lucide/svelte/icons/send';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	interface Props {
		workspaceId: Id<'workspaces'>;
	}

	let { workspaceId }: Props = $props();

	const convex = useConvexClient();
	const endpointsQuery = useProtectedQuery(api.webhooks.listWebhookEndpoints, () => ({
		workspaceId
	}));
	const endpoints = $derived(endpointsQuery.data?.endpoints ?? []);

	let newUrl = $state('');
	let newDescription = $state('');
	let isCreating = $state(false);
	let busyEndpointId = $state<Id<'webhook_endpoints'> | null>(null);
	let expandedEndpointId = $state<Id<'webhook_endpoints'> | null>(null);
	let revealedSecret = $state('');
	let secretDialogOpen = $state(false);
	let pendingDeleteId = $state<Id<'webhook_endpoints'> | null>(null);
	let deleteDialogOpen = $state(false);

	const deliveriesQuery = useProtectedQuery(api.webhooks.listWebhookDeliveries, () =>
		expandedEndpointId ? { workspaceId, endpointId: expandedEndpointId } : 'skip'
	);

	function formatTime(value: number | null) {
		return value ? new Date(value).toLocaleString() : 'Never';
	}

	function showSecret(secret: string) {
		revealedSecret = secret;
		secretDialogOpen = true;
	}

	async function createEndpoint(event: SubmitEvent) {
		event.preventDefault();
		if (!newUrl.trim() || isCreating) return;
		isCreating = true;
		try {
			const result = await convex.action(api.webhooks.createWebhookEndpoint, {
				workspaceId,
				url: newUrl,
				description: newDescription || undefined,
				eventTypes: ['submission.created']
			});
			newUrl = '';
			newDescription = '';
			showSecret(result.signingSecret);
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Could not add the endpoint.'));
		} finally {
			isCreating = false;
		}
	}

	async function withEndpoint(
		endpointId: Id<'webhook_endpoints'>,
		run: () => Promise<void>,
		fallback: string
	) {
		busyEndpointId = endpointId;
		try {
			await run();
		} catch (error) {
			toast.error(getConvexErrorMessage(error, fallback));
		} finally {
			busyEndpointId = null;
		}
	}

	function sendTest(endpointId: Id<'webhook_endpoints'>) {
		return withEndpoint(
			endpointId,
			async () => {
				await convex.mutation(api.webhooks.sendTestWebhook, { workspaceId, endpointId });
				expandedEndpointId = endpointId;
				toast.success('Test event queued.');
			},
			'Could not send a test event.'
		);
	}

	function toggleStatus(endpointId: Id<'webhook_endpoints'>, enable: boolean) {
		return withEndpoint(
			endpointId,
			async () => {
				await convex.mutation(api.webhooks.updateWebhookEndpoint, {
					workspaceId,
					endpointId,
					status: enable ? 'active' : 'disabled'
				});
			},
			'Could not update the endpoint.'
		);
	}

	function rollSecret(endpointId: Id<'webhook_endpoints'>) {
		return withEndpoint(
			endpointId,
			async () => {
				const result = await convex.action(api.webhooks.rollWebhookSigningSecret, {
					workspaceId,
					endpointId
				});
				showSecret(result.signingSecret);
			},
			'Could not roll the signing secret.'
		);
	}

	function redeliver(deliveryId: Id<'webhook_deliveries'>, endpointId: Id<'webhook_endpoints'>) {
		return withEndpoint(
			endpointId,
			async () => {
				await convex.mutation(api.webhooks.redeliverWebhook, { workspaceId, deliveryId });
				toast.success('Event queued for redelivery.');
			},
			'Could not resend the event.'
		);
	}

	async function confirmDelete() {
		const endpointId = pendingDeleteId;
		if (!endpointId) return;
		await withEndpoint(
			endpointId,
			async () => {
				await convex.mutation(api.webhooks.deleteWebhookEndpoint, { workspaceId, endpointId });
				if (expandedEndpointId === endpointId) expandedEndpointId = null;
				deleteDialogOpen = false;
				toast.success('Endpoint deleted.');
			},
			'Could not delete the endpoint.'
		);
	}
</script>

{#if endpointsQuery.data && !endpointsQuery.data.canManage}
	<p class="text-sm text-muted-foreground">Only workspace owners can manage webhooks.</p>
{:else}
	<form class="flex flex-col gap-2 sm:flex-row" onsubmit={createEndpoint}>
		<Input
			class="sm:flex-[2]"
			type="url"
			placeholder="https://hooks.zapier.com/hooks/catch/…"
			bind:value={newUrl}
			aria-label="Endpoint URL"
			required
		/>
		<Input
			class="sm:flex-1"
			placeholder="Description (optional)"
			bind:value={newDescription}
			aria-label="Endpoint description"
			maxlength={200}
		/>
		<Button type="submit" disabled={isCreating || !newUrl.trim()}>
			{#if isCreating}<LoaderIcon class="animate-spin" />{:else}<PlusIcon />{/if}
			Add endpoint
		</Button>
	</form>
	<p class="text-xs text-muted-foreground">
		We send a signed <code class="font-mono">submission.created</code> event to each endpoint whenever
		a waiver is signed.
	</p>

	{#if endpoints.length === 0}
		<p class="text-sm text-muted-foreground">No webhook endpoints yet.</p>
	{:else}
		<ul class="flex flex-col divide-y rounded-md border">
			{#each endpoints as endpoint (endpoint.endpointId)}
				{@const busy = busyEndpointId === endpoint.endpointId}
				{@const expanded = expandedEndpointId === endpoint.endpointId}
				<li class="flex flex-col gap-2 p-3">
					<div class="flex flex-wrap items-center gap-2">
						<span class="min-w-0 flex-1 truncate font-mono text-xs" title={endpoint.url}
							>{endpoint.url}</span
						>
						{#if endpoint.status === 'active'}
							<Badge variant="secondary">Active</Badge>
						{:else}
							<Badge variant="destructive">Disabled</Badge>
						{/if}
					</div>
					{#if endpoint.description}
						<p class="text-xs text-muted-foreground">{endpoint.description}</p>
					{/if}
					{#if endpoint.disabledReason}
						<p class="text-xs text-destructive">{endpoint.disabledReason}</p>
					{/if}
					<p class="text-xs text-muted-foreground">
						Secret ends in <code class="font-mono">…{endpoint.signingSecretHint}</code> · Last
						delivery: {formatTime(endpoint.lastDeliveryAt)}{#if endpoint.lastDeliveryOk === false}
							(failed){/if}
					</p>
					<div class="flex flex-wrap gap-1.5">
						<Button
							size="sm"
							variant="outline"
							disabled={busy || endpoint.status !== 'active'}
							onclick={() => sendTest(endpoint.endpointId)}
						>
							<SendIcon />Send test
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							onclick={() => toggleStatus(endpoint.endpointId, endpoint.status !== 'active')}
						>
							{endpoint.status === 'active' ? 'Disable' : 'Enable'}
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							onclick={() => rollSecret(endpoint.endpointId)}
						>
							<RotateCwIcon />Roll secret
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onclick={() => (expandedEndpointId = expanded ? null : endpoint.endpointId)}
							aria-expanded={expanded}
						>
							<ChevronDownIcon class={expanded ? 'rotate-180' : ''} />Recent deliveries
						</Button>
						<Button
							size="sm"
							variant="ghost"
							class="text-destructive"
							disabled={busy}
							onclick={() => {
								pendingDeleteId = endpoint.endpointId;
								deleteDialogOpen = true;
							}}
						>
							<Trash2Icon />Delete
						</Button>
					</div>
					{#if expanded}
						{@const deliveries = deliveriesQuery.data ?? []}
						{#if deliveries.length === 0}
							<p class="text-xs text-muted-foreground">No deliveries in the last 30 days.</p>
						{:else}
							<ul class="flex flex-col gap-1 rounded-md bg-muted/30 p-2 text-xs">
								{#each deliveries as delivery (delivery.deliveryId)}
									<li class="flex flex-wrap items-center gap-2">
										<Badge
											variant={delivery.status === 'succeeded'
												? 'secondary'
												: delivery.status === 'failed'
													? 'destructive'
													: 'outline'}>{delivery.status}</Badge
										>
										<code class="font-mono">{delivery.eventType}</code>
										<span class="text-muted-foreground">{formatTime(delivery.createdAt)}</span>
										<span class="text-muted-foreground">
											{delivery.attempts}
											{delivery.attempts === 1
												? 'attempt'
												: 'attempts'}{#if delivery.lastResponseStatus}
												· HTTP {delivery.lastResponseStatus}{/if}
										</span>
										{#if delivery.lastError && delivery.status !== 'succeeded'}
											<span class="w-full text-muted-foreground">{delivery.lastError}</span>
										{/if}
										{#if delivery.status === 'failed' || delivery.status === 'succeeded'}
											<Button
												size="xs"
												variant="ghost"
												disabled={busy || endpoint.status !== 'active'}
												onclick={() => redeliver(delivery.deliveryId, endpoint.endpointId)}
											>
												Resend
											</Button>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<SecretRevealDialog
	bind:open={secretDialogOpen}
	title="Signing secret"
	description="Use this secret to verify the Waiver-Director-Signature header on each request."
	secret={revealedSecret}
/>

<ConfirmDialog
	bind:open={deleteDialogOpen}
	title="Delete webhook endpoint?"
	description="Events will stop being sent to this URL, and its delivery history will be removed."
	confirmLabel="Delete endpoint"
	destructive
	isConfirming={busyEndpointId !== null && busyEndpointId === pendingDeleteId}
	onConfirm={confirmDelete}
/>
