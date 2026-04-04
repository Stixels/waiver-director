<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button';
	import { Menu, X } from '@lucide/svelte';

	const DESKTOP_BREAKPOINT_QUERY = '(min-width: 768px)';

	let mobileNavOpen = $state(false);
	let scrollY = $state(0);
	let scrolled = $derived(scrollY > 24);

	const mobileLinks: { href: '/#features' | '/#how-it-works' | '/#pricing'; label: string }[] = [
		{ href: '/#features', label: 'Features' },
		{ href: '/#how-it-works', label: 'How it works' },
		{ href: '/#pricing', label: 'Pricing' }
	];

	function closeMobileNav() {
		mobileNavOpen = false;
	}

	function toggleMobileNav() {
		mobileNavOpen = !mobileNavOpen;
	}

	function onNavKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && mobileNavOpen) closeMobileNav();
	}

	onMount(() => {
		const desktopMediaQuery = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
		const syncWithViewport = () => {
			if (desktopMediaQuery.matches) {
				mobileNavOpen = false;
			}
		};

		desktopMediaQuery.addEventListener('change', syncWithViewport);
		syncWithViewport();

		return () => {
			desktopMediaQuery.removeEventListener('change', syncWithViewport);
		};
	});
</script>

<svelte:window bind:scrollY onkeydown={onNavKeydown} />

