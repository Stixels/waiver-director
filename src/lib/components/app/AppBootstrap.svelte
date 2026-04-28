<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { tick, type Snippet } from 'svelte';
	import { useConvexClient } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import { useConvexAuthState, useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { setAppContext, type AppContextState } from '$lib/components/app/app-context.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	const convexAuth = useConvexAuthState();
	const convex = useConvexClient();
	const appQuery = useProtectedQuery(
		api.app.current,
		() => ({}),
		() => ({ keepPreviousData: true })
	);

	let isEnsuringUser = $state(false);
	let ensureError = $state<Error | null>(null);

	const appState = $state<AppContextState>({
		currentUser: null,
		workspaces: [],
		isLoading: true,
		error: null
	});
	setAppContext(appState);

	const appData = $derived(appQuery.data ?? null);
	const postSignInRedirectTo = $derived.by(() => {
		const next = `${page.url.pathname}${page.url.search}`;
		return encodeURIComponent(next);
	});
	const isPreparingUser = $derived(
		convexAuth.status === 'authenticated' && !!appData && !appData.currentUser && !ensureError
	);
	const isLoading = $derived(
		convexAuth.status === 'loading' ||
			appQuery.isLoading ||
			isEnsuringUser ||
			isPreparingUser ||
			(convexAuth.status === 'authenticated' && !appData && !ensureError)
	);
	const isReady = $derived(
		convexAuth.status === 'authenticated' && !!appData?.currentUser && !isEnsuringUser
	);
	const shouldShowRootSkeleton = $derived(page.url.pathname === resolve('/app') && isLoading);

	$effect(() => {
		appState.currentUser = appData?.currentUser ?? null;
		appState.workspaces = appData?.workspaces ?? [];
		appState.isLoading = isLoading;
		appState.error = ensureError ?? appQuery.error ?? null;
	});

	$effect(() => {
		if (!browser || convexAuth.status !== 'unauthenticated') return;

		void goto(
			resolve(`/sign-in?redirectTo=${postSignInRedirectTo}` as `/sign-in?redirectTo=${string}`),
			{
				replaceState: true,
				noScroll: true
			}
		);
	});

	$effect(() => {
		if (
			!browser ||
			convex.disabled ||
			convexAuth.status !== 'authenticated' ||
			isEnsuringUser ||
			ensureError ||
			!appData ||
			appData.currentUser
		) {
			return;
		}

		isEnsuringUser = true;
		void convex
			.mutation(api.users.ensureCurrentUser, {})
			.catch((error) => {
				ensureError = error instanceof Error ? error : new Error('Unable to prepare your account.');
			})
			.finally(() => {
				isEnsuringUser = false;
			});
	});

	$effect(() => {
		if (!browser || !isReady) return;

		const pathname = page.url.pathname;
		const workspaces = appData?.workspaces ?? [];
		const firstWorkspace = workspaces[0] ?? null;

		if (workspaces.length === 0 && pathname !== resolve('/app/workspaces/new')) {
			void goto(resolve('/app/workspaces/new'), {
				replaceState: true,
				noScroll: true
			});
			return;
		}

		if (firstWorkspace && pathname === resolve('/app')) {
			void goto(resolve(`/app/${firstWorkspace.slug}` as `/app/${string}`), {
				replaceState: true,
				noScroll: true
			});
			return;
		}

		if (firstWorkspace && pathname === resolve('/app/workspaces/new')) {
			void goto(resolve(`/app/${firstWorkspace.slug}` as `/app/${string}`), {
				replaceState: true,
				noScroll: true
			});
		}
	});

	async function retryEnsureUser() {
		ensureError = null;
		await tick();
	}
</script>

{#if convexAuth.status === 'unauthenticated'}
	<div
		class="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground"
	>
		Redirecting to sign in...
	</div>
{:else if appState.error}
	<div class="flex min-h-screen items-center justify-center bg-background px-4">
		<div class="max-w-sm rounded-lg border border-border bg-card p-5 text-center shadow-sm">
			<h1 class="text-base font-semibold text-foreground">Unable to load the app</h1>
			<p class="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
			<button
				type="button"
				class="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
				onclick={retryEnsureUser}
			>
				Try again
			</button>
		</div>
	</div>
{:else if shouldShowRootSkeleton}
	<div class="flex h-screen overflow-hidden bg-background">
		<aside
			class="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col"
		>
			<div class="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
				<Skeleton class="h-7 w-7 rounded-lg bg-sidebar-foreground/10" />
				<Skeleton class="h-4 w-28 bg-sidebar-foreground/10" />
			</div>
			<div class="space-y-5 px-2 py-3">
				<div
					class="flex min-h-10 items-center gap-2.5 rounded-lg bg-sidebar-accent/30 px-2.5 py-2 ring-1 ring-sidebar-border/60 ring-inset"
				>
					<Skeleton class="h-6 w-6 rounded-md bg-sidebar-foreground/10" />
					<div class="min-w-0 flex-1 space-y-1.5">
						<Skeleton class="h-[13px] w-28 bg-sidebar-foreground/10" />
						<Skeleton class="h-[10px] w-14 bg-sidebar-foreground/8" />
					</div>
				</div>
				<div class="space-y-1">
					{#each [0, 1, 2, 3, 4] as index (index)}
						<div class="flex h-9 items-center gap-2 rounded-md px-2">
							<Skeleton class="h-4 w-4 rounded-xs bg-sidebar-foreground/10" />
							<Skeleton class="h-3.5 w-24 bg-sidebar-foreground/10" />
						</div>
					{/each}
				</div>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
			<header class="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 lg:hidden">
				<Skeleton class="h-9 w-9 rounded-lg" />
				<Skeleton class="h-4 w-32" />
			</header>
			<main class="min-w-0 flex-1 overflow-hidden p-6">
				<div class="mx-auto w-full max-w-5xl space-y-5">
					<div class="space-y-2">
						<Skeleton class="h-3 w-24" />
						<Skeleton class="h-7 w-72 max-w-full" />
						<Skeleton class="h-4 w-80 max-w-full" />
					</div>
					<div class="rounded-xl border border-border">
						<div class="grid grid-cols-4 gap-4 border-b border-border px-4 py-3">
							<Skeleton class="h-3 w-16" />
							<Skeleton class="h-3 w-16" />
							<Skeleton class="h-3 w-20" />
							<Skeleton class="h-3 w-20" />
						</div>
						{#each [0, 1, 2, 3, 4, 5] as index (index)}
							<div class="grid grid-cols-4 gap-4 border-b border-border px-4 py-4 last:border-b-0">
								<div class="space-y-1.5">
									<Skeleton class="h-4 w-28" />
									<Skeleton class="h-3 w-12" />
								</div>
								<Skeleton class="h-4 w-40 max-w-full" />
								<Skeleton class="h-4 w-28 max-w-full" />
								<Skeleton class="h-4 w-32 max-w-full" />
							</div>
						{/each}
					</div>
				</div>
			</main>
		</div>
	</div>
{:else}
	{@render children?.()}
{/if}
