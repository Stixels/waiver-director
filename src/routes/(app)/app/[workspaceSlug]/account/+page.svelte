<script lang="ts">
	import { UserProfile } from 'svelte-clerk/client';
</script>

<svelte:head>
	<title>Account settings | Waiver Director</title>
	<meta name="description" content="Manage your Waiver Director account settings." />
</svelte:head>

<div class="min-h-full bg-background">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
		<header class="space-y-2">
			<p class="text-xs font-semibold tracking-[0.16em] text-primary uppercase">My account</p>
			<h1 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
				Account settings
			</h1>
			<p class="max-w-2xl text-sm leading-6 text-muted-foreground">
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