{#if mobileNavOpen}
	<div
		class="mkt-mobile-backdrop md:hidden"
		transition:fade={{ duration: 120 }}
		role="presentation"
		tabindex="-1"
		onclick={closeMobileNav}
		aria-hidden="true"
	></div>
{/if}

<div class="marketing-nav-shell flex flex-col" class:is-scrolled={scrolled}>
	<nav class="marketing-nav-bar mx-auto w-full max-w-6xl" aria-label="Main navigation">
		<div
			class="flex h-14 items-center justify-between gap-3 sm:gap-4 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6"
		>
			<div class="flex min-w-0 items-center gap-3 sm:gap-4 md:justify-self-start">
				<a
					href={resolve('/')}
					aria-label="Waiver Director home"
					class="mkt-brand-link flex min-w-0 items-center gap-2.5 no-underline"
				>
					<div
						class="mkt-brand-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
						style="background: var(--primary); color: var(--primary-foreground); font-family: 'Bricolage Grotesque', sans-serif;"
						aria-hidden="true"
					>
						WD
					</div>
					<span class="sr-only">Waiver Director</span>
					<span class="mkt-brand-wordmark hidden font-bold sm:block">Waiver Director</span>
				</a>
			</div>

			<div class="hidden items-center gap-1 md:flex md:justify-self-center">
				<a href={resolve('/#features')} class="nav-link text-[13px] font-medium no-underline"
					>Features</a
				>
				<a href={resolve('/#how-it-works')} class="nav-link text-[13px] font-medium no-underline"
					>How it works</a
				>
				<a href={resolve('/#pricing')} class="nav-link text-[13px] font-medium no-underline"
					>Pricing</a
				>
			</div>

			<div class="hidden items-center gap-2 md:flex md:justify-self-end">
				<Button
					href={resolve('/sign-in')}
					variant="ghost"
					class="btn-mkt-ghost h-8 rounded-lg px-4 text-xs font-semibold">Sign in</Button
				>
				<Button
					href={resolve('/sign-up')}
					class="btn-mkt-accent h-8 rounded-lg px-4 text-xs font-semibold">Get early access</Button
				>
			</div>

			<div class="flex shrink-0 justify-end md:hidden">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					class="mkt-nav-menu-trigger rounded-lg"
					aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
					aria-expanded={mobileNavOpen}
					aria-controls="mobile-nav-menu"
					onclick={toggleMobileNav}
				>
					{#if mobileNavOpen}
						<X class="size-5" strokeWidth={2} aria-hidden="true" />
					{:else}
						<Menu class="size-5" strokeWidth={2} aria-hidden="true" />
					{/if}
				</Button>
			</div>
		</div>

		{#if mobileNavOpen}
			<div
				id="mobile-nav-menu"
				class="mkt-mobile-panel-wrap md:hidden"
				transition:fly={{ y: -8, duration: 160, opacity: 0.15 }}
			>
				<div class="mkt-mobile-panel">
					<ul class="mkt-mobile-nav-list">
						{#each mobileLinks as item (item.href)}
							<li>
								<a href={resolve(item.href)} class="mkt-mobile-link" onclick={closeMobileNav}>
									{item.label}
								</a>
							</li>
						{/each}
					</ul>

					<div class="mkt-mobile-expand-actions">
						<Button
							href={resolve('/sign-in')}
							variant="outline"
							class="btn-mkt-outline h-11 w-full rounded-xl text-sm font-semibold"
							onclick={closeMobileNav}>Sign in</Button
						>
						<Button
							href={resolve('/sign-up')}
							class="btn-mkt-accent h-11 w-full rounded-xl text-sm font-semibold"
							onclick={closeMobileNav}>Get early access</Button
						>
					</div>
				</div>
			</div>
		{/if}
	</nav>
</div>

<style>
	.mkt-mobile-backdrop {
		position: fixed;
		inset: 0;
		z-index: 45;
		background: oklch(0.02 0.02 277 / 55%);
		opacity: 1;
		pointer-events: auto;
	}

	@media (min-width: 768px) {
		.mkt-mobile-backdrop {
			display: none;
		}
	}

	.mkt-brand-mark {
		box-shadow: none;
	}

	.mkt-brand-wordmark {
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: 15px;
	}

	@media (hover: hover) and (pointer: fine) {
		.mkt-brand-link:hover .mkt-brand-wordmark {
			color: oklch(0.99 0 0);
		}
	}

	.mkt-brand-link:focus-visible {
		outline: none;
		border-radius: 0.6rem;
		box-shadow:
			0 0 0 2px oklch(0.09 0.006 286),
			0 0 0 4px oklch(0.52 0.22 277 / 45%);
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		min-height: 2rem;
		color: var(--muted-foreground);
		padding: 0.4rem 0.8rem;
		border-radius: 0.5rem;
		letter-spacing: -0.01em;
		line-height: 1.2;
		white-space: nowrap;
		transition:
			color 0.15s ease,
			background 0.15s ease;
	}

	@media (hover: hover) and (pointer: fine) {
		.nav-link:hover {
			color: inherit;
			background: oklch(1 0 0 / 6%);
		}
	}

	.nav-link:focus-visible {
		outline: none;
		color: inherit;
		box-shadow:
			0 0 0 2px oklch(0.09 0.006 286),
			0 0 0 4px oklch(0.52 0.22 277 / 40%);
	}

	.mkt-mobile-panel-wrap {
		padding-top: 0.5rem;
		padding-right: max(var(--mkt-nav-inline), env(safe-area-inset-right, 0px));
		padding-bottom: max(0.9rem, env(safe-area-inset-bottom, 0px));
		padding-left: max(var(--mkt-nav-inline), env(safe-area-inset-left, 0px));
	}

	.mkt-mobile-panel {
		position: relative;
		overflow: hidden;
		border: 1px solid oklch(1 0 0 / 8%);
		border-radius: 1rem;
		background: oklch(0.1 0.008 286 / 96%);
		box-shadow: 0 12px 32px oklch(0 0 0 / 24%);
		-webkit-backdrop-filter: blur(16px) saturate(160%);
		backdrop-filter: blur(16px) saturate(160%);
	}

	@media (max-width: 767px), (pointer: coarse) {
		.mkt-mobile-panel {
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
		}
	}

	.mkt-mobile-nav-list {
		position: relative;
		list-style: none;
		margin: 0;
		padding: 0.45rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.mkt-mobile-nav-list li {
		margin: 0;
		padding: 0;
	}

	.mkt-mobile-link {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.85rem 1rem;
		border-radius: 0.75rem;
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: clamp(1.1rem, 4vw, 1.3rem);
		font-weight: 700;
		letter-spacing: -0.015em;
		line-height: 1.2;
		text-decoration: none;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			box-shadow 0.15s ease;
	}

	@media (hover: hover) and (pointer: fine) {
		.mkt-mobile-link:hover {
			background: oklch(1 0 0 / 6%);
			color: oklch(0.99 0 0);
		}
	}

	.mkt-mobile-link:focus-visible {
		outline: none;
		background: oklch(0.52 0.22 277 / 12%);
		box-shadow:
			0 0 0 2px oklch(0.09 0.006 286),
			0 0 0 4px oklch(0.52 0.22 277 / 35%);
	}

	.mkt-mobile-expand-actions {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.9rem;
		border-top: 1px solid oklch(1 0 0 / 8%);
	}
</style>
