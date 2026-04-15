<script lang="ts">
	import type { Snippet } from 'svelte';
	import { waiverSectionCardClass } from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<section class={waiverSectionCardClass}>
	<div class="mb-7 space-y-2">
		<h2 class="text-lg font-semibold tracking-tight">Signature</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Draw the signature that should be attached to the full name above.
		</p>
	</div>

	{@render children()}
</section>
