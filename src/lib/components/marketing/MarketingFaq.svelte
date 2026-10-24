<script lang="ts">
	import { onMount } from 'svelte';
	import { Minus, Plus } from '@lucide/svelte';

	type Props = {
		faqs: readonly { id: string; q: string; a: string }[];
		/** Groups the `<details>` for the no-JS and reduced-motion fallback.
		 *  Unique per page. */
		name: string;
		title?: string;
	};

	let { faqs, name, title = 'Frequently Asked Questions' }: Props = $props();

	let listEl = $state<HTMLElement | null>(null);

	// <details> gives no transition of its own: the browser shows and hides the
	// content instantly. This animates the panel height in both directions and
	// takes over the exclusive-open behaviour, so closing the previous question
	// animates too instead of snapping shut.
	onMount(() => {
		const root = listEl;
		if (!root) return;

		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
		const items = Array.from(root.querySelectorAll<HTMLDetailsElement>('.faq__item'));
		const running = new WeakMap<HTMLDetailsElement, Animation>();
		const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

		// The native name grouping force-closes the previous panel the instant the
		// next one opens, which would cut the collapse animation short. While we are
		// animating, this controller owns exclusivity; the attribute is only there as
		// the no-JS and reduced-motion fallback.
		function syncNativeGrouping() {
			for (const item of items) {
				if (reduce.matches) item.setAttribute('name', name);
				else item.removeAttribute('name');
			}
		}

		function stop(item: HTMLDetailsElement) {
			const current = running.get(item);
			if (!current) return;
			current.cancel();
			running.delete(item);
		}

		function collapse(item: HTMLDetailsElement) {
			const panel = item.querySelector<HTMLElement>('.faq__panel');
			if (!panel) return;
			stop(item);

			const from = panel.getBoundingClientRect().height;
			const anim = panel.animate(
				[
					{ height: `${from}px`, opacity: 1 },
					{ height: '0px', opacity: 0 }
				],
				{ duration: 200, easing: ease }
			);

			running.set(item, anim);

			// The finish event is the normal path; the timer is insurance, since a
			// missed event would otherwise leave the panel open with nothing to close
			// it. Whichever runs first wins, and the guard makes the loser a no-op.
			const settle = () => {
				if (running.get(item) !== anim) return;
				item.open = false;
				running.delete(item);
			};

			anim.addEventListener('finish', settle);
			window.setTimeout(settle, 260);
		}

		function expand(item: HTMLDetailsElement) {
			const panel = item.querySelector<HTMLElement>('.faq__panel');
			if (!panel) return;
			stop(item);

			item.open = true;
			const anim = panel.animate(
				[
					{ height: '0px', opacity: 0 },
					{ height: `${panel.scrollHeight}px`, opacity: 1 }
				],
				{ duration: 260, easing: ease }
			);

			running.set(item, anim);

			const release = () => {
				if (running.get(item) === anim) running.delete(item);
			};

			anim.addEventListener('finish', release);
			window.setTimeout(release, 320);
		}

		function onToggle(event: Event) {
			// Without motion, the browser's own exclusive accordion is correct.
			if (reduce.matches) return;

			const target = event.currentTarget as HTMLElement;
			const item = target.closest<HTMLDetailsElement>('.faq__item');
			if (!item) return;

			event.preventDefault();

			if (item.open) {
				collapse(item);
				return;
			}

			for (const other of items) {
				if (other !== item && other.open) collapse(other);
			}

			expand(item);
		}

		const summaries = items
			.map((item) => item.querySelector<HTMLElement>('summary'))
			.filter((el): el is HTMLElement => el !== null);

		syncNativeGrouping();
		reduce.addEventListener('change', syncNativeGrouping);
		summaries.forEach((el) => el.addEventListener('click', onToggle));

		return () => {
			reduce.removeEventListener('change', syncNativeGrouping);
			summaries.forEach((el) => el.removeEventListener('click', onToggle));
			items.forEach(stop);
		};
	});
</script>

<section class="faq">
	<div class="wrap faq__layout">
		<h2 class="marketing-display faq__title" data-gsap-copy>{title}</h2>

		<div class="faq__list" data-gsap-copy bind:this={listEl}>
			{#each faqs as faq (faq.id)}
				<details class="faq__item" {name}>
					<summary class="faq__q">
						<span class="faq__q-text">{faq.q}</span>
						<span class="faq__icon" aria-hidden="true">
							<Plus class="faq__icon-plus" size={16} />
							<Minus class="faq__icon-minus" size={16} />
						</span>
					</summary>
					<div class="faq__panel">
						<p class="faq__a">{faq.a}</p>
					</div>
				</details>
			{/each}
		</div>
	</div>
</section>

<style>
	/* Editorial layout: a large left-aligned heading over full-width rows split
	   by hairlines, with no card around the list. */
	.faq {
		border-top: 1px solid var(--m-border-soft);
		padding-block: clamp(4rem, 7vw, 6.5rem);
		background: var(--m-bg);
	}

	.wrap {
		max-width: 78rem;
		margin-inline: auto;
		padding-inline: clamp(1.25rem, 4.2vw, 4rem);
	}

	.faq__layout {
		display: grid;
		gap: clamp(2rem, 4vw, 3.5rem);
	}

	.faq__title {
		margin: 0;
		font-size: clamp(2.4rem, 5vw, 4rem);
		text-wrap: balance;
	}

	.faq__list {
		min-width: 0;
		border-top: 1px solid var(--m-border-strong);
	}

	.faq__item {
		border-bottom: 1px solid var(--m-border-strong);
	}

	.faq__q {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 1.5rem;
		min-height: 4.75rem;
		padding-block: 1.1rem;
		cursor: pointer;
		list-style: none;
		font-size: clamp(1.08rem, 1.6vw, 1.32rem);
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.35;
		color: var(--m-text-1);
	}

	.faq__q::-webkit-details-marker {
		display: none;
	}

	.faq__q:focus-visible {
		outline: 2px solid var(--m-accent-text);
		outline-offset: 4px;
		border-radius: 0.25rem;
	}

	.faq__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid var(--m-border-strong);
		border-radius: 999px;
		color: var(--m-text-1);
		transition:
			background 200ms ease,
			border-color 200ms ease,
			color 200ms ease;
	}

	.faq__q:hover .faq__icon {
		border-color: var(--m-accent-border);
	}

	.faq__item[open] .faq__icon {
		background: var(--m-accent);
		border-color: transparent;
		color: #fff;
	}

	.faq__icon :global(.faq__icon-minus),
	.faq__item[open] .faq__icon :global(.faq__icon-plus) {
		display: none;
	}

	.faq__item[open] .faq__icon :global(.faq__icon-minus) {
		display: block;
	}

	.faq__panel {
		overflow: hidden;
	}

	/* Right padding keeps the answer clear of the icon column. */
	.faq__a {
		margin: 0;
		padding: 0 4.25rem 1.75rem 0;
		max-width: 68ch;
		color: var(--m-text-2);
		font-size: 1rem;
		line-height: 1.75;
	}

	@media (max-width: 40rem) {
		.faq__a {
			padding-right: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.faq__icon {
			transition: none;
		}
	}
</style>
