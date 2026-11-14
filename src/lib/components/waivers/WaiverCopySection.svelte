<script lang="ts">
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import { waiverSectionCardClass } from '$lib/components/waivers/waiver-public-form-classes';
	import { isRichTextEmpty } from '$lib/utils/rich-text-shared';

	interface Props {
		introCopy: string;
	}

	let { introCopy }: Props = $props();

	// The waiver copy is optional; skip the card entirely when it has no visible content.
	const hasCopy = $derived(!isRichTextEmpty(introCopy));
</script>

{#if hasCopy}
	<section class={waiverSectionCardClass}>
		<WaiverRichText html={introCopy} class="text-base leading-7 text-foreground/85" />
	</section>
{/if}
