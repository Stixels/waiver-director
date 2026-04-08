<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CreateWorkspaceForm from '$lib/components/workspaces/CreateWorkspaceForm.svelte';

	async function handleCreated(workspace: { slug: string }) {
		await goto(resolve(`/app/${workspace.slug}` as `/app/${string}`), {
			replaceState: true,
			noScroll: true
		});
	}
</script>

<svelte:head>
	<title>Create workspace | Waiver Director</title>
	<meta name="description" content="Create the first workspace for your Waiver Director account." />
</svelte:head>

<div class="workspace-shell">
	<div class="workspace-grid" aria-hidden="true"></div>
	<div class="workspace-blob workspace-blob--a" aria-hidden="true"></div>
	<div class="workspace-blob workspace-blob--b" aria-hidden="true"></div>

	<section class="relative z-10 flex w-full max-w-lg flex-col gap-5">
		<div
			class="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-2xl shadow-black/20 backdrop-blur-sm"
		>
			<div class="border-b border-border/60 bg-card px-6 py-6 sm:px-7">
				<p class="mb-2 text-[0.7rem] font-bold tracking-[0.16em] text-primary uppercase">
					One last step
				</p>
				<h1
					class="mb-2 text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em] text-balance text-foreground sm:text-[1.9rem]"
				>
					Create your workspace
				</h1>
				<p class="text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">
					Your workspace is the hub for waivers, bookings, and the team managing them.
				</p>
			</div>

			<div class="px-6 py-6 sm:px-7">
				<CreateWorkspaceForm autoFocusName onCreated={handleCreated} />
			</div>
		</div>

		<p class="px-1 text-center text-xs leading-5 text-muted-foreground/80 sm:text-[0.8125rem]">
			You can rename your workspace or add team members later in settings.
		</p>
	</section>
</div>

<style>
	.workspace-shell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100svh;
		padding: 2.5rem 1rem;
		background: oklch(0.09 0.006 286);
		color: oklch(0.97 0 0);
		overflow: hidden;
	}

	.workspace-grid {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, oklch(1 0 0 / 9%) 1px, transparent 1px);
		background-size: 24px 24px;
		opacity: 0.5;
	}

	.workspace-blob {
		position: absolute;
		border-radius: 9999px;
		pointer-events: none;
		filter: blur(96px);
	}

	.workspace-blob--a {
		top: -6rem;
		left: -8rem;
		width: 24rem;
		height: 24rem;
		background: oklch(0.52 0.22 277 / 14%);
	}

	.workspace-blob--b {
		right: -6rem;
		bottom: -6rem;
		width: 20rem;
		height: 20rem;
		background: oklch(0.52 0.22 277 / 9%);
	}
</style>
