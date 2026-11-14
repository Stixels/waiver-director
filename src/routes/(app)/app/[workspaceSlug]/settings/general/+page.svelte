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

	let timeZone = $state('');
	let loadedTimeZone = $state<string | null>(null);
	let isSavingTimeZone = $state(false);
	let timeZoneSavedAt = $state<number | null>(null);

	$effect(() => {
		if (!currentWorkspace) return;
		if (loadedWorkspaceId !== currentWorkspace.workspaceId) {
			name = currentWorkspace.name;
			loadedWorkspaceId = currentWorkspace.workspaceId;
			nameSavedAt = null;
			loadedTimeZone = null;
			timeZoneSavedAt = null;
		}
		// The saved zone can arrive after the page loads, when it is filled in
		// from the browser for an older workspace.
		const savedTimeZone = currentWorkspace.timeZone ?? '';
		if (loadedTimeZone !== savedTimeZone) {
			timeZone = savedTimeZone;
			loadedTimeZone = savedTimeZone;
		}
	});

	const timeZoneOptions = $derived.by(() => {
		const supported =
			typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
		const saved = currentWorkspace?.timeZone;
		const names = new Set(['UTC', ...supported, ...(saved ? [saved] : [])]);
		return Array.from(names).sort((a, b) => a.localeCompare(b));
	});
	const timeZoneChanged = $derived(
		Boolean(currentWorkspace && timeZone && timeZone !== (currentWorkspace.timeZone ?? ''))
	);

	async function saveTimeZone() {
		if (!currentWorkspace || !timeZoneChanged) return;
		isSavingTimeZone = true;
		try {
			await convex.mutation(api.workspaces.updateWorkspace, {
				workspaceId: currentWorkspace.workspaceId,
				timeZone
			});
			timeZoneSavedAt = Date.now();
			toast.success('Time zone updated.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to update the time zone.'));
		} finally {
			isSavingTimeZone = false;
		}
	}

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
	title="Time zone"
	description="Where your venue is. Used for dates that don't come from a booking, such as the activity date in a follow-up email for a walk-in."
>
	<div class="space-y-2">
		<select
			id="workspace-time-zone"
			bind:value={timeZone}
			disabled={!currentWorkspace}
			class="time-zone-select"
			aria-label="Workspace time zone"
		>
			{#if !timeZone}
				<option value="" disabled>Choose a time zone</option>
			{/if}
			{#each timeZoneOptions as option (option)}
				<option value={option}>{option.replaceAll('_', ' ')}</option>
			{/each}
		</select>
		<p class="settings-hint">
			Dates from a booking always use the booking's own local date, whatever is set here.
		</p>
	</div>

	{#snippet footer()}
		<div class="settings-section-foot-status">
			{#if timeZoneSavedAt && !timeZoneChanged}
				<span class="status-saved">
					<CheckIcon class="size-3" /> Saved
				</span>
			{:else if timeZoneChanged}
				<span class="status-dirty">Unsaved changes</span>
			{:else if currentWorkspace && !currentWorkspace.timeZone}
				<span class="status-idle">Not set, using UTC</span>
			{:else}
				<span class="status-idle">Up to date</span>
			{/if}
		</div>
		<Button
			size="sm"
			disabled={!timeZoneChanged || isSavingTimeZone}
			onclick={saveTimeZone}
			class="gap-1.5"
		>
			{#if isSavingTimeZone}
				<LoaderIcon class="size-3.5 animate-spin" />
				Saving
			{:else}
				Save time zone
			{/if}
		</Button>
	{/snippet}
</SettingsSection>

<SettingsSection
	title="Workspace URL handle"
	description="The stable path used in your app URLs. It is generated when the workspace is created and cannot be changed."
>
	<div
		class="handle-field"
		class:handle-field--disabled={!currentWorkspace}
		aria-disabled={!currentWorkspace}
	>
		<span class="handle-prefix" aria-hidden="true">app /</span>
		{#if currentWorkspace}
			<code class="handle-value">{currentWorkspace.slug}</code>
		{:else}
			<span class="handle-placeholder">Workspace handle loading…</span>
		{/if}
	</div>
	<p class="settings-hint">
		{#if currentWorkspace}
			Renaming the workspace does not change this handle or any existing links.
		{:else}
			The workspace URL handle will appear after the workspace loads.
		{/if}
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

	.time-zone-select {
		width: 100%;
		height: 2.5rem;
		padding: 0 0.75rem;
		border: 1px solid var(--input);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--foreground);
		font: inherit;
		font-size: 0.875rem;
		outline: none;
	}

	.time-zone-select:focus-visible {
		border-color: var(--ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent);
	}

	.time-zone-select:disabled {
		opacity: 0.55;
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

	.handle-field--disabled {
		opacity: 0.55;
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

	.handle-placeholder {
		color: var(--muted-foreground);
		font-size: 0.78rem;
	}
</style>
