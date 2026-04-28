<script lang="ts">
	import { page } from '$app/state';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { api } from '$convex/_generated/api';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import EmailIdentityCard from '$lib/components/emails/EmailIdentityCard.svelte';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';

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
	<SettingsSection
		title="Email identity"
		description="What customers see in their inbox and where replies are sent."
	>
		<EmailIdentityCard
			workspaceId={currentWorkspace.workspaceId}
			workspaceName={currentWorkspace.name}
			{subjectPreview}
		/>
	</SettingsSection>

	<SettingsSection
		title="Custom domain"
		description="Use your own sending domain instead of the shared Waiver Director domain."
	>
		<div class="future-card">
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
	</SettingsSection>
{/if}

<style>
	.loading-stack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.future-card {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.future-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--foreground);
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
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
		border-radius: var(--radius-full);
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
		border-radius: var(--radius-xs);
		color: color-mix(in srgb, var(--foreground) 85%, var(--muted-foreground));
	}
</style>
