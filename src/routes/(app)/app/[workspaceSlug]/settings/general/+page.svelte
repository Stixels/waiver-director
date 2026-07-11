<script lang="ts">
	import { page } from '$app/state';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import CheckIcon from '@lucide/svelte/icons/check';

	const convex = useConvexClient();
	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	let name = $state('');
	let loadedWorkspaceId = $state<string | null>(null);
	let isSavingName = $state(false);
	let nameSavedAt = $state<number | null>(null);

	$effect(() => {
		if (!currentWorkspace) return;
		if (loadedWorkspaceId !== currentWorkspace.workspaceId) {
			name = currentWorkspace.name;
			loadedWorkspaceId = currentWorkspace.workspaceId;
			nameSavedAt = null;
		}
	});

	const trimmedName = $derived(name.trim());
	const nameChanged = $derived(Boolean(currentWorkspace && trimmedName !== currentWorkspace.name));
	const nameValid = $derived(trimmedName.length >= 2 && trimmedName.length <= 80);

	async function saveName() {
		if (!currentWorkspace || !nameChanged || !nameValid) return;
		isSavingName = true;
		try {
			await convex.mutation(api.workspaces.updateWorkspace, {
				workspaceId: currentWorkspace.workspaceId,
				name: trimmedName
			});
			nameSavedAt = Date.now();
			toast.success('Workspace name updated.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to update workspace name.'));
		} finally {
			isSavingName = false;
		}
	}
</script>

<SettingsSection
	title="Workspace name"
	description="Shown in the sidebar, in your customer's email inbox, and on your waiver page."
>
	<div class="space-y-2">
		<Input
			id="workspace-name"
			bind:value={name}
			placeholder="Atlas Escape & VR"
			maxlength={80}
			disabled={!currentWorkspace}
			autocomplete="organization"
			class="h-10"
		/>
		<p class="settings-hint" class:invalid={!nameValid && trimmedName.length > 0}>
			{#if trimmedName.length > 0 && !nameValid}
				Use 2–80 characters.
			{:else}
				This is the friendly name your team and customers will see.
			{/if}
		</p>
	</div>

	{#snippet footer()}
		<div class="settings-section-foot-status">
			{#if nameSavedAt && !nameChanged}
				<span class="status-saved">
					<CheckIcon class="size-3" /> Saved
				</span>
			{:else if nameChanged}
				<span class="status-dirty">Unsaved changes</span>
			{:else}
				<span class="status-idle">Up to date</span>
			{/if}
		</div>
		<Button
			size="sm"
			disabled={!nameChanged || !nameValid || isSavingName}
			onclick={saveName}
			class="gap-1.5"
		>
			{#if isSavingName}
				<LoaderIcon class="size-3.5 animate-spin" />
				Saving
			{:else}
				Save name
			{/if}
		</Button>
	{/snippet}
</SettingsSection>

<SettingsSection
	title="Workspace URL handle"
	description="The stable path used in your app URLs. It is generated when the workspace is created and cannot be changed."
>
	<div class="handle-field">
		<span class="handle-prefix" aria-hidden="true">app /</span>
		<code class="handle-value">{currentWorkspace?.slug ?? 'workspace-handle'}</code>
	</div>
	<p class="settings-hint">
		Renaming the workspace does not change this handle or any existing links.
	</p>

	{#snippet footer()}
		<div class="settings-section-foot-status">
			<span class="status-idle">Stable URL handle</span>
		</div>
	{/snippet}
</SettingsSection>

<style>
	.settings-section-foot-status {
		font-size: 0.74rem;
		min-width: 0;
	}

	.status-saved {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: oklch(0.64 0.16 152);
		font-weight: 500;
	}

	.status-dirty {
		color: color-mix(in srgb, var(--primary) 62%, var(--foreground));
		font-weight: 500;
	}

	.status-idle {
		color: var(--muted-foreground);
		opacity: 0.7;
	}

	.settings-hint {
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--muted-foreground);
	}

	.settings-hint.invalid {
		color: var(--destructive);
	}

	.handle-field {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 2.5rem;
		padding: 0 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--muted) 28%, transparent);
	}

	.handle-prefix,
	.handle-value {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.78rem;
	}

	.handle-prefix {
		color: var(--muted-foreground);
	}

	.handle-value {
		color: var(--foreground);
		font-weight: 500;
	}
</style>
