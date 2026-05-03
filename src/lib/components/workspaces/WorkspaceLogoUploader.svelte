<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';

	const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
	const MAX_BYTES = 2 * 1024 * 1024;

	interface Props {
		workspaceId: Id<'workspaces'> | null;
		variant?: 'full' | 'inline';
		inlineLabel?: string;
		inlineLabelWithLogo?: string;
		canEdit?: boolean;
		class?: string;
		onClickWhenSet?: (() => void) | null;
		onUploadComplete?: ((logoUrl: string | null) => void) | null;
	}

	let {
		workspaceId,
		variant = 'full',
		inlineLabel = 'Add logo',
		inlineLabelWithLogo = 'Change logo',
		canEdit = true,
		class: className = '',
		onClickWhenSet = null,
		onUploadComplete = null
	}: Props = $props();

	const convex = useConvexClient();
	const brandingQuery = useProtectedQuery(api.workspaces.getWorkspaceBranding, () =>
		workspaceId ? { workspaceId } : 'skip'
	);
	const branding = $derived(brandingQuery.data ?? null);
	const isLoadingBranding = $derived(brandingQuery.isLoading);

	let fileInput = $state<HTMLInputElement | null>(null);
	let isUploading = $state(false);
	let isRemoving = $state(false);

	function openFilePicker() {
		if (!canEdit || !workspaceId) return;
		fileInput?.click();
	}

	function handleInlineClick() {
		if (branding?.logoUrl && onClickWhenSet) {
			onClickWhenSet();
			return;
		}
		openFilePicker();
	}

	async function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !workspaceId) return;

		if (!ACCEPTED_TYPES.includes(file.type)) {
			toast.error('Logo must be a PNG, JPEG, SVG, or WebP image.');
			return;
		}
		if (file.size > MAX_BYTES) {
			toast.error('Logo must be 2MB or smaller.');
			return;
		}

		isUploading = true;
		try {
			const uploadUrl = await convex.mutation(api.workspaces.generateLogoUploadUrl, {
				workspaceId
			});
			const response = await fetch(uploadUrl, {
				method: 'POST',
				headers: { 'Content-Type': file.type },
				body: file
			});
			if (!response.ok) {
				throw new Error(`Upload failed (${response.status})`);
			}
			const { storageId } = (await response.json()) as { storageId: string };
			await convex.mutation(api.workspaces.setWorkspaceLogo, {
				workspaceId,
				storageId: storageId as Id<'_storage'>
			});
			const updatedBranding = await convex.query(api.workspaces.getWorkspaceBranding, {
				workspaceId
			});
			toast.success('Logo updated.');
			onUploadComplete?.(updatedBranding?.logoUrl ?? null);
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to upload logo.'));
		} finally {
			isUploading = false;
		}
	}

	async function removeLogo() {
		if (!canEdit || !workspaceId) return;
		isRemoving = true;
		try {
			await convex.mutation(api.workspaces.removeWorkspaceLogo, { workspaceId });
			toast.success('Logo removed.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to remove logo.'));
		} finally {
			isRemoving = false;
		}
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	accept={ACCEPTED_TYPES.join(',')}
	class="sr-only"
	onchange={handleFileChange}
	aria-hidden="true"
	tabindex="-1"
	disabled={!canEdit || !workspaceId}
/>

