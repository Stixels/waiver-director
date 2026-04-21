<script lang="ts">
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import { waiverSectionCardClass } from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		introCopy: string;
	}

	let { introCopy }: Props = $props();
</script>

<section class={waiverSectionCardClass}>
	<WaiverRichText html={introCopy} class="text-base leading-7 text-foreground/85" />
</section>
