<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import WebhookIcon from '@lucide/svelte/icons/webhook';

	type Props = {
		workspaceId: Id<'workspaces'>;
		/** Set when FareHarbor is connected; shows the webhook URL instead of the connect form. */
		integrationId?: Id<'booking_integrations'> | null;
		canManage: boolean;
		/** Called before connecting; return true to stop (for example, plan gating). */
		isBlocked?: () => boolean;
	};

	let { workspaceId, integrationId = null, canManage, isBlocked = () => false }: Props = $props();

	const convex = useConvexClient();

	let companyShortname = $state('');
	let userApiKey = $state('');
	let isConnecting = $state(false);
	let isRevealing = $state(false);
	let webhookUrl = $state<string | null>(null);

	const canSubmit = $derived(
		companyShortname.trim().length > 0 && userApiKey.trim().length > 0 && !isConnecting
	);

	async function connect() {
		if (convex.disabled || !canSubmit || isBlocked()) return;
		isConnecting = true;
		try {
			const result = await convex.action(api.fareharbor.connectFareHarbor, {
				workspaceId,
				companyShortname: companyShortname.trim(),
				userApiKey: userApiKey.trim()
			});
			webhookUrl = result.webhookUrl;
			userApiKey = '';
			toast.success('FareHarbor connected. Initial sync has started.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to connect FareHarbor.'));
		} finally {
			isConnecting = false;
		}
	}

	async function revealWebhookUrl() {
		if (convex.disabled || !integrationId) return;
		isRevealing = true;
		try {
			const result = await convex.action(api.fareharbor.getFareHarborWebhookUrl, {
				workspaceId,
				integrationId
			});
			webhookUrl = result.webhookUrl;
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to load the webhook URL.'));
		} finally {
			isRevealing = false;
		}
	}

	async function copyWebhookUrl() {
		if (!webhookUrl) return;
		try {
			await navigator.clipboard.writeText(webhookUrl);
			toast.success('Webhook URL copied.');
		} catch {
			toast.error('Unable to copy. Select the URL and copy it manually.');
		}
	}
</script>

{#if integrationId}
	<div class="rounded-lg border bg-card p-4">
		<div class="flex items-start gap-3">
			<WebhookIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div class="min-w-0 flex-1 space-y-2">
				<div class="space-y-1">
					<p class="text-sm font-semibold">Real-time updates</p>
					<p class="text-xs leading-relaxed text-muted-foreground">
						Bookings re-sync every 6 hours. For instant updates, ask FareHarbor support to send
						booking webhooks to this URL. Treat it like a password.
					</p>
				</div>
				{#if webhookUrl}
					<div class="flex min-w-0 gap-2">
						<Input
							readonly
							value={webhookUrl}
							class="font-mono text-xs"
							aria-label="FareHarbor webhook URL"
							onfocus={(event) => event.currentTarget.select()}
						/>
						<Button size="sm" variant="outline" onclick={copyWebhookUrl}>
							<CopyIcon class="size-3.5" aria-hidden="true" />
							Copy
						</Button>
					</div>
				{:else if canManage}
					<Button
						size="sm"
						variant="outline"
						onclick={revealWebhookUrl}
						disabled={convex.disabled || isRevealing}
					>
						<EyeIcon class="size-3.5" aria-hidden="true" />
						{isRevealing ? 'Loading...' : 'Show webhook URL'}
					</Button>
				{:else}
					<p class="text-xs text-muted-foreground">Only workspace owners can view this URL.</p>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<form
		class="flex flex-col gap-4 rounded-lg border bg-card p-4"
		onsubmit={(event) => {
			event.preventDefault();
			void connect();
		}}
	>
		<div class="space-y-1.5">
			<Label for="fareharbor-shortname" class="text-xs">Company shortname</Label>
			<Input
				id="fareharbor-shortname"
				bind:value={companyShortname}
				placeholder="baykayaks"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				disabled={isConnecting}
			/>
			<p class="text-xs leading-relaxed text-muted-foreground">
				The part after fareharbor.com/ in your FareHarbor dashboard URL.
			</p>
		</div>
		<div class="space-y-1.5">
			<Label for="fareharbor-user-key" class="text-xs">API user key</Label>
			<Input
				id="fareharbor-user-key"
				type="password"
				bind:value={userApiKey}
				placeholder="Paste the key FareHarbor issued"
				autocomplete="off"
				disabled={isConnecting}
			/>
			<p class="text-xs leading-relaxed text-muted-foreground">
				Request API access for Waiver Director from FareHarbor support. They issue a user key for
				your company. It is stored encrypted.
			</p>
		</div>
		<Button type="submit" class="self-start" disabled={convex.disabled || !canSubmit}>
			{isConnecting ? 'Connecting...' : 'Connect FareHarbor'}
		</Button>
	</form>
{/if}
