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
	<title>{waiver.title} | {waiver.booking.activityName}</title>
</svelte:head>

<!-- SvelteKit reuses this page when "Continue to next waiver" changes the slug,
     so remount the form per waiver version to reset its submitted state. -->
{#key `${waiver.versionId}:${waiver.booking.lookupToken}`}
	<PublicWaiverForm {waiver} booking={waiver.booking} requiredWaivers={waiver.requiredWaivers} />
{/key}
