<script lang="ts">
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import { waiverSectionCardClass } from '$lib/components/waivers/waiver-public-form-classes';

	interface Props {
		title: string;
		introCopy: string;
	}

	let { title, introCopy }: Props = $props();
</script>

<section class={waiverSectionCardClass}>
	<div class="space-y-4">
		<h1 class="text-4xl font-bold tracking-tight">{title}</h1>
		{#if introCopy}
			<WaiverRichText html={introCopy} class="text-base leading-relaxed text-foreground/75" />
		{/if}
	</div>
</section>
