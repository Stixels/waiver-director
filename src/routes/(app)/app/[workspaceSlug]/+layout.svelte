<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AppSidebar from '$lib/components/app/AppSidebar.svelte';
	import {
		Sheet,
		SheetContent,
		SheetTitle,
		SheetDescription
	} from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import MenuIcon from '@lucide/svelte/icons/menu';

	let { children } = $props();

	let sidebarCollapsed = $state(false);
	let mobileNavOpen = $state(false);

	const DESKTOP_BREAKPOINT_QUERY = '(min-width: 1024px)';

	function closeMobileNav(): void {
		mobileNavOpen = false;
	}

	onMount(() => {
		const mql = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
		const sync = () => {
			if (mql.matches) mobileNavOpen = false;
		};
		mql.addEventListener('change', sync);
		return () => mql.removeEventListener('change', sync);
	});
</script>

<div class="app-shell flex h-screen overflow-hidden bg-background">
	<aside
		class="app-sidebar hidden lg:flex lg:shrink-0 lg:flex-col"
		class:is-collapsed={sidebarCollapsed}
		aria-label="Sidebar navigation"
	>
		<AppSidebar bind:collapsed={sidebarCollapsed} mode="sidebar" />
	</aside>

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<header
			class="app-topbar flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden"
		>
			<Button
				variant="ghost"
				size="icon-sm"
				class="shrink-0 rounded-lg"
				onclick={() => (mobileNavOpen = true)}
				aria-label="Open navigation"
				aria-expanded={mobileNavOpen}
			>
				<MenuIcon class="size-5" aria-hidden="true" />
			</Button>

			<a
				href={resolve(`/app/${page.params.workspaceSlug}` as `/app/${string}`)}
				onclick={closeMobileNav}
				aria-label="Waiver Director dashboard"
				class="flex min-w-0 items-center gap-2 no-underline"
			>
				<div
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
					style="background: var(--primary); color: var(--primary-foreground); font-family: 'Bricolage Grotesque', sans-serif;"
					aria-hidden="true"
				>
					WD
				</div>
				<span
					class="truncate text-[13px] font-semibold tracking-tight"
					style="font-family: 'Bricolage Grotesque', sans-serif;"
				>
					Waiver Director
				</span>
			</a>
		</header>

		<Sheet bind:open={mobileNavOpen}>
			<SheetContent side="left" class="p-0">
				<SheetTitle class="sr-only">Navigation</SheetTitle>
				<SheetDescription class="sr-only">App navigation and workspace switcher</SheetDescription>
				<AppSidebar mode="drawer" onNavigate={closeMobileNav} />
			</SheetContent>
		</Sheet>

		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.app-sidebar {
		width: 14rem;
		flex-basis: 14rem;
		transition:
			width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
			flex-basis 0.22s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
		will-change: width, flex-basis;
	}

	.app-sidebar.is-collapsed {
		width: 3.5rem;
		flex-basis: 3.5rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.app-sidebar {
			transition: none;
		}
	}
</style>
