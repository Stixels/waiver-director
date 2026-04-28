<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import MailIcon from '@lucide/svelte/icons/mail';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	let { children } = $props();

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	const sections = $derived([
		{
			href: `/app/${page.params.workspaceSlug}/settings/general` as const,
			label: 'General',
			description: 'Name, slug, identifiers',
			icon: Building2Icon,
			match: 'general'
		},
		{
			href: `/app/${page.params.workspaceSlug}/settings/email` as const,
			label: 'Email identity',
			description: 'Sender name, reply-to address',
			icon: MailIcon,
			match: 'email'
		}
	]);

	const activeMatch = $derived.by(() => {
		const path = page.url.pathname;
		const last = path.split('/').filter(Boolean).pop() ?? '';
		return last;
	});
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Settings | Waiver Director</title>
</svelte:head>

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-7xl min-w-0 space-y-6">
		<!-- Page header -->
		<header class="space-y-1">
			<h1 class="text-2xl font-semibold tracking-tight">Workspace settings</h1>
			<p class="text-sm text-muted-foreground">
				Configure how this workspace looks, sounds, and connects.
			</p>
		</header>

		<div class="settings-grid">
			<!-- Sub-navigation -->
			<aside class="settings-aside">
				<nav class="settings-nav" aria-label="Settings sections">
					{#each sections as section (section.href)}
						{@const isActive = activeMatch === section.match}
						{@const Icon = section.icon}
						<a
							href={resolve(section.href)}
							class="settings-nav-item"
							data-active={isActive}
							aria-current={isActive ? 'page' : undefined}
						>
							<span class="settings-nav-icon">
								<Icon class="size-[15px]" />
							</span>
							<span class="settings-nav-text">
								<span class="settings-nav-label">{section.label}</span>
								<span class="settings-nav-desc">{section.description}</span>
							</span>
							<ChevronRightIcon class="settings-nav-chevron size-3.5" />
						</a>
					{/each}
				</nav>

				<div class="settings-soon">
					<span class="settings-soon-label">Coming soon</span>
					<ul class="settings-soon-list">
						<li>Branding</li>
						<li>Members &amp; roles</li>
						<li>Webhooks</li>
					</ul>
				</div>
			</aside>

			<!-- Content -->
			<main class="settings-main">
				{@render children?.()}
			</main>
		</div>
	</div>
</div>

<style>
	.settings-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
	}

	@media (min-width: 900px) {
		.settings-grid {
			grid-template-columns: 16rem 1fr;
			gap: 2rem;
			align-items: start;
		}
	}

	.settings-aside {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	@media (min-width: 900px) {
		.settings-aside {
			position: sticky;
			top: 1.5rem;
		}
	}

	.settings-nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.settings-nav-item {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.65rem 0.7rem;
		border-radius: 0.65rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--muted-foreground);
		text-decoration: none;
		transition: all 150ms ease;
		min-width: 0;
	}

	.settings-nav-item:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted) 35%, transparent);
	}

	.settings-nav-item[data-active='true'] {
		color: var(--foreground);
		background: color-mix(in srgb, var(--card) 70%, transparent);
		border-color: color-mix(in srgb, var(--border) 80%, transparent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--foreground) 4%, transparent);
	}

	.settings-nav-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--muted) 50%, transparent);
		color: currentColor;
		flex-shrink: 0;
		transition: all 150ms ease;
	}

	.settings-nav-item[data-active='true'] .settings-nav-icon {
		background: color-mix(in srgb, var(--primary) 18%, transparent);
		color: color-mix(in srgb, var(--primary) 60%, var(--foreground));
	}

	.settings-nav-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		gap: 0.05rem;
	}

	.settings-nav-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: inherit;
		letter-spacing: -0.005em;
	}

	.settings-nav-item[data-active='true'] .settings-nav-label {
		font-weight: 600;
	}

	.settings-nav-desc {
		font-size: 0.7rem;
		color: var(--muted-foreground);
		opacity: 0.85;
	}

	:global(.settings-nav-chevron) {
		opacity: 0;
		color: var(--muted-foreground);
		transition: all 150ms ease;
		transform: translateX(-2px);
	}

	.settings-nav-item:hover :global(.settings-nav-chevron),
	.settings-nav-item[data-active='true'] :global(.settings-nav-chevron) {
		opacity: 0.7;
		transform: translateX(0);
	}

	.settings-soon {
		padding: 0.75rem 0.85rem;
		border-radius: 0.65rem;
		border: 1px dashed color-mix(in srgb, var(--border) 90%, transparent);
		background: color-mix(in srgb, var(--muted) 25%, transparent);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.settings-soon-label {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-weight: 600;
		color: var(--muted-foreground);
		opacity: 0.8;
	}

	.settings-soon-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
		font-size: 0.78rem;
		color: var(--muted-foreground);
	}

	.settings-soon-list li::before {
		content: '·';
		display: inline-block;
		width: 0.85rem;
		opacity: 0.5;
	}

	.settings-main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
</style>
