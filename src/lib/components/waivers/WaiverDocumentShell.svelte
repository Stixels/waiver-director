<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		workspaceName?: string;
		workspaceLogoUrl?: string | null;
		headerActions?: Snippet;
		children: Snippet;
	}

	let { workspaceName, workspaceLogoUrl, headerActions, children }: Props = $props();
</script>

<div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
	{#if workspaceLogoUrl || headerActions}
		<div class="mb-6 flex flex-col items-center gap-3">
			{#if headerActions}
				{@render headerActions()}
			{/if}
			{#if workspaceLogoUrl}
				<img
					src={workspaceLogoUrl}
					alt={`${workspaceName ?? 'Workspace'} logo`}
					class="max-h-40 w-full object-contain"
				/>
			{/if}
		</div>
	{/if}

	{@render children()}
</div>
