<script lang="ts">
	import type { Snippet } from 'svelte';
	import { waiverSectionCardClass } from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<section class={waiverSectionCardClass}>
	<div class="mb-7">
		<h2 class="text-lg font-semibold tracking-tight">Signature</h2>
	</div>

	{@render children()}
</section>
