<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import AppSidebar from '$lib/components/app/AppSidebar.svelte';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import {
		Sheet,
		SheetContent,
		SheetTitle,
		SheetDescription
	} from '$lib/components/ui/sheet/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import MenuIcon from '@lucide/svelte/icons/menu';

	let { children } = $props();
	const appContext = useAppContext();

	let sidebarCollapsed = $state(false);
	let mobileNavOpen = $state(false);
	let hasResolvedViewport = $state(false);
	let isDesktop = $state(false);

	const DESKTOP_BREAKPOINT_QUERY = '(min-width: 1024px)';
	const isRouteNavigating = $derived(
		Boolean(navigating.to?.url && navigating.to.url.pathname !== page.url.pathname)
	);

	function closeMobileNav(): void {
		mobileNavOpen = false;
	}

	onMount(() => {
		const mql = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
		const sync = () => {
			isDesktop = mql.matches;
			hasResolvedViewport = true;
			if (mql.matches) mobileNavOpen = false;
		};

		sync();
		mql.addEventListener('change', sync);
		return () => mql.removeEventListener('change', sync);
	});
</script>

<div class="app-shell flex h-screen overflow-hidden bg-background">
	{#if hasResolvedViewport && isDesktop}
		<aside
			class="app-sidebar hidden lg:flex lg:shrink-0 lg:flex-col"
			class:is-collapsed={sidebarCollapsed}
			aria-label="Sidebar navigation"
		>
			<AppSidebar
				bind:collapsed={sidebarCollapsed}
				mode="sidebar"
				initialWorkspaces={appContext.workspaces}
				isLoadingWorkspaces={appContext.isLoading}
			/>
		</aside>
	{/if}

	<div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
		<div class="app-navigation-progress" data-active={isRouteNavigating} aria-hidden="true">
			<div></div>
		</div>

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
					style="background: var(--primary); color: var(--primary-foreground);"
					aria-hidden="true"
				>
					WD
				</div>
				<span class="truncate text-[13px] font-semibold tracking-tight"> Waiver Director </span>
			</a>
		</header>

		{#if hasResolvedViewport && !isDesktop}
			<Sheet bind:open={mobileNavOpen}>
				<SheetContent side="left" class="p-0">
					<SheetTitle class="sr-only">Navigation</SheetTitle>
					<SheetDescription class="sr-only">App navigation and workspace switcher</SheetDescription>
					{#if hasResolvedViewport && mobileNavOpen}
						<AppSidebar
							mode="drawer"
							onNavigate={closeMobileNav}
							initialWorkspaces={appContext.workspaces}
							isLoadingWorkspaces={appContext.isLoading}
						/>
					{/if}
				</SheetContent>
			</Sheet>
		{/if}

		<main class="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
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

	.app-navigation-progress {
		position: absolute;
		inset: 0 0 auto;
		z-index: 40;
		height: 2px;
		overflow: hidden;
		pointer-events: none;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.app-navigation-progress[data-active='true'] {
		opacity: 1;
	}

	.app-navigation-progress > div {
		width: 42%;
		height: 100%;
		background: var(--primary);
		box-shadow: 0 0 18px color-mix(in oklch, var(--primary) 55%, transparent);
		transform: translateX(-100%);
		animation: app-navigation-progress 1s ease-in-out infinite;
	}

	@keyframes app-navigation-progress {
		0% {
			transform: translateX(-100%);
		}

		55% {
			transform: translateX(120%);
		}

		100% {
			transform: translateX(240%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.app-sidebar {
			transition: none;
		}

		.app-navigation-progress > div {
			animation: none;
			transform: none;
			width: 100%;
		}
	}
</style>
