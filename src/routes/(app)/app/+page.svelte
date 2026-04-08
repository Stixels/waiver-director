<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';

	const workspacesQuery = useQuery(api.workspaces.listCurrentUserWorkspaces, {});
	const firstWorkspaceSlug = $derived(workspacesQuery.data?.[0]?.slug ?? null);

	$effect(() => {
		if (!firstWorkspaceSlug) return;

		void goto(resolve(`/app/${firstWorkspaceSlug}` as `/app/${string}`), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});
</script>

<div class="p-6">
	<h2 class="text-base font-semibold">Opening workspace</h2>
	{#if workspacesQuery.isLoading}
		<p class="mt-1 text-sm text-muted-foreground">Loading available workspaces...</p>
	{:else if firstWorkspaceSlug}
		<p class="mt-1 text-sm text-muted-foreground">Redirecting to your workspace...</p>
	{:else}
		<p class="mt-1 text-sm text-muted-foreground">
			You do not have a workspace yet. Create one to access the app.
		</p>
		<p class="mt-4">
			<a href={resolve('/app/workspaces/new')} class="underline underline-offset-4">
				Create workspace
			</a>
		</p>
	{/if}
</div>
