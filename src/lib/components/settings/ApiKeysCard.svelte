<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import SecretRevealDialog from './SecretRevealDialog.svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	interface Props {
		workspaceId: Id<'workspaces'>;
		apiBaseUrl: string;
	}

	let { workspaceId, apiBaseUrl }: Props = $props();

	const convex = useConvexClient();
	const keysQuery = useProtectedQuery(api.apiKeys.listApiKeys, () => ({ workspaceId }));
	const keys = $derived(keysQuery.data?.keys ?? []);

	let newName = $state('');
	let isCreating = $state(false);
	let revealedKey = $state('');
	let keyDialogOpen = $state(false);
	let pendingRevokeId = $state<Id<'api_keys'> | null>(null);
	let revokeDialogOpen = $state(false);
	let isRevoking = $state(false);

	function formatTime(value: number | null) {
		return value ? new Date(value).toLocaleString() : 'Never';
	}

	async function createKey(event: SubmitEvent) {
		event.preventDefault();
		if (!newName.trim() || isCreating) return;
		isCreating = true;
		try {
			const result = await convex.action(api.apiKeys.createApiKey, { workspaceId, name: newName });
			newName = '';
			revealedKey = result.key;
			keyDialogOpen = true;
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Could not create the API key.'));
		} finally {
			isCreating = false;
		}
	}

	async function confirmRevoke() {
		if (!pendingRevokeId) return;
		isRevoking = true;
		try {
			await convex.mutation(api.apiKeys.revokeApiKey, { workspaceId, apiKeyId: pendingRevokeId });
			revokeDialogOpen = false;
			toast.success('API key revoked.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Could not revoke the API key.'));
		} finally {
			isRevoking = false;
		}
	}
</script>

{#if keysQuery.data && !keysQuery.data.canManage}
	<p class="text-sm text-muted-foreground">Only workspace owners can manage API keys.</p>
{:else}
	<form class="flex flex-col gap-2 sm:flex-row" onsubmit={createKey}>
		<Input
			class="sm:flex-1"
			placeholder="Key name, e.g. Zapier"
			bind:value={newName}
			aria-label="API key name"
			maxlength={80}
			required
		/>
		<Button type="submit" disabled={isCreating || !newName.trim()}>
			{#if isCreating}<LoaderIcon class="animate-spin" />{:else}<KeyRoundIcon />{/if}
			Create key
		</Button>
	</form>
	<p class="text-xs text-muted-foreground">
		Keys give read-only access to this workspace's submissions and customers. Base URL:
		<code class="font-mono break-all">{apiBaseUrl}</code>
	</p>

	{#if keys.length === 0}
		<p class="text-sm text-muted-foreground">No API keys yet.</p>
	{:else}
		<ul class="flex flex-col divide-y rounded-md border">
			{#each keys as key (key.apiKeyId)}
				<li class="flex flex-wrap items-center gap-2 p-3">
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="truncate text-sm font-medium">{key.name}</span>
						<span class="text-xs text-muted-foreground">
							<code class="font-mono">{key.keyPrefix}…</code> · Created {formatTime(key.createdAt)} ·
							Last used {formatTime(key.lastUsedAt)}
						</span>
					</div>
					<Button
						size="sm"
						variant="ghost"
						class="text-destructive"
						onclick={() => {
							pendingRevokeId = key.apiKeyId;
							revokeDialogOpen = true;
						}}
					>
						<Trash2Icon />Revoke
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<SecretRevealDialog
	bind:open={keyDialogOpen}
	title="Your new API key"
	description="Send it as a Bearer token in the Authorization header."
	secret={revealedKey}
/>

<ConfirmDialog
	bind:open={revokeDialogOpen}
	title="Revoke API key?"
	description="Any integration using this key will stop working immediately."
	confirmLabel="Revoke key"
	destructive
	isConfirming={isRevoking}
	onConfirm={confirmRevoke}
/>
