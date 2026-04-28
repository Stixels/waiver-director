<script lang="ts">
	import { page } from '$app/state';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { api } from '$convex/_generated/api';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import EmailIdentityCard from '$lib/components/emails/EmailIdentityCard.svelte';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import LockIcon from '@lucide/svelte/icons/lock';

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	const editorContentQuery = useProtectedQuery(api.emails.getEmailEditorContent, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);
	const editorContent = $derived(editorContentQuery.data);

	const subjectPreview = $derived.by(() => {
		const subject = editorContent?.subject?.trim();
		if (!subject) return undefined;
		return subject
			.replace(/\{\{customer_name\}\}|\{customer_name\}/g, 'Alex')
			.replace(/\{\{business_name\}\}|\{business_name\}/g, currentWorkspace?.name ?? '')
			.replace(/\{\{booking_id\}\}|\{booking_id\}/g, '#1024')
			.replace(/\{\{activity_date\}\}|\{activity_date\}/g, 'today');
	});
</script>

{#if !currentWorkspace}
	<div class="loading-stack">
		<Skeleton class="h-[420px] w-full rounded-2xl" />
		<Skeleton class="h-32 w-full rounded-2xl" />
	</div>
{:else}
	<EmailIdentityCard
		workspaceId={currentWorkspace.workspaceId}
		workspaceName={currentWorkspace.name}
		{subjectPreview}
	/>

	<!-- Coming soon: custom domain -->
	<section class="future-card">
		<div class="future-card-mark">
			<GlobeIcon class="size-[18px]" />
			<span class="future-lock">
				<LockIcon class="size-2.5" />
			</span>
		</div>
		<div class="min-w-0 flex-1 space-y-1.5">
			<div class="flex flex-wrap items-center gap-2">
				<h3 class="future-title">Send from your own domain</h3>
				<span class="future-pill">Coming soon</span>
			</div>
			<p class="future-desc">
				Replace
				<code class="future-mono">via waiverdirector.com</code>
				with
				<code class="future-mono">via {currentWorkspace.slug}.com</code>
				to remove the third-party tag from your customer's inbox. Requires a one-time DNS setup.
			</p>
		</div>
	</section>
{/if}

<style>
	.loading-stack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.future-card {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
		padding: 1.1rem 1.25rem;
		border-radius: 1rem;
		border: 1px dashed color-mix(in srgb, var(--border) 90%, transparent);
		background: color-mix(in srgb, var(--muted) 18%, transparent);
		opacity: 0.85;
	}

	.future-card-mark {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.65rem;
		background: color-mix(in srgb, var(--muted) 60%, transparent);
		color: var(--muted-foreground);
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.future-lock {
		position: absolute;
		bottom: -3px;
		right: -3px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 0.95rem;
		height: 0.95rem;
		border-radius: 9999px;
		background: var(--background);
		border: 1px solid var(--border);
		color: var(--muted-foreground);
	}

	.future-title {
		font-size: 0.92rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--foreground);
		opacity: 0.9;
	}

	.future-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.1rem 0.45rem;
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-weight: 600;
		color: var(--muted-foreground);
		background: color-mix(in srgb, var(--background) 70%, transparent);
		border: 1px solid var(--border);
		border-radius: 9999px;
	}

	.future-desc {
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--muted-foreground);
	}

	.future-mono {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		padding: 0.05rem 0.3rem;
		background: color-mix(in srgb, var(--muted) 50%, transparent);
		border-radius: 0.25rem;
		color: color-mix(in srgb, var(--foreground) 85%, var(--muted-foreground));
	}
</style>
