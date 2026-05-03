<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import { cn } from '$lib/utils';
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import MailIcon from '@lucide/svelte/icons/mail';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

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
			match: 'general',
			tone: 'default' as const
		},
		{
			href: `/app/${page.params.workspaceSlug}/settings/branding` as const,
			label: 'Branding',
			description: 'Logo and visual identity',
			icon: PaletteIcon,
			match: 'branding',
			tone: 'default' as const
		},
		{
			href: `/app/${page.params.workspaceSlug}/settings/email` as const,
			label: 'Email identity',
			description: 'Sender name, reply-to address',
			icon: MailIcon,
			match: 'email',
			tone: 'default' as const
		},
		{
			href: `/app/${page.params.workspaceSlug}/settings/danger` as const,
			label: 'Danger zone',
			description: 'Delete this workspace',
			icon: TriangleAlertIcon,
			match: 'danger',
			tone: 'destructive' as const
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
	<div class="grid min-h-128 overflow-hidden border-y md:grid-cols-[15rem_minmax(0,1fr)]">
		<aside class="flex flex-col gap-4 border-b p-3 md:border-r md:border-b-0">
			<p class="px-2 pb-0.5 text-sm font-semibold">Settings</p>
			<nav class="flex flex-col gap-0.5" aria-label="Settings sections">
				{#each sections as section (section.href)}
					{@const isActive = activeMatch === section.match}
					{@const Icon = section.icon}
					{@const isDestructive = section.tone === 'destructive'}
					<a
						href={resolve(section.href)}
						class={cn(
							'flex min-w-0 items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors focus-visible:outline-none',
							isDestructive
								? 'text-destructive/85 hover:bg-destructive/10 hover:text-destructive'
								: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
							isActive && !isDestructive && 'bg-muted text-foreground',
							isActive && isDestructive && 'bg-destructive/10 text-destructive'
						)}
						aria-current={isActive ? 'page' : undefined}
					>
						<span class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center">
							<Icon class="size-3.5" />
						</span>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate font-medium">{section.label}</span>
							<span
								class={cn(
									'truncate text-xs',
									isDestructive ? 'text-destructive/65' : 'text-muted-foreground'
								)}>{section.description}</span
							>
						</span>
					</a>
				{/each}
			</nav>
		</aside>

		<main class="min-w-0 p-5">
			{@render children?.()}
		</main>
	</div>
</PageShell>
