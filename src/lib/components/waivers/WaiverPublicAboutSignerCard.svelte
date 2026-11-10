<script lang="ts">
	import type { Snippet } from 'svelte';
	import { waiverSectionCardClass } from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		children: Snippet;
		heading?: string;
	}

	let { children, heading = 'Signer details' }: Props = $props();
</script>

<section class={waiverSectionCardClass}>
	<div class="mb-8">
		<h2 class="text-lg font-semibold tracking-tight">{heading}</h2>
	</div>

	{@render children()}
</section>
