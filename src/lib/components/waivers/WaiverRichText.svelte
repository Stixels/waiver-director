<script lang="ts">
	import { sanitizeRichTextHtml } from '$lib/utils/rich-text';

	interface Props {
		html: string;
		class?: string;
	}

	let { html, class: className = '' }: Props = $props();

	const sanitizedHtml = $derived(sanitizeRichTextHtml(html));
</script>

{#if sanitizedHtml}
	<div class={`waiver-rich-text ${className}`}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html sanitizedHtml}
	</div>
{/if}

<style>
	.waiver-rich-text :global(p) {
		margin: 0 0 1rem;
	}

	.waiver-rich-text :global(h1),
	.waiver-rich-text :global(h2),
	.waiver-rich-text :global(h3),
	.waiver-rich-text :global(h4),
	.waiver-rich-text :global(h5),
	.waiver-rich-text :global(h6) {
		margin: 1.25rem 0 0.75rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.waiver-rich-text :global(h1) {
		font-size: 1.875rem;
	}

	.waiver-rich-text :global(h2) {
		font-size: 1.5rem;
	}

	.waiver-rich-text :global(h3) {
		font-size: 1.25rem;
	}

	.waiver-rich-text :global(h4) {
		font-size: 1.125rem;
	}

	.waiver-rich-text :global(h5),
	.waiver-rich-text :global(h6) {
		font-size: 1rem;
	}

	.waiver-rich-text :global(ul),
	.waiver-rich-text :global(ol) {
		margin: 0 0 1rem;
		padding-left: 1.25rem;
	}

	.waiver-rich-text :global(ul) {
		list-style-type: disc;
	}

	.waiver-rich-text :global(ol) {
		list-style-type: decimal;
	}

	.waiver-rich-text :global(li) {
		display: list-item;
		margin: 0.2rem 0;
	}

	.waiver-rich-text :global(a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	:global(.dark) .waiver-rich-text :global(a) {
		color: color-mix(in oklch, var(--primary) 32%, var(--primary-foreground));
	}

	.waiver-rich-text :global(strong) {
		font-weight: 700;
	}

	.waiver-rich-text :global(em) {
		font-style: italic;
	}

	.waiver-rich-text :global(u) {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.12em;
	}

	.waiver-rich-text :global(s) {
		text-decoration: line-through;
	}
</style>
