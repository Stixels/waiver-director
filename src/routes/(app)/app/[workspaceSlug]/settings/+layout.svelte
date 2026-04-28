<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import MailIcon from '@lucide/svelte/icons/mail';

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

<PageHeader
	title="Workspace settings"
	subtitle="Configure how this workspace looks, sounds, and connects."
/>

<PageShell>
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
							<Icon class="size-[14px]" />
						</span>
						<span class="settings-nav-text">
							<span class="settings-nav-label">{section.label}</span>
							<span class="settings-nav-desc">{section.description}</span>
						</span>
					</a>
				{/each}
			</nav>
		</aside>

		<!-- Content -->
		<main class="settings-main">
			{@render children?.()}
		</main>
	</div>
</PageShell>

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
		gap: 0.15rem;
	}

	.settings-nav-item {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		padding: 0.6rem 0.75rem;
		border-radius: 0.5rem;
		color: var(--muted-foreground);
		text-decoration: none;
		transition:
			background 140ms ease,
			color 140ms ease;
		min-width: 0;
	}

	.settings-nav-item:hover {
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted) 40%, transparent);
	}

	.settings-nav-item:focus-visible {
		outline: none;
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted) 50%, transparent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent);
	}

	.settings-nav-item[data-active='true'] {
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	.settings-nav-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		margin-top: 0.15rem;
		color: color-mix(in srgb, var(--muted-foreground) 90%, transparent);
		flex-shrink: 0;
		transition: color 140ms ease;
	}

	.settings-nav-item:hover .settings-nav-icon,
	.settings-nav-item[data-active='true'] .settings-nav-icon {
		color: var(--foreground);
	}

	.settings-nav-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		gap: 0.1rem;
	}

	.settings-nav-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: inherit;
		letter-spacing: -0.005em;
		line-height: 1.2;
	}

	.settings-nav-item[data-active='true'] .settings-nav-label {
		font-weight: 600;
	}

	.settings-nav-desc {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		opacity: 0.8;
		line-height: 1.3;
	}

	.settings-main {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
</style>
