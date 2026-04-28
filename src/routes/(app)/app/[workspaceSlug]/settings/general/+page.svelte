<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import CheckIcon from '@lucide/svelte/icons/check';

	const WORKSPACE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])$/;

	const convex = useConvexClient();
	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	let name = $state('');
	let slug = $state('');
	let loadedWorkspaceId = $state<string | null>(null);
	let isSavingName = $state(false);
	let nameSavedAt = $state<number | null>(null);

	let confirmOpen = $state(false);
	let confirmTyped = $state('');
	let isSavingSlug = $state(false);

	$effect(() => {
		if (!currentWorkspace) return;
		if (loadedWorkspaceId !== currentWorkspace.workspaceId) {
			name = currentWorkspace.name;
			slug = currentWorkspace.slug;
			loadedWorkspaceId = currentWorkspace.workspaceId;
			nameSavedAt = null;
		}
	});

	function sanitizeSlug(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/[\s_]+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 48)
			.replace(/-$/g, '');
	}

	const trimmedName = $derived(name.trim());
	const nameChanged = $derived(Boolean(currentWorkspace && trimmedName !== currentWorkspace.name));
	const nameValid = $derived(trimmedName.length >= 2 && trimmedName.length <= 80);

	const slugChanged = $derived(Boolean(currentWorkspace && slug && slug !== currentWorkspace.slug));
	const slugValid = $derived(WORKSPACE_SLUG_REGEX.test(slug));
	const slugMatchesConfirm = $derived(confirmTyped.trim() === slug);

	function handleSlugInput(event: Event) {
		const raw = (event.target as HTMLInputElement).value;
		slug = sanitizeSlug(raw);
	}

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

	function openConfirm() {
		confirmTyped = '';
		confirmOpen = true;
	}

	async function confirmSlugChange() {
		if (!currentWorkspace || !slugChanged || !slugValid || !slugMatchesConfirm) return;
		isSavingSlug = true;
		try {
			const result = await convex.mutation(api.workspaces.updateWorkspace, {
				workspaceId: currentWorkspace.workspaceId,
				slug
			});
			confirmOpen = false;
			toast.success('Workspace slug updated. Redirecting…');
			await goto(resolve(`/app/${result.slug}/settings/general` as const), {
				replaceState: true
			});
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to update workspace slug.'));
		} finally {
			isSavingSlug = false;
		}
	}

	function resetSlug() {
		if (!currentWorkspace) return;
		slug = currentWorkspace.slug;
	}
</script>

