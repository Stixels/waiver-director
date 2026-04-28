<script lang="ts">
	import { UserProfile } from 'svelte-clerk/client';
</script>

<svelte:head>
	<title>Account settings | Waiver Director</title>
	<meta name="description" content="Manage your Waiver Director account settings." />
</svelte:head>

<div class="w-full min-w-0 p-6">
	<div class="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6">
		<header class="space-y-1">
			<h1 class="text-2xl font-semibold tracking-tight">Account settings</h1>
			<p class="max-w-2xl text-sm text-muted-foreground">
				Manage your profile, security, and account access.
			</p>
		</header>

		<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
			<div class="min-h-[70svh] overflow-auto p-1 sm:p-2">
				<UserProfile routing="hash" />
			</div>
		</div>
	</div>
</div>
