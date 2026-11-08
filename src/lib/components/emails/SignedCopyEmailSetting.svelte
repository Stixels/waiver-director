<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole';

	interface Props {
		workspaceId: Id<'workspaces'>;
		canExportPdf: boolean;
		isOwner: boolean;
		upgradeHref: string;
	}

	let { workspaceId, canExportPdf, isOwner, upgradeHref }: Props = $props();

	const convex = useConvexClient();
	const senderSettingsQuery = useProtectedQuery(api.emails.getWorkspaceEmailSenderSettings, () => ({
		workspaceId
	}));
	const enabled = $derived(senderSettingsQuery.data?.signedCopyEmailsEnabled ?? true);
	let isSaving = $state(false);

	async function setEnabled(next: boolean) {
		if (isSaving) return;
		isSaving = true;
		try {
			await convex.mutation(api.signedCopies.setSignedCopyEmailsEnabled, {
				workspaceId,
				enabled: next
			});
			toast.success(next ? 'Signers will get a PDF copy.' : 'Signed copy emails turned off.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Could not update the setting.'));
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="signed-copy">
	<label class="signed-copy-row" class:is-disabled={!canExportPdf || !isOwner}>
		<input
			type="checkbox"
			checked={canExportPdf && enabled}
			disabled={!canExportPdf || !isOwner || isSaving || senderSettingsQuery.data === undefined}
			onchange={(event) => setEnabled(event.currentTarget.checked)}
		/>
		<span class="signed-copy-text">
			<span class="signed-copy-title">Email signers a PDF of their signed waiver</span>
			<span class="signed-copy-desc">
				Sent right after signing from your workspace name. Replies go to your verified reply-to
				address when you have one. You can also download or re-send a copy from any submission.
			</span>
		</span>
	</label>
	{#if !canExportPdf}
		<div class="signed-copy-note">
			<LockKeyholeIcon class="size-3.5" aria-hidden="true" />
			<span>Signed PDF copies are included with Pro.</span>
			<Button size="sm" variant="outline" href={upgradeHref}>View plans</Button>
		</div>
	{:else if !isOwner}
		<p class="signed-copy-note">Only workspace owners can change this setting.</p>
	{/if}
</div>

<style>
	.signed-copy {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.signed-copy-row {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		cursor: pointer;
	}

	.signed-copy-row.is-disabled {
		cursor: default;
	}

	.signed-copy-row input {
		margin-top: 0.2rem;
		accent-color: var(--primary);
	}

	.signed-copy-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.signed-copy-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.signed-copy-desc,
	.signed-copy-note {
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--muted-foreground);
	}

	.signed-copy-note {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
</style>
