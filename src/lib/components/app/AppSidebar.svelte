<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { appMainNavItems, appConfigNavItems } from '$lib/domain/navigation';
	import CreateWorkspaceForm from '$lib/components/workspaces/CreateWorkspaceForm.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuGroup,
		DropdownMenuGroupHeading
	} from '$lib/components/ui/dropdown-menu/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { mode as themeMode, setMode } from 'mode-watcher';

	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PanelLeftCloseIcon from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpenIcon from '@lucide/svelte/icons/panel-left-open';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import MoonStarIcon from '@lucide/svelte/icons/moon-star';
	import SunIcon from '@lucide/svelte/icons/sun';

	interface Props {
		collapsed?: boolean;
		mode?: 'sidebar' | 'drawer';
		onNavigate?: () => void;
	}

	type AppRouteHref =
		| '/app/[workspaceSlug]'
		| (typeof appMainNavItems)[number]['href']
		| (typeof appConfigNavItems)[number]['href'];

	let { collapsed = $bindable(false), mode = 'sidebar', onNavigate }: Props = $props();

	const clerk = useClerkContext();
	const initialWorkspaces = $derived(page.data.workspaces ?? []);
	const workspacesQuery = useQuery(api.workspaces.listCurrentUserWorkspaces, {}, () => ({
		initialData: initialWorkspaces
	}));
	const workspaces = $derived.by(() => {
		const liveWorkspaces = workspacesQuery.data;

		if (initialWorkspaces.length > 0 && (!liveWorkspaces || liveWorkspaces.length === 0)) {
			return initialWorkspaces;
		}

		return liveWorkspaces ?? [];
	});
	const currentWorkspaceSlug = $derived(page.params.workspaceSlug ?? null);
	const activeWorkspace = $derived.by(() => {
		if (currentWorkspaceSlug) {
			const matchingWorkspace = workspaces.find(
				(workspace: { slug: string }) => workspace.slug === currentWorkspaceSlug
			);
			if (matchingWorkspace) {
				return matchingWorkspace;
			}
		}

		return workspaces[0] ?? null;
	});
	const activeWorkspaceSlug = $derived(activeWorkspace?.slug ?? null);
	const currentPath = $derived(page.url.pathname);
	let isSigningOut = $state(false);
	let createWorkspaceDialogOpen = $state(false);
	const isLoadingWorkspaces = $derived(workspacesQuery.isLoading && workspaces.length === 0);
	const currentWorkspaceSubpath = $derived.by(() => {
		const match = currentPath.match(/^\/app\/[^/]+(\/.*)?$/);
		return match?.[1] ?? '';
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (workspacesQuery.isLoading || !activeWorkspaceSlug) return;
		if (currentWorkspaceSlug === activeWorkspaceSlug) return;

		void goto(resolve(workspacePathnameFor(activeWorkspaceSlug)), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});
	const isCollapsed = $derived(collapsed && mode === 'sidebar');

	function appPathname(href: AppRouteHref): '/app' | `/app/${string}` {
		if (!activeWorkspaceSlug) {
			return '/app';
		}

		return routePathnameFor(href, activeWorkspaceSlug);
	}

	function routePathnameFor(href: AppRouteHref, workspaceSlug: string): `/app/${string}` {
		return href.replace('[workspaceSlug]', workspaceSlug) as `/app/${string}`;
	}

	function workspacePathnameFor(workspaceSlug: string): `/app/${string}` {
		return `/app/${workspaceSlug}${currentWorkspaceSubpath}` as `/app/${string}`;
	}

	function accountPathname(): `/app/${string}` | '/app' {
		if (!activeWorkspaceSlug) {
			return '/app';
		}

		return `/app/${activeWorkspaceSlug}/account` as `/app/${string}`;
	}

	function isActive(href: AppRouteHref): boolean {
		if (!activeWorkspaceSlug) return false;

		const resolvedHref = resolve(appPathname(href));
		return href === '/app/[workspaceSlug]'
			? currentPath === resolvedHref
			: currentPath.startsWith(resolvedHref);
	}

	function getInitials(name: string): string {
		return name
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.join('');
	}

	function toggleThemeMode(): void {
		setMode(themeMode.current === 'dark' ? 'light' : 'dark');
	}

	function handleNavigation(): void {
		onNavigate?.();
	}

	async function selectWorkspace(workspaceSlug: string): Promise<void> {
		handleNavigation();
		if (workspaceSlug === activeWorkspaceSlug) return;

		await goto(resolve(workspacePathnameFor(workspaceSlug)), {
			noScroll: true,
			keepFocus: true
		});
	}

	async function handleWorkspaceCreated(workspace: { slug: string }): Promise<void> {
		createWorkspaceDialogOpen = false;
		handleNavigation();

		await goto(resolve(`/app/${workspace.slug}` as `/app/${string}`), {
			noScroll: true,
			keepFocus: true
		});
	}

	async function handleSignOut(): Promise<void> {
		if (!clerk.clerk || isSigningOut) return;

		handleNavigation();
		isSigningOut = true;

		try {
			await clerk.clerk.signOut({
				redirectUrl: resolve('/')
			});
		} catch (error) {
			console.error('[auth/sign-out] failed', error);
			toast.error('Unable to sign out right now. Please try again.');
		} finally {
			isSigningOut = false;
		}
	}
</script>

<div
	class="sidebar-root flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
	data-collapsed={isCollapsed}
>
	<!-- ─── Header ─── -->
	<div class="sidebar-header flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
		<a
			href={resolve(appPathname('/app/[workspaceSlug]'))}
			onclick={handleNavigation}
			aria-label="Waiver Director dashboard"
			class="sidebar-brand-link flex w-full min-w-0 items-center gap-2.5 no-underline"
		>
			<div
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
				style="background: var(--primary); color: var(--primary-foreground);"
				aria-hidden="true"
			>
				WD
			</div>
			<span
				class="sidebar-copy sidebar-brand-copy truncate text-[13.5px] font-semibold tracking-tight"
			>
				Waiver Director
			</span>
		</a>
	</div>

	<!-- ─── Workspace switcher ─── -->
	<div class="shrink-0 px-2 pt-3 pb-2">
		<DropdownMenu>
			<DropdownMenuTrigger
				class="sidebar-switcher group flex min-h-10 w-full items-center gap-2.5 rounded-lg bg-sidebar-accent/30 px-2.5 py-2 ring-1 ring-sidebar-border/60 transition-all ring-inset hover:bg-sidebar-accent hover:ring-sidebar-border focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
				title={isCollapsed ? (activeWorkspace?.name ?? 'Workspace') : undefined}
				aria-label={isCollapsed
					? `Switch workspace: ${activeWorkspace?.name ?? 'No workspace'}`
					: undefined}
			>
				<div
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
					style="background: var(--sidebar-primary); color: var(--sidebar-primary-foreground);"
					aria-hidden="true"
				>
					{#if isLoadingWorkspaces}
						<Building2Icon class="size-3.5" />
					{:else}
						{activeWorkspace ? getInitials(activeWorkspace.name) : '?'}
					{/if}
				</div>
				<div
					class="sidebar-copy sidebar-meta flex min-h-7 min-w-0 flex-1 flex-col justify-center text-left"
				>
					{#if isLoadingWorkspaces}
						<div class="flex flex-col gap-1">
							<Skeleton class="h-[13px] w-24 bg-sidebar-foreground/10" />
							<Skeleton class="h-[10px] w-12 bg-sidebar-foreground/8" />
						</div>
					{:else}
						<div class="truncate text-[12.5px] leading-tight font-semibold text-sidebar-foreground">
							{#if activeWorkspace}
								{activeWorkspace.name}
							{:else}
								<span class="text-muted-foreground">No workspace</span>
							{/if}
						</div>
						<div class="truncate text-[10px] leading-tight text-muted-foreground capitalize">
							{activeWorkspace?.role ?? ''}
						</div>
					{/if}
				</div>
				<ChevronsUpDownIcon
					class={`sidebar-chrome size-3.5 shrink-0 text-muted-foreground/50 transition-opacity group-hover:opacity-100 ${
						isLoadingWorkspaces ? 'opacity-0' : ''
					}`}
					aria-hidden="true"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="right" sideOffset={10} class="w-60">
				<DropdownMenuGroup>
					<DropdownMenuGroupHeading>Workspaces</DropdownMenuGroupHeading>
					{#if isLoadingWorkspaces}
						<div class="space-y-1 px-2 py-1.5">
							{#each [0, 1] as item (item)}
								<div class="flex items-center gap-2.5 rounded-md px-2 py-1.5">
									<Skeleton class="h-5 w-5 shrink-0 rounded" />
									<div class="min-w-0 flex-1 space-y-1">
										<Skeleton class="h-3 w-24" />
										<Skeleton class="h-2.5 w-12" />
									</div>
								</div>
							{/each}
						</div>
					{:else if workspaces.length === 0}
						<DropdownMenuItem disabled>
							<span class="text-muted-foreground">No workspaces yet</span>
						</DropdownMenuItem>
					{:else}
						{#each workspaces as ws (ws.workspaceId)}
							<DropdownMenuItem onclick={() => void selectWorkspace(ws.slug)}>
								<div class="flex w-full items-center gap-2.5">
									<div
										class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold"
										style="background: var(--sidebar-primary); color: var(--sidebar-primary-foreground);"
										aria-hidden="true"
									>
										{getInitials(ws.name)}
									</div>
									<div class="min-w-0 flex-1">
										<div class="truncate text-[12px] font-medium">{ws.name}</div>
										<div class="text-[10px] text-muted-foreground capitalize">{ws.role}</div>
									</div>
									{#if ws.slug === activeWorkspaceSlug}
										<div
											class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
											aria-label="Active workspace"
										></div>
									{/if}
								</div>
							</DropdownMenuItem>
						{/each}
					{/if}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onclick={() => (createWorkspaceDialogOpen = true)}>
					<div class="flex w-full items-center gap-2">
						<PlusIcon class="size-3.5" aria-hidden="true" />
						Create workspace
					</div>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>

	<Dialog bind:open={createWorkspaceDialogOpen}>
		<DialogContent class="max-w-md p-0">
			<div class="border-b border-border px-5 py-4">
				<DialogHeader>
					<DialogTitle>Create workspace</DialogTitle>
					<DialogDescription>
						Set up a separate workspace with its own team and settings.
					</DialogDescription>
				</DialogHeader>
			</div>
			<div class="px-5 py-5">
				<CreateWorkspaceForm
					autoFocusName={createWorkspaceDialogOpen}
					onCreated={handleWorkspaceCreated}
				/>
			</div>
		</DialogContent>
	</Dialog>

	<!-- ─── Navigation ─── -->
	<nav class="flex flex-1 flex-col overflow-y-auto px-2 pb-2" aria-label="Primary navigation">
		<!-- Main workflow items -->
		<div class="flex flex-col gap-0.5">
			{#each appMainNavItems as item (item.href)}
				{@const active = isActive(item.href)}
				{@const NavIcon = item.icon}
				<a
					href={resolve(appPathname(item.href))}
					class="nav-item group flex items-center gap-3 rounded-lg px-2.5 py-2 no-underline transition-colors"
					class:is-active={active}
					title={isCollapsed ? item.label : undefined}
					aria-current={active ? 'page' : undefined}
					aria-label={isCollapsed ? item.label : undefined}
					onclick={handleNavigation}
				>
					<NavIcon
						class="size-[17px] shrink-0 transition-colors {active
							? 'text-sidebar-foreground'
							: 'text-muted-foreground group-hover:text-sidebar-foreground'}"
						aria-hidden="true"
					/>
					<span
						class="sidebar-copy nav-item-label text-[13px] leading-none transition-colors {active
							? 'font-medium text-sidebar-foreground'
							: 'text-muted-foreground group-hover:text-sidebar-foreground'}"
					>
						{item.label}
					</span>
				</a>
			{/each}
		</div>

		<!-- Configure section -->
		<div class="mt-4 flex flex-col gap-0.5">
			<div class="config-heading px-2.5">
				<span
					class="sidebar-copy config-heading-label text-[10px] font-semibold tracking-widest text-muted-foreground/40 uppercase"
				>
					Configure
				</span>
			</div>
			<div class="config-separator mx-auto h-px w-5 bg-sidebar-border" aria-hidden="true"></div>
			{#each appConfigNavItems as item (item.href)}
				{@const active = isActive(item.href)}
				{@const NavIcon = item.icon}
				<a
					href={resolve(appPathname(item.href))}
					class="nav-item group flex items-center gap-3 rounded-lg px-2.5 py-2 no-underline transition-colors"
					class:is-active={active}
					title={isCollapsed ? item.label : undefined}
					aria-current={active ? 'page' : undefined}
					aria-label={isCollapsed ? item.label : undefined}
					onclick={handleNavigation}
				>
					<NavIcon
						class="size-[17px] shrink-0 transition-colors {active
							? 'text-sidebar-foreground'
							: 'text-muted-foreground group-hover:text-sidebar-foreground'}"
						aria-hidden="true"
					/>
					<span
						class="sidebar-copy nav-item-label text-[13px] leading-none transition-colors {active
							? 'font-medium text-sidebar-foreground'
							: 'text-muted-foreground group-hover:text-sidebar-foreground'}"
					>
						{item.label}
					</span>
				</a>
			{/each}
		</div>

		<!-- Collapse / expand toggle pinned to bottom -->
		{#if mode === 'sidebar'}
			<div class="sidebar-toggle-row mt-auto flex pt-2">
				<button
					class="collapse-btn flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
					onclick={() => (collapsed = !collapsed)}
					title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{#if isCollapsed}
						<PanelLeftOpenIcon class="size-[15px]" aria-hidden="true" />
					{:else}
						<PanelLeftCloseIcon class="size-[15px]" aria-hidden="true" />
					{/if}
				</button>
			</div>
		{/if}
	</nav>

	<!-- ─── User / account footer ─── -->
	<div class="shrink-0 border-t border-sidebar-border px-2 py-2.5">
		<DropdownMenu>
			<DropdownMenuTrigger
				class="sidebar-account-trigger flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
				title={isCollapsed ? 'Account' : undefined}
				aria-label={isCollapsed ? 'Account menu' : undefined}
			>
				<div
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
					style="background: oklch(0.28 0.012 286); color: var(--sidebar-foreground);"
					aria-hidden="true"
				>
					U
				</div>
				<div class="sidebar-copy sidebar-meta min-w-0 flex-1 text-left">
					<div class="truncate text-[12.5px] leading-tight font-medium text-sidebar-foreground">
						Account
					</div>
					<div class="truncate text-[10px] leading-tight text-muted-foreground">
						Settings & billing
					</div>
				</div>
				<EllipsisIcon
					class="sidebar-chrome size-3.5 shrink-0 text-muted-foreground/50"
					aria-hidden="true"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="right" sideOffset={10} class="w-56">
				<DropdownMenuGroup>
					<DropdownMenuGroupHeading>My account</DropdownMenuGroupHeading>
					<DropdownMenuItem>
						<a
							href={resolve(accountPathname())}
							class="flex w-full items-center gap-2 no-underline"
							onclick={handleNavigation}
						>
							<SettingsIcon class="size-3.5 shrink-0" aria-hidden="true" />
							<span class="flex-1">Settings</span>
						</a>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onclick={toggleThemeMode}>
					{#if themeMode.current === 'dark'}
						<SunIcon class="size-3.5 shrink-0" aria-hidden="true" />
						<span>Switch to light mode</span>
					{:else}
						<MoonStarIcon class="size-3.5 shrink-0" aria-hidden="true" />
						<span>Switch to dark mode</span>
					{/if}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onclick={() => void handleSignOut()} disabled={isSigningOut}>
					<LogOutIcon class="size-3.5 shrink-0" aria-hidden="true" />
					<span>{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>
</div>

<style>
	.sidebar-brand-link:focus-visible {
		outline: none;
		border-radius: 0.5rem;
		box-shadow:
			0 0 0 2px var(--sidebar),
			0 0 0 4px oklch(0.52 0.22 277 / 42%);
	}

	.collapse-btn:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--sidebar),
			0 0 0 4px oklch(0.52 0.22 277 / 38%);
	}

	.nav-item {
		color: var(--sidebar-foreground);
		min-height: 2.125rem;
		transition:
			padding 0.22s cubic-bezier(0.4, 0, 0.2, 1),
			gap 0.22s cubic-bezier(0.4, 0, 0.2, 1),
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.nav-item:hover:not(.is-active) {
		background: var(--sidebar-accent);
	}

	.nav-item:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--sidebar),
			0 0 0 4px oklch(0.52 0.22 277 / 35%);
	}

	.nav-item.is-active {
		background: var(--sidebar-accent);
	}

	.sidebar-header,
	.sidebar-toggle-row {
		transition:
			padding 0.22s cubic-bezier(0.4, 0, 0.2, 1),
			gap 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.sidebar-toggle-row {
		justify-content: flex-end;
	}

	.sidebar-brand-link {
		transition: gap 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.sidebar-copy,
	.config-heading,
	.config-separator {
		will-change: opacity, transform, max-width, max-height;
	}

	.sidebar-copy {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		opacity: 1;
		max-width: 12rem;
		transform: translateX(0);
		transform-origin: left center;
		transition:
			max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
			opacity 0.14s ease,
			transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.config-heading,
	.config-separator {
		overflow: hidden;
		transition:
			max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1),
			opacity 0.14s ease,
			margin 0.22s cubic-bezier(0.4, 0, 0.2, 1),
			padding-bottom 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.config-heading {
		max-height: 1.5rem;
		opacity: 1;
		padding-bottom: 0.25rem;
	}

	.config-separator {
		max-height: 0;
		opacity: 0;
		margin-top: 0;
		margin-bottom: 0;
	}

	.sidebar-root[data-collapsed='true'] .sidebar-header {
		padding-inline: 0.875rem;
	}

	.sidebar-root[data-collapsed='true'] .sidebar-brand-link,
	.sidebar-root[data-collapsed='true'] .nav-item {
		gap: 0;
	}

	.sidebar-root[data-collapsed='true'] .nav-item {
		padding-inline: 0.71875rem;
	}

	.sidebar-root[data-collapsed='true'] .sidebar-toggle-row {
		justify-content: center;
	}

	.sidebar-root[data-collapsed='true'] .sidebar-copy {
		max-width: 0;
		opacity: 0;
		transform: translateX(-0.25rem);
	}

	.sidebar-root[data-collapsed='true'] .config-heading {
		max-height: 0;
		opacity: 0;
		padding-bottom: 0;
	}

	.sidebar-root[data-collapsed='true'] .config-separator {
		max-height: 0.25rem;
		opacity: 1;
		margin-bottom: 0.25rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-item,
		.sidebar-header,
		.sidebar-toggle-row,
		.sidebar-brand-link,
		.sidebar-copy,
		.config-heading,
		.config-separator {
			transition: none;
		}
	}
</style>
