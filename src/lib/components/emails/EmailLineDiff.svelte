<script lang="ts">
	import {
		FileDiff,
		type FileDiffMetadata,
		type FileDiffOptions,
		type ThemeTypes
	} from '@pierre/diffs';
	import { mode } from 'mode-watcher';
	import { onMount } from 'svelte';

	interface Props {
		diff: FileDiffMetadata;
		class?: string;
	}

	let { diff, class: className = '' }: Props = $props();

	let host: HTMLDivElement;
	let renderer: FileDiff | undefined;
	let isMounted = $state(false);
	let isRendered = $state(false);

	const hasChanges = $derived(
		diff.hunks.some((hunk) => hunk.hunkContent.some((content) => content.type === 'change'))
	);

	const options: FileDiffOptions<undefined> = {
		theme: { dark: 'pierre-dark', light: 'pierre-light' },
		themeType: 'system',
		diffStyle: 'unified',
		diffIndicators: 'classic',
		disableBackground: false,
		disableFileHeader: true,
		disableLineNumbers: false,
		expandUnchanged: true,
		hunkSeparators: 'simple',
		lineDiffType: 'word',
		overflow: 'wrap',
		preferredHighlighter: 'shiki-js',
		onPostRender(_node, _instance, phase) {
			if (phase !== 'unmount') isRendered = true;
		}
	};

	function currentTheme(): ThemeTypes {
		if (mode.current === 'dark' || mode.current === 'light') return mode.current;
		return 'system';
	}

	onMount(() => {
		renderer = new FileDiff(options);
		isMounted = true;

		return () => {
			renderer?.cleanUp();
			renderer = undefined;
			isMounted = false;
		};
	});

	$effect(() => {
		const nextDiff = diff;
		const nextTheme = currentTheme();
		if (!isMounted || !renderer || !host) return;

		isRendered = false;
		renderer.setThemeType(nextTheme);
		renderer.render({ fileDiff: nextDiff, containerWrapper: host });
	});
</script>

<div
	class={`line-diff ${className}`}
	role="group"
	aria-label="Proposed email changes"
	aria-busy={hasChanges && !isRendered}
>
	{#if !hasChanges}
		<p class="line-diff-state">No changes — the proposal matches the current email.</p>
	{:else if !isRendered}
		<p class="line-diff-state" aria-live="polite">Preparing comparison…</p>
	{/if}

	<div
		bind:this={host}
		class="pierre-diff-host"
		class:is-hidden={!hasChanges}
		aria-hidden={!hasChanges}
	></div>
</div>

<style>
	.line-diff {
		min-width: 0;
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--background) 60%, var(--card));
		overflow: hidden;
		--diffs-font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
		--diffs-font-size: 0.76rem;
		--diffs-line-height: 1.55;
		--diffs-tab-size: 2;
		--diffs-header-font-family: inherit;
		--diffs-min-number-column-width: 3ch;
		--diffs-deletion-color-override: var(--destructive);
		--diffs-addition-color-override: oklch(0.66 0.16 152);
	}

	.line-diff-state {
		margin: 0;
		padding: 1.25rem 1rem;
		text-align: center;
		font-size: 0.78rem;
		color: var(--muted-foreground);
	}

	.pierre-diff-host {
		display: block;
		min-width: 0;
		max-width: 100%;
	}

	.pierre-diff-host.is-hidden {
		display: none;
	}
</style>
