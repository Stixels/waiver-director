<script lang="ts">
	import type { Snippet } from 'svelte';
	import { waiverSectionCardClass } from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<section class={waiverSectionCardClass}>
	<div class="mb-8 space-y-2">
		<h2 class="text-lg font-semibold tracking-tight">About the signer</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Provide the signer details, add any minor names, and complete any required custom fields
			below.
		</p>
	</div>

	{@render children()}
</section>
