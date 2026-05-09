<script lang="ts">
	import { UserProfile } from 'svelte-clerk/client';
	import PageShell from '$lib/components/app/PageShell.svelte';
</script>

<svelte:head>
	<title>Account settings | Waiver Director</title>
	<meta name="description" content="Manage your Waiver Director account settings." />
</svelte:head>

<PageShell>
	<div class="account-profile min-h-[calc(100svh-8rem)] min-w-0">
		<UserProfile routing="hash" />
	</div>
</PageShell>

<style>
	.account-profile :global(.cl-rootBox),
	.account-profile :global(.cl-userProfile-root) {
		width: 100%;
		max-width: none;
	}

	.account-profile :global(.cl-cardBox) {
		width: 100%;
		max-width: none;
		box-shadow: none;
	}
</style>
