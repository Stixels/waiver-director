<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		children: Snippet;
		footer?: Snippet;
	}

	let { title, description, children, footer }: Props = $props();
</script>

<section class="settings-section">
	<div class="settings-section-grid">
		<header class="settings-section-head">
			<h2 class="settings-section-title">{title}</h2>
			{#if description}
				<p class="settings-section-desc">{description}</p>
			{/if}
		</header>
		<article class="settings-section-card">
			<div class="settings-section-body">
				{@render children()}
			</div>
			{#if footer}
				<footer class="settings-section-foot">
					{@render footer()}
				</footer>
			{/if}
		</article>
	</div>
</section>

<style>
	.settings-section {
		padding: 1.5rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
	}

	.settings-section:first-of-type {
		padding-top: 0;
	}

	.settings-section:last-of-type {
		border-bottom: none;
		padding-bottom: 0;
	}

	.settings-section-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.25rem;
	}

	@media (min-width: 1180px) {
		.settings-section-grid {
			grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
			gap: 2rem;
		}
	}

	.settings-section-head {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}

	.settings-section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--foreground);
		line-height: 1.3;
	}

	.settings-section-desc {
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.settings-section-card {
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--card) 92%, var(--background));
	}

	.settings-section-body {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		min-width: 0;
		padding: 1rem;
	}

	.settings-section-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		border-top: 1px solid var(--border);
		background: color-mix(in srgb, var(--muted) 20%, transparent);
		padding: 0.75rem 1rem;
	}

	@media (max-width: 420px) {
		.settings-section-body,
		.settings-section-foot {
			padding-inline: 0.85rem;
		}
	}
</style>