{#if variant === 'full'}
	<div class="logo-grid {className}">
		<div class="logo-preview" aria-live="polite">
			{#if isLoadingBranding && !branding}
				<Skeleton class="size-full rounded-md" />
			{:else if branding?.logoUrl}
				<img src={branding.logoUrl} alt={`${branding.name} logo`} class="logo-preview-image" />
			{:else}
				<div class="logo-preview-empty" aria-hidden="true">
					<ImageIcon class="size-7" />
					<span>No logo yet</span>
				</div>
			{/if}
		</div>

		<div class="logo-meta">
			<p class="logo-meta-title">PNG, JPEG, SVG, or WebP. 2MB max.</p>
			<p class="logo-meta-desc">
				Used across the public waiver page and customer emails. Square at least 256x256 works best.
				Transparent backgrounds adapt to light and dark themes.
			</p>
			<div class="mt-2 flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					onclick={openFilePicker}
					disabled={!canEdit || !workspaceId || isUploading || isRemoving}
					class="gap-1.5"
				>
					{#if isUploading}
						<LoaderIcon class="size-3.5 animate-spin" />
						Uploading
					{:else}
						<UploadIcon class="size-3.5" />
						{branding?.logoUrl ? 'Replace logo' : 'Upload logo'}
					{/if}
				</Button>
				{#if branding?.logoUrl}
					<Button
						variant="ghost"
						size="sm"
						onclick={removeLogo}
						disabled={!canEdit || isRemoving || isUploading}
						class="gap-1.5 text-destructive hover:text-destructive"
					>
						{#if isRemoving}
							<LoaderIcon class="size-3.5 animate-spin" />
							Removing
						{:else}
							<Trash2Icon class="size-3.5" />
							Remove
						{/if}
					</Button>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<button
		type="button"
		class="logo-inline-add {className}"
		class:has-logo={Boolean(branding?.logoUrl)}
		onclick={handleInlineClick}
		disabled={!workspaceId || isUploading || (!canEdit && (!branding?.logoUrl || !onClickWhenSet))}
		title={branding?.logoUrl
			? onClickWhenSet
				? `Insert ${branding.name} logo`
				: canEdit
					? 'Change workspace logo'
					: `${branding.name} logo`
			: canEdit
				? 'Upload workspace logo'
				: 'Logo not set'}
	>
		{#if isUploading}
			<LoaderIcon class="size-3.5 animate-spin" aria-hidden="true" />
			<span>Uploading...</span>
		{:else if branding?.logoUrl}
			<span class="logo-inline-thumb-mini" aria-hidden="true">
				<img src={branding.logoUrl} alt="" class="logo-inline-image" />
			</span>
			<span>{inlineLabelWithLogo}</span>
		{:else}
			<ImagePlusIcon class="size-3.5" aria-hidden="true" />
			<span>{inlineLabel}</span>
		{/if}
	</button>
{/if}

<style>
	.logo-grid {
		display: grid;
		grid-template-columns: minmax(0, auto) minmax(0, 1fr);
		align-items: start;
		gap: 1rem;
	}

	.logo-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 6.5rem;
		height: 6.5rem;
		border-radius: var(--radius-md);
		border: 1px dashed var(--border);
		background: color-mix(in srgb, var(--muted) 25%, transparent);
		overflow: hidden;
	}

	.logo-preview-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.logo-preview-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		color: var(--muted-foreground);
		opacity: 0.7;
	}

	.logo-meta {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.logo-meta-title {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--foreground);
	}

	.logo-meta-desc {
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--muted-foreground);
	}

	.logo-inline-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.logo-inline-add {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.55rem;
		font-size: 0.7rem;
		line-height: 1;
		border-radius: var(--radius-md);
		border: 1px dashed color-mix(in srgb, var(--border) 80%, var(--muted-foreground) 20%);
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
		transition:
			color 150ms ease,
			border-color 150ms ease,
			background 150ms ease;
	}

	.logo-inline-add.has-logo {
		border-style: solid;
		border-color: var(--border);
		padding: 0.2rem 0.5rem 0.2rem 0.3rem;
		color: var(--foreground);
	}

	.logo-inline-add:hover:not(:disabled) {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
		background: color-mix(in srgb, var(--primary) 5%, transparent);
	}

	.logo-inline-add:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent);
	}

	.logo-inline-add:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.logo-inline-thumb-mini {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 1.25rem;
		width: 1.25rem;
		border-radius: var(--radius-xs);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: var(--background);
		overflow: hidden;
		flex-shrink: 0;
	}
</style>
