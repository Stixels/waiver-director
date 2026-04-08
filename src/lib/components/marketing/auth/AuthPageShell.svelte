<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		children,
		footer,
		width = 'standard'
	}: {
		title: string;
		description?: string;
		children: Snippet;
		footer?: Snippet;
		/** `narrow` — e.g. sign-in. `standard` — sign-up / forgot-password. */
		width?: 'standard' | 'narrow';
	} = $props();

	const shellMaxClass = $derived(width === 'narrow' ? 'max-w-lg' : 'max-w-2xl');
</script>

<section
	class="auth-page relative flex min-h-[calc(100svh-var(--mkt-nav-offset))] flex-col items-center justify-start overflow-hidden px-4 pb-24 sm:px-8"
>
	<div class="auth-page__grid absolute inset-0 opacity-40" aria-hidden="true"></div>

	<div
		class="mkt-blob-float-a pointer-events-none absolute top-[8%] left-[-8%] h-[320px] w-[320px] rounded-full blur-[72px] md:h-[400px] md:w-[400px] md:blur-[88px]"
		style="background: oklch(0.52 0.22 277 / 16%);"
		aria-hidden="true"
	></div>
	<div
		class="mkt-blob-float-b pointer-events-none absolute right-[-12%] bottom-[18%] h-[280px] w-[280px] rounded-full blur-3xl md:h-[360px] md:w-[360px] md:blur-[80px]"
		style="background: oklch(0.52 0.22 277 / 10%);"
		aria-hidden="true"
	></div>

	<div class="relative z-10 w-full shrink-0 pt-12 pb-6 sm:pt-16 sm:pb-8 {shellMaxClass}">
		<div
			class="overflow-hidden rounded-xl border border-(--m-border-strong) bg-(--m-surface) sm:rounded-2xl"
			style="box-shadow: 0 18px 40px oklch(0 0 0 / 42%);"
		>
			<div class="border-b border-(--m-border-soft) bg-(--m-card) px-9 py-8 sm:px-12 sm:py-10">
				<h1 class="auth-page__title mb-3 font-black tracking-tight text-balance sm:mb-4">
					{title}
				</h1>
				{#if description}
					<p class="text-base leading-relaxed text-muted-foreground sm:text-lg">
						{description}
					</p>
				{/if}
			</div>

			<div class="px-9 py-10 sm:px-12 sm:py-12">
				{@render children()}
			</div>
		</div>

		{#if footer}
			<div class="mt-10 text-center">
				{@render footer()}
			</div>
		{/if}
	</div>
</section>

<style>
	@keyframes auth-blob-float-a {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(12px, -10px);
		}
	}

	@keyframes auth-blob-float-b {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(-10px, 12px);
		}
	}

	.auth-page__grid {
		background-image: radial-gradient(circle, oklch(1 0 0 / 14%) 1px, transparent 1px);
		background-size: 24px 24px;
	}

	.auth-page__title {
		font-family: 'Bricolage Grotesque', sans-serif;
		font-size: clamp(1.85rem, 5vw, 2.5rem);
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	:global(.mkt-blob-float-a) {
		animation: auth-blob-float-a 14s ease-in-out infinite;
	}

	:global(.mkt-blob-float-b) {
		animation: auth-blob-float-b 18s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.mkt-blob-float-a),
		:global(.mkt-blob-float-b) {
			animation: none;
		}
	}
</style>
