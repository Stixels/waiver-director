<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import PublicWaiverForm from '$lib/components/waivers/PublicWaiverForm.svelte';

	let { data } = $props();

	type PublicBookingWaiverData = NonNullable<
		FunctionReturnType<typeof api.waivers.getPublicWaiverForBooking>
	>;
	const waiver = $derived(data.waiver as PublicBookingWaiverData);
</script>

<svelte:head>
	<title>{waiver.title} | {waiver.booking.title}</title>
</svelte:head>

<PublicWaiverForm {waiver} booking={waiver.booking} />
