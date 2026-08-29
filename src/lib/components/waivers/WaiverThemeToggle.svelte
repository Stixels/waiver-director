<script lang="ts">
	import { mode as themeMode, setMode } from 'mode-watcher';
	import MoonStarIcon from '@lucide/svelte/icons/moon-star';
	import SunIcon from '@lucide/svelte/icons/sun';

	const isDark = $derived(themeMode.current === 'dark');
	const actionLabel = $derived(isDark ? 'Switch to light mode' : 'Switch to dark mode');

	function toggleTheme() {
		setMode(isDark ? 'light' : 'dark');
	}
</script>

<button
	type="button"
	class="fixed top-3 right-3 z-20 inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card/90 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none sm:top-4 sm:right-4 sm:w-auto sm:gap-2 sm:px-3"
	onclick={toggleTheme}
	aria-label={actionLabel}
	title={actionLabel}
>
	{#if isDark}
		<SunIcon class="size-3.5" aria-hidden="true" />
		<span class="hidden sm:inline">Light</span>
	{:else}
		<MoonStarIcon class="size-3.5" aria-hidden="true" />
		<span class="hidden sm:inline">Dark</span>
	{/if}
</button>
