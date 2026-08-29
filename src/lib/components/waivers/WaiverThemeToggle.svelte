<script lang="ts">
	import MoonStarIcon from '@lucide/svelte/icons/moon-star';
	import SunIcon from '@lucide/svelte/icons/sun';
	import type { WaiverTheme } from '$lib/domain/waivers';

	interface Props {
		theme?: WaiverTheme;
	}

	let { theme = $bindable('dark') }: Props = $props();
</script>

<div class="theme-control" role="group" aria-label="Waiver appearance">
	<button
		type="button"
		class="theme-option"
		class:is-active={theme === 'light'}
		aria-pressed={theme === 'light'}
		aria-label="Preview waiver in light mode"
		title="Light waiver"
		onclick={() => (theme = 'light')}
	>
		<SunIcon class="size-3.5" aria-hidden="true" />
	</button>
	<button
		type="button"
		class="theme-option"
		class:is-active={theme === 'dark'}
		aria-pressed={theme === 'dark'}
		aria-label="Preview waiver in dark mode"
		title="Dark waiver"
		onclick={() => (theme = 'dark')}
	>
		<MoonStarIcon class="size-3.5" aria-hidden="true" />
	</button>
</div>

<style>
	.theme-control {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.125rem;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--muted) 35%, transparent);
	}

	.theme-option {
		display: inline-flex;
		height: 1.5rem;
		width: 1.5rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.67rem;
		font-weight: 600;
		color: var(--muted-foreground);
		transition:
			background-color 150ms ease,
			color 150ms ease,
			box-shadow 150ms ease;
	}

	.theme-option:hover {
		color: var(--foreground);
	}

	.theme-option.is-active {
		background: var(--background);
		color: var(--foreground);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.theme-option:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 45%, transparent);
	}
</style>
