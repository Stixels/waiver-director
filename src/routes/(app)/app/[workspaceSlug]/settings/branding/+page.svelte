<script lang="ts">
	import { page } from '$app/state';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import WorkspaceLogoUploader from '$lib/components/workspaces/WorkspaceLogoUploader.svelte';

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);
	const isOwner = $derived(currentWorkspace?.role === 'owner');
</script>

<SettingsSection
	title="Workspace logo"
	description="Shown on your public waiver page, in customer emails, and across the app."
>
	<WorkspaceLogoUploader
		workspaceId={currentWorkspace?.workspaceId ?? null}
		variant="full"
		canEdit={isOwner}
	/>

	{#if !isOwner}
		<p class="settings-readonly-hint">Only workspace owners can change branding.</p>
	{/if}
</SettingsSection>

<style>
	.settings-readonly-hint {
		margin-top: 0.75rem;
		font-size: 0.72rem;
		color: var(--muted-foreground);
	}
</style>
