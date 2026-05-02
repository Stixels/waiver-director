<script lang="ts">
	import { UserProfile } from 'svelte-clerk/client';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
</script>

<svelte:head>
	<title>Account settings | Waiver Director</title>
	<meta name="description" content="Manage your Waiver Director account settings." />
</svelte:head>

<PageHeader
	title="Account settings"
	subtitle="Manage your profile, security, and account access."
/>

<PageShell>
	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
		<div class="min-h-[70svh] overflow-auto p-1 sm:p-2">
			<UserProfile routing="hash" />
		</div>
	</div>
</PageShell>
