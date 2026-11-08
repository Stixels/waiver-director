<script lang="ts">
	import { page } from '$app/state';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';

	type PhotoCaptureMode = 'off' | 'optional' | 'required';

	const MODE_OPTIONS: { value: PhotoCaptureMode; label: string }[] = [
		{ value: 'off', label: 'Off' },
		{ value: 'optional', label: 'Optional' },
		{ value: 'required', label: 'Required' }
	];

	const convex = useConvexClient();
	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);
	const isOwner = $derived(currentWorkspace?.role === 'owner');

	const settingsQuery = useProtectedQuery(api.photoUploads.getWorkspacePhotoCaptureSettings, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);
	const savedSettings = $derived(settingsQuery.data ?? null);

	let participantPhoto = $state<PhotoCaptureMode>('off');
	let idPhoto = $state<PhotoCaptureMode>('off');
	let loadedKey = $state<string | null>(null);
	let isSaving = $state(false);

	$effect(() => {
		if (!currentWorkspace || !savedSettings) return;
		const key = `${currentWorkspace.workspaceId}:${savedSettings.participantPhoto}:${savedSettings.idPhoto}`;
		if (loadedKey !== key) {
			participantPhoto = savedSettings.participantPhoto;
			idPhoto = savedSettings.idPhoto;
			loadedKey = key;
		}
	});

	const hasChanges = $derived(
		Boolean(
			savedSettings &&
			(participantPhoto !== savedSettings.participantPhoto || idPhoto !== savedSettings.idPhoto)
		)
	);

	async function save() {
		if (!currentWorkspace || !isOwner || !hasChanges) return;
		isSaving = true;
		try {
			await convex.mutation(api.photoUploads.updateWorkspacePhotoCaptureSettings, {
				workspaceId: currentWorkspace.workspaceId,
				participantPhoto,
				idPhoto
			});
			toast.success('Photo capture settings saved.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to save photo capture settings.'));
		} finally {
			isSaving = false;
		}
	}
</script>

{#snippet modePicker(
	name: string,
	label: string,
	hint: string,
	value: PhotoCaptureMode,
	onChange: (mode: PhotoCaptureMode) => void
)}
	<fieldset class="mode-fieldset" disabled={!isOwner || isSaving}>
		<legend class="mode-legend">{label}</legend>
		<p class="settings-hint">{hint}</p>
		<div class="mode-options" role="radiogroup" aria-label={label}>
			{#each MODE_OPTIONS as option (option.value)}
				<label class="mode-option" class:selected={value === option.value}>
					<input
						type="radio"
						class="sr-only"
						{name}
						value={option.value}
						checked={value === option.value}
						onchange={() => onChange(option.value)}
					/>
					{option.label}
				</label>
			{/each}
		</div>
	</fieldset>
{/snippet}

{#if !currentWorkspace || !savedSettings}
	<Skeleton class="h-56 w-full rounded-md" />
{:else}
	<SettingsSection
		title="Photo capture"
		description="Ask signers for a photo of themselves or their ID on the public waiver. Photos are stored with the signed submission."
	>
		{@render modePicker(
			'participant-photo',
			'Participant photo',
			'Opens the front camera on phones. Helps staff match guests at check-in.',
			participantPhoto,
			(mode) => (participantPhoto = mode)
		)}
		{@render modePicker(
			'id-photo',
			'Photo ID',
			"Opens the rear camera on phones, for a driver's license or passport.",
			idPhoto,
			(mode) => (idPhoto = mode)
		)}

		{#snippet footer()}
			<p class="settings-hint">
				{#if isOwner}
					Changes apply to new signatures right away. Existing submissions keep their photos.
				{:else}
					Only workspace owners can change photo capture.
				{/if}
			</p>
			{#if isOwner}
				<Button size="sm" onclick={save} disabled={!hasChanges || isSaving}>
					{#if isSaving}
						<LoaderIcon class="size-3.5 animate-spin" aria-hidden="true" />
					{/if}
					Save
				</Button>
			{/if}
		{/snippet}
	</SettingsSection>
{/if}

<style>
	.mode-fieldset {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}

	.mode-legend {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.settings-hint {
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.mode-options {
		display: inline-flex;
		width: fit-content;
		margin-top: 0.25rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.mode-option {
		cursor: pointer;
		padding: 0.4rem 0.85rem;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--muted-foreground);
		border-left: 1px solid var(--border);
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}

	.mode-option:first-child {
		border-left: none;
	}

	.mode-option:hover {
		background: color-mix(in srgb, var(--muted) 50%, transparent);
	}

	.mode-option.selected {
		background: var(--foreground);
		color: var(--background);
	}

	.mode-option:focus-within {
		outline: 2px solid color-mix(in srgb, var(--ring) 60%, transparent);
		outline-offset: -2px;
	}

	.mode-fieldset:disabled .mode-option {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