<!-- Slug change confirmation -->
<Dialog bind:open={confirmOpen}>
	<DialogContent class="overflow-hidden p-0 sm:max-w-md">
		<DialogHeader class="space-y-2 border-b border-border px-6 py-5">
			<div class="flex items-start gap-3">
				<div class="flex size-8 items-center justify-center rounded-md border text-muted-foreground">
					<TriangleAlertIcon class="size-5" />
				</div>
				<div class="min-w-0 flex-1">
					<DialogTitle class="text-base">Change workspace slug?</DialogTitle>
					<DialogDescription class="text-xs">This breaks existing shared links.</DialogDescription>
				</div>
			</div>
		</DialogHeader>

		<div class="space-y-4 px-6 py-5">
			<div class="rounded-md border px-3.5 py-3">
				<p class="text-xs leading-5 text-muted-foreground">
					Existing public waiver links containing
					<code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground"
						>{currentWorkspace?.slug}</code
					>
					will break. Anyone sharing the old URL will get a 404. Update your QR codes, embeds, and any
					links you've handed out.
				</p>
			</div>

			<div class="space-y-2 rounded-md bg-muted/40 px-3.5 py-3">
				<p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
					You're changing
				</p>
				<div class="flex items-center gap-2 font-mono text-xs">
					<span class="text-muted-foreground line-through">app/{currentWorkspace?.slug}</span>
					<span class="text-muted-foreground">→</span>
					<span class="font-medium text-foreground">app/{slug}</span>
				</div>
			</div>

			<div class="space-y-2">
				<label class="text-xs font-medium text-foreground" for="confirm-slug">
					Type
					<code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{slug}</code>
					to confirm
				</label>
				<Input
					id="confirm-slug"
					bind:value={confirmTyped}
					placeholder={slug}
					class="font-mono text-sm"
					autocomplete="off"
					autocorrect="off"
					spellcheck={false}
				/>
			</div>
		</div>

		<DialogFooter class="border-t border-border bg-muted/20 px-6 py-3">
			<Button
				variant="outline"
				size="sm"
				onclick={() => (confirmOpen = false)}
				disabled={isSavingSlug}
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				size="sm"
				disabled={!slugMatchesConfirm || isSavingSlug}
				onclick={confirmSlugChange}
				class="gap-1.5"
			>
				{#if isSavingSlug}
					<LoaderIcon class="size-3.5 animate-spin" />
					Updating
				{:else}
					Change slug permanently
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

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
	title="Workspace URL slug"
	description="The path used in app URLs and public waiver links. Changing this breaks any URL you've already shared."
>
	<div class="space-y-2">
		<div class="slug-field">
			<span class="slug-prefix" aria-hidden="true">app /</span>
			<Input
				id="workspace-slug"
				value={slug}
				oninput={handleSlugInput}
				placeholder="atlas-escape"
				maxlength={48}
				disabled={!currentWorkspace}
				spellcheck={false}
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				class="slug-input h-10 font-mono"
			/>
		</div>
		<p class="settings-hint" class:invalid={slug.length > 0 && !slugValid}>
			{#if slug.length > 0 && !slugValid}
				2–48 lowercase letters, numbers, and hyphens. Must start and end with a letter or number.
			{:else if slugChanged}
				Will change your URL from
				<code class="settings-mono">app/{currentWorkspace?.slug}</code>
				to <code class="settings-mono">app/{slug}</code>.
			{:else}
				Lowercase letters, numbers, and hyphens. Hyphens only in the middle.
			{/if}
		</p>
	</div>

	<aside class="slug-warning">
		<TriangleAlertIcon class="size-4 shrink-0" />
		<div class="space-y-1">
			<p class="slug-warning-title">Slug changes are disruptive</p>
			<p class="slug-warning-desc">
				Public waiver links you've shared, QR codes, and any external bookmark using
				<code class="settings-mono">app/{currentWorkspace?.slug}</code>
				will stop working. We don't redirect old slugs.
			</p>
		</div>
	</aside>

	{#snippet footer()}
		<div class="settings-section-foot-status">
			{#if slugChanged}
				<span class="status-dirty">Pending confirmation</span>
			{:else}
				<span class="status-idle">Up to date</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if slugChanged}
				<Button variant="ghost" size="sm" onclick={resetSlug} disabled={isSavingSlug}>Reset</Button>
			{/if}
			<Button
				size="sm"
				variant="destructive"
				disabled={!slugChanged || !slugValid || isSavingSlug}
				onclick={openConfirm}
			>
				Change slug…
			</Button>
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

	.settings-mono {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.7rem;
		padding: 0.05rem 0.35rem;
		background: color-mix(in srgb, var(--muted) 60%, transparent);
		border-radius: 0.25rem;
		color: var(--foreground);
	}

	.slug-field {
		position: relative;
		display: flex;
		align-items: center;
	}

	.slug-prefix {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.78rem;
		color: var(--muted-foreground);
		opacity: 0.7;
		pointer-events: none;
		z-index: 1;
	}

	.slug-field :global(.slug-input) {
		padding-left: 3.5rem;
		width: 100%;
	}

	.slug-warning {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
		padding: 0.85rem 1rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--destructive) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--destructive) 20%, var(--border));
		color: color-mix(in srgb, var(--destructive) 70%, var(--foreground));
	}

	.slug-warning-title {
		font-size: 0.78rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--destructive) 70%, var(--foreground));
	}

	.slug-warning-desc {
		font-size: 0.72rem;
		line-height: 1.5;
		color: color-mix(in srgb, var(--destructive) 48%, var(--muted-foreground));
	}
</style>
