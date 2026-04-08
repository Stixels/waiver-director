<script lang="ts">
	interface Props {
		title: string;
		copy?: string;
	}

	let { title, copy = 'Implementation coming soon.' }: Props = $props();
</script>

<div class="p-6">
	<h2 class="text-base font-semibold">{title}</h2>
	<p class="mt-1 text-sm text-muted-foreground">{copy}</p>
</div>
