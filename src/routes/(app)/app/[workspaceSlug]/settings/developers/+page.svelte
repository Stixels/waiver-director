<script lang="ts">
	import { page } from '$app/state';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { publicEnv } from '$lib/config/public';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import WebhookEndpointsCard from '$lib/components/settings/WebhookEndpointsCard.svelte';
	import ApiKeysCard from '$lib/components/settings/ApiKeysCard.svelte';

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);
	const apiBaseUrl = $derived(`${publicEnv.convexSiteUrl.replace(/\/$/, '')}/api/v1`);
</script>

{#if !currentWorkspace}
	<div class="flex flex-col gap-4">
		<Skeleton class="h-48 w-full rounded-md" />
		<Skeleton class="h-32 w-full rounded-md" />
	</div>
{:else}
	<SettingsSection
		title="Webhooks"
		description="Send signed events to Zapier, Make, or your own server when waivers are signed."
	>
		<WebhookEndpointsCard workspaceId={currentWorkspace.workspaceId} />
	</SettingsSection>

	<SettingsSection
		title="API keys"
		description="Read submissions and customers from your own tools with the REST API."
	>
		<ApiKeysCard workspaceId={currentWorkspace.workspaceId} {apiBaseUrl} />
	</SettingsSection>
{/if}
