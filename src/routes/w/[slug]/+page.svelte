<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import PublicWaiverForm from '$lib/components/waivers/PublicWaiverForm.svelte';

	let { data } = $props();

	type PublicWaiverData = NonNullable<FunctionReturnType<typeof api.waivers.getPublicWaiverBySlug>>;
	const waiver = $derived(data.waiver as PublicWaiverData);
</script>

<svelte:head>
	<title>{waiver.title} | {waiver.workspaceName}</title>
</svelte:head>

<PublicWaiverForm {waiver} />
