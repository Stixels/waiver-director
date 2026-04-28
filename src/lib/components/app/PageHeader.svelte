<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		/** Right-aligned action cluster (buttons, status indicators). */
		actions?: Snippet;
		/** Full-width content rendered under the title row (filters, sender strips). */
		meta?: Snippet;
	}

	let { title, subtitle, actions, meta }: Props = $props();
</script>

<header class="page-header w-full px-6 py-5">
	<div class="mx-auto w-full min-w-0 max-w-7xl">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
			<div class="min-w-0 space-y-1.5">
				<h1 class="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
				{#if subtitle}
					<p class="text-sm text-muted-foreground">{subtitle}</p>
				{/if}
			</div>
			{#if actions}
				<div class="flex shrink-0 items-center gap-2 lg:justify-end">
					{@render actions()}
				</div>
			{/if}
		</div>
		{#if meta}
			<div class="mt-4">{@render meta()}</div>
		{/if}
	</div>
</header>

<style>
	.page-header {
		border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		background: color-mix(in srgb, var(--card) 30%, transparent);
	}
</style>
