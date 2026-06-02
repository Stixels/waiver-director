<script lang="ts">
	import type { DiffLine } from '$lib/domain/email-diff';

	interface Props {
		lines: DiffLine[];
		class?: string;
	}

	let { lines, class: className = '' }: Props = $props();

	const hasChanges = $derived(lines.some((line) => line.type !== 'same'));

	function sign(type: DiffLine['type']) {
		if (type === 'add') return '+';
		if (type === 'remove') return '−';
		return '';
	}
</script>

<div class={`line-diff ${className}`} role="group" aria-label="Proposed email changes">
	{#if !hasChanges}
		<p class="line-diff-empty">No changes — the proposal matches the current email.</p>
	{:else}
		<div class="line-diff-scroll">
			{#each lines as line (line.id)}
				<div class="diff-row" data-type={line.type}>
					<span class="gutter gutter-old" aria-hidden="true">{line.oldNumber ?? ''}</span>
					<span class="gutter gutter-new" aria-hidden="true">{line.newNumber ?? ''}</span>
					<span class="sign" data-type={line.type} aria-hidden="true">{sign(line.type)}</span>
					<code class="content"
						>{#each line.segments as segment, index (index)}{#if segment.type === 'add'}<ins
									>{segment.text}</ins
								>{:else if segment.type === 'remove'}<del>{segment.text}</del>{:else}<span
									>{segment.text}</span
								>{/if}{/each}<span class="line-pad"></span></code
					>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.line-diff {
		min-width: 0;
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--background) 60%, var(--card));
		overflow: hidden;
	}

	.line-diff-scroll {
		overflow: auto;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.76rem;
		line-height: 1.55;
	}

	.line-diff-empty {
		margin: 0;
		padding: 1.25rem 1rem;
		text-align: center;
		font-size: 0.78rem;
		color: var(--muted-foreground);
	}

	.diff-row {
		display: grid;
		grid-template-columns: 2.75rem 2.75rem 1.4rem 1fr;
		align-items: stretch;
		min-height: 1.55em;
		border-left: 2px solid transparent;
	}

	.diff-row[data-type='add'] {
		background: color-mix(in srgb, oklch(0.62 0.16 152) 12%, transparent);
		border-left-color: color-mix(in srgb, oklch(0.62 0.16 152) 55%, transparent);
	}

	.diff-row[data-type='remove'] {
		background: color-mix(in srgb, var(--destructive) 11%, transparent);
		border-left-color: color-mix(in srgb, var(--destructive) 50%, transparent);
	}

	.gutter {
		display: inline-flex;
		align-items: flex-start;
		justify-content: flex-end;
		padding: 0.08rem 0.45rem 0 0;
		font-size: 0.66rem;
		font-variant-numeric: tabular-nums;
		color: color-mix(in srgb, var(--muted-foreground) 55%, transparent);
		background: color-mix(in srgb, var(--muted) 22%, transparent);
		user-select: none;
		-webkit-user-select: none;
	}

	.gutter-new {
		border-right: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
	}

	.diff-row[data-type='add'] .gutter {
		color: color-mix(in srgb, oklch(0.62 0.16 152) 70%, var(--muted-foreground));
		background: color-mix(in srgb, oklch(0.62 0.16 152) 9%, transparent);
	}

	.diff-row[data-type='remove'] .gutter {
		color: color-mix(in srgb, var(--destructive) 65%, var(--muted-foreground));
		background: color-mix(in srgb, var(--destructive) 8%, transparent);
	}

	.sign {
		display: inline-flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 0.08rem;
		font-weight: 600;
		user-select: none;
		-webkit-user-select: none;
		color: transparent;
	}

	.sign[data-type='add'] {
		color: oklch(0.66 0.16 152);
	}

	.sign[data-type='remove'] {
		color: color-mix(in srgb, var(--destructive) 80%, var(--foreground));
	}

	.content {
		min-width: 0;
		padding: 0.08rem 0.7rem 0.08rem 0.15rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		word-break: break-word;
		color: color-mix(in srgb, var(--foreground) 90%, var(--muted-foreground));
		font-family: inherit;
	}

	.content ins,
	.content del {
		border-radius: 0.2rem;
		padding: 0.01rem 0.1rem;
		text-decoration: none;
	}

	.content ins {
		color: oklch(0.82 0.17 152);
		background: color-mix(in srgb, oklch(0.6 0.16 152) 26%, transparent);
	}

	.content del {
		color: color-mix(in srgb, var(--destructive) 90%, var(--foreground));
		background: color-mix(in srgb, var(--destructive) 20%, transparent);
	}

	.line-pad::after {
		content: '\200b';
	}
</style>
