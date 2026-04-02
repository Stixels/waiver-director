<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import {
		ChevronRight,
		Menu,
		Sparkles,
		Waypoints,
		CircleDollarSign,
		type Icon as LucideIcon
	} from '@lucide/svelte';

	let mobileNavOpen = $state(false);

	function closeMobileNav() {
		mobileNavOpen = false;
	}

	const mobileNavItems: {
		section: string;
		label: string;
		blurb: string;
		icon: typeof LucideIcon;
	}[] = [
		{
			section: 'features',
			label: 'Features',
			blurb: 'Builder, booking sync & automation',
			icon: Sparkles
		},
		{
			section: 'how-it-works',
			label: 'How it works',
			blurb: 'From reservation to signed waiver',
			icon: Waypoints
		},
		{
			section: 'pricing',
			label: 'Pricing',
			blurb: 'Straightforward plans for teams',
			icon: CircleDollarSign
		}
	];
</script>

<nav
	class="sticky top-0 z-50 h-14 border-b"
	style="background: oklch(0.09 0.006 286 / 82%); backdrop-filter: blur(20px) saturate(180%); border-color: var(--m-border);"
	aria-label="Main navigation"
>
	<div
		class="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center"
	>
		<a href={resolve('/')} class="flex items-center gap-2.5 justify-self-start no-underline">
			<div
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
				style="background: var(--m-accent); color: var(--m-accent-fg); box-shadow: 0 0 12px var(--m-accent-glow); font-family: 'Bricolage Grotesque', sans-serif;"
				aria-hidden="true"
			>
				WD
			</div>
			<span
				class="hidden font-bold sm:block"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: 15px; color: var(--m-text);"
				>Waiver Director</span
			>
		</a>

		<div class="hidden items-center justify-center gap-6 md:flex">
			<a
				href={resolve('/#features')}
				class="nav-link text-[13px] no-underline"
				style="color: var(--m-text-2);">Features</a
			>
			<a
				href={resolve('/#how-it-works')}
				class="nav-link text-[13px] no-underline"
				style="color: var(--m-text-2);">How it works</a
			>
			<a
				href={resolve('/#pricing')}
				class="nav-link text-[13px] no-underline"
				style="color: var(--m-text-2);">Pricing</a
			>
		</div>

		<div class="hidden items-center justify-end gap-2 justify-self-end md:flex">
			<Button
				href={resolve('/sign-in')}
				variant="ghost"
				class="h-8 rounded-lg px-4 text-xs font-semibold"
				style="color: var(--m-text-2);"
				>Sign in</Button
			>
			<Button
				href={resolve('/sign-up')}
				class="h-8 rounded-lg border-0 px-4 text-xs font-semibold"
				style="background: var(--m-accent); color: var(--m-accent-fg); box-shadow: 0 0 16px var(--m-accent-glow);"
				>Get early access</Button
			>
		</div>

		<div class="flex md:hidden">
			<Sheet.Root bind:open={mobileNavOpen}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					class="rounded-lg"
					style="color: var(--m-text-2);"
					aria-label="Open menu"
					aria-expanded={mobileNavOpen}
					aria-controls="mobile-nav-menu"
					onclick={() => (mobileNavOpen = true)}
				>
					<Menu class="size-5" strokeWidth={2} aria-hidden="true" />
				</Button>
				<Sheet.Content
					id="mobile-nav-menu"
					side="right"
					showCloseButton={true}
					class="mkt-mobile-sheet flex h-full w-[min(100%,20rem)] max-w-none flex-col border-l sm:max-w-none"
				>
					<Sheet.Header class="border-b pb-5" style="border-color: oklch(1 0 0 / 10%);">
						<Sheet.Title class="sr-only" style="font-family: 'Bricolage Grotesque', sans-serif;"
							>Site menu</Sheet.Title
						>
						<p
							class="mb-1 text-[20px] font-bold leading-tight tracking-tight"
							style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
						>
							Navigate
						</p>
						<p class="text-[12px] leading-relaxed" style="color: var(--m-text-3);">
							Features, pricing, and your account
						</p>
					</Sheet.Header>
					<nav class="flex flex-1 flex-col gap-2.5 py-4" aria-label="Mobile section links">
						{#each mobileNavItems as item, i (item.section)}
							{@const Icon = item.icon}
							<a
								href={resolve(`/#${item.section}`)}
								class="mkt-mobile-nav-item group no-underline outline-none"
								style="animation-delay: {45 + i * 70}ms;"
								onclick={closeMobileNav}
							>
								<span class="mkt-mobile-nav-icon" aria-hidden="true">
									<Icon class="size-[18px]" strokeWidth={1.65} />
								</span>
								<span class="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
									<span
										class="text-[16px] font-semibold leading-snug tracking-tight"
										style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
									>
										{item.label}
									</span>
									<span class="text-[12px] leading-snug" style="color: var(--m-text-3);">
										{item.blurb}
									</span>
								</span>
								<ChevronRight
									class="mkt-mobile-nav-chevron size-4 shrink-0 opacity-35 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-90"
									style="color: var(--m-accent);"
									strokeWidth={2}
									aria-hidden="true"
								/>
							</a>
						{/each}
					</nav>
					<Sheet.Footer
						class="flex-col gap-2 border-t pt-6 sm:flex-col"
						style="border-color: oklch(1 0 0 / 10%);"
					>
						<Button
							href={resolve('/sign-in')}
							variant="outline"
							class="h-10 w-full rounded-lg border font-semibold"
							style="border-color: oklch(1 0 0 / 14%); color: var(--m-text); background: transparent;"
							onclick={closeMobileNav}>Sign in</Button
						>
						<Button
							href={resolve('/sign-up')}
							class="h-10 w-full rounded-lg border-0 font-semibold"
							style="background: var(--m-accent); color: var(--m-accent-fg); box-shadow: 0 0 16px var(--m-accent-glow);"
							onclick={closeMobileNav}>Get early access</Button
						>
					</Sheet.Footer>
				</Sheet.Content>
			</Sheet.Root>
		</div>
	</div>
</nav>

<style>
	.nav-link {
		transition: color 0.15s ease;
	}
	.nav-link:hover {
		color: oklch(0.97 0 0);
	}

	:global([data-slot='sheet-content'].mkt-mobile-sheet) {
		--m-text: oklch(0.97 0 0);
		--m-text-2: oklch(0.72 0.012 286);
		--m-text-3: oklch(0.48 0.016 286);
		--m-accent: oklch(0.52 0.22 277);
		--m-accent-fg: oklch(0.97 0.01 277);
		--m-accent-glow: oklch(0.52 0.22 277 / 28%);
		background: oklch(0.11 0.007 286 / 96%) !important;
		backdrop-filter: blur(24px) saturate(180%);
		color: var(--m-text);
	}

	@keyframes mktMobileNavItemIn {
		from {
			opacity: 0;
			transform: translateX(14px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	:global([data-slot='sheet-content'].mkt-mobile-sheet[data-state='open'] .mkt-mobile-nav-item) {
		animation: mktMobileNavItemIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
	}

	:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-item) {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding: 0.9rem 0.95rem;
		border-radius: 0.8rem;
		border: 1px solid oklch(1 0 0 / 7%);
		background: linear-gradient(
			145deg,
			oklch(0.16 0.012 286 / 72%) 0%,
			oklch(0.12 0.008 286 / 88%) 100%
		);
		box-shadow:
			0 1px 0 oklch(1 0 0 / 6%) inset,
			0 8px 28px oklch(0 0 0 / 22%);
		transition:
			border-color 0.22s ease,
			box-shadow 0.22s ease,
			transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-item:hover) {
		border-color: oklch(0.52 0.22 277 / 32%);
		box-shadow:
			0 1px 0 oklch(1 0 0 / 8%) inset,
			0 0 0 1px oklch(0.52 0.22 277 / 12%),
			0 12px 36px oklch(0.52 0.22 277 / 14%);
		transform: translateX(-3px);
	}

	:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-item:focus-visible) {
		border-color: oklch(0.52 0.22 277 / 45%);
		box-shadow:
			0 0 0 2px oklch(0.09 0.006 286),
			0 0 0 4px oklch(0.52 0.22 277 / 35%);
	}

	:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-icon) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
		border-radius: 0.55rem;
		background: oklch(0.52 0.22 277 / 14%);
		color: oklch(0.78 0.14 277);
		box-shadow: 0 0 20px oklch(0.52 0.22 277 / 12%);
		transition:
			background 0.22s ease,
			color 0.22s ease,
			box-shadow 0.22s ease,
			transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-item:hover .mkt-mobile-nav-icon) {
		background: oklch(0.52 0.22 277 / 24%);
		color: oklch(0.92 0.08 277);
		box-shadow: 0 0 24px oklch(0.52 0.22 277 / 22%);
		transform: scale(1.04);
	}

	@media (prefers-reduced-motion: reduce) {
		:global([data-slot='sheet-content'].mkt-mobile-sheet[data-state='open'] .mkt-mobile-nav-item) {
			animation: none !important;
		}
		:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-item),
		:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-icon) {
			transition: none !important;
		}
		:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-item:hover) {
			transform: none !important;
		}
		:global([data-slot='sheet-content'].mkt-mobile-sheet .mkt-mobile-nav-item:hover .mkt-mobile-nav-icon) {
			transform: none !important;
		}
	}
</style>
