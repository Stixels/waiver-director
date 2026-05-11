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
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const convex = useConvexClient();
	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);
	const isOwner = $derived(currentWorkspace?.role === 'owner');

	let confirmOpen = $state(false);
	let confirmTyped = $state('');
	let isDeleting = $state(false);

	const slugMatchesConfirm = $derived(
		!!currentWorkspace && confirmTyped.trim() === currentWorkspace.slug
	);

	function openConfirm() {
		confirmTyped = '';
		confirmOpen = true;
	}

	async function confirmDelete() {
		if (!currentWorkspace || !slugMatchesConfirm) return;
		isDeleting = true;
		try {
			await convex.mutation(api.workspaces.archiveWorkspace, {
				workspaceId: currentWorkspace.workspaceId,
				confirmSlug: confirmTyped.trim()
			});
			confirmOpen = false;
			toast.success('Workspace deleted.');
			await goto(resolve('/app'), { replaceState: true, invalidate: ['app:bootstrap'] });
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to delete workspace.'));
		} finally {
			isDeleting = false;
		}
	}
</script>

<Dialog bind:open={confirmOpen}>
	<DialogContent class="overflow-hidden p-0 sm:max-w-md">
		<DialogHeader class="space-y-2 border-b border-border px-6 py-5">
			<div class="flex items-start gap-3">
				<div
					class="flex size-8 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive"
				>
					<TriangleAlertIcon class="size-5" />
				</div>
				<div class="min-w-0 flex-1">
					<DialogTitle class="text-base">Delete workspace?</DialogTitle>
					<DialogDescription class="text-xs">This cannot be undone.</DialogDescription>
				</div>
			</div>
		</DialogHeader>

		<div class="space-y-4 px-6 py-5">
			<div class="rounded-md border border-destructive/25 bg-destructive/5 px-3.5 py-3">
				<p class="text-xs leading-5 text-destructive/85">
					Deleting <strong>{currentWorkspace?.name}</strong> will hide it from your team and break
					any public waiver links sharing
					<code class="rounded bg-destructive/10 px-1 py-0.5 font-mono text-[11px]"
						>app/{currentWorkspace?.slug}</code
					>. Customer records, submissions, and bookings will no longer be accessible from the app.
				</p>
			</div>

			<div class="space-y-2">
				<label class="text-xs font-medium text-foreground" for="confirm-delete-slug">
					Type
					<code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px]"
						>{currentWorkspace?.slug}</code
					>
					to confirm
				</label>
				<Input
					id="confirm-delete-slug"
					bind:value={confirmTyped}
					placeholder={currentWorkspace?.slug}
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
				disabled={isDeleting}
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				size="sm"
				disabled={!slugMatchesConfirm || isDeleting}
				onclick={confirmDelete}
				class="gap-1.5"
			>
				{#if isDeleting}
					<LoaderIcon class="size-3.5 animate-spin" />
					Deleting
				{:else}
					Delete workspace
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<SettingsSection
	title="Delete workspace"
	description="Permanently remove this workspace. Public waiver links will stop working and the team will lose access."
>
	<aside class="danger-card">
		<TriangleAlertIcon class="size-4 shrink-0" />
		<div class="space-y-1">
			<p class="danger-card-title">This action is destructive</p>
			<p class="danger-card-desc">
				All customer records, submissions, bookings, and email settings tied to this workspace will
				become inaccessible. We don't restore deleted workspaces.
			</p>
		</div>
	</aside>

	{#snippet footer()}
		<div class="settings-section-foot-status">
			{#if !isOwner}
				<span class="status-idle">Only owners can delete a workspace</span>
			{:else}
				<span class="status-idle">No undo. Type the slug to confirm.</span>
			{/if}
		</div>
		<Button
			size="sm"
			variant="destructive"
			onclick={openConfirm}
			disabled={!currentWorkspace || !isOwner}
			class="gap-1.5"
		>
			<Trash2Icon class="size-3.5" />
			Delete workspace...
		</Button>
	{/snippet}
</SettingsSection>

<style>
	.danger-card {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
		padding: 0.85rem 1rem;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--destructive) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--destructive) 20%, var(--border));
		color: color-mix(in srgb, var(--destructive) 70%, var(--foreground));
	}

	.danger-card-title {
		font-size: 0.78rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--destructive) 70%, var(--foreground));
	}

	.danger-card-desc {
		font-size: 0.72rem;
		line-height: 1.5;
		color: color-mix(in srgb, var(--destructive) 48%, var(--muted-foreground));
	}

	.settings-section-foot-status {
		font-size: 0.74rem;
		min-width: 0;
	}

	.status-idle {
		color: var(--muted-foreground);
		opacity: 0.7;
	}
</style>
