<script lang="ts">
	import { UserProfile } from 'svelte-clerk/client';
</script>

<svelte:head>
	<title>Account settings | Waiver Director</title>
	<meta name="description" content="Manage your Waiver Director account settings." />
</svelte:head>

<div class="w-full min-w-0 p-4 sm:p-5">
	<div class="mx-auto w-full max-w-7xl min-w-0 space-y-4">
		<div class="account-profile min-h-[calc(100svh-8rem)] min-w-0">
			<UserProfile routing="hash" />
		</div>
	</div>
</div>

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
