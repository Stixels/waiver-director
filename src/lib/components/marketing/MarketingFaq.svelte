<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';

	type Props = {
		faqs: readonly { id: string; q: string; a: string }[];
		/** Groups the `<details>` for the no-JS and reduced-motion fallback.
		 *  Unique per page. */
		name: string;
		title?: string;
	};

	let { faqs, name, title = 'Frequently asked questions' }: Props = $props();

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

<section class="faq" style="border-color: var(--m-border-soft);">
	<div class="wrap faq__layout">
		<div class="faq__intro" data-gsap-copy>
			<h2 class="marketing-display faq__title">{title}</h2>
		</div>

		<div class="faq__list" data-gsap-copy bind:this={listEl}>
			{#each faqs as faq (faq.id)}
				<details class="faq__item" {name}>
					<summary class="faq__q">
						{faq.q}
						<span class="faq__chev" aria-hidden="true"><ChevronDown size={18} /></span>
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
	/* The section carried no atmosphere of its own while both neighbours have
	   one; this is the same glow recipe the signing line uses, centred to sit
	   behind the heading. */
	.faq {
		border-top: 1px solid var(--m-border-soft);
		padding-block: clamp(4rem, 7vw, 6.5rem);
		background:
			radial-gradient(circle at 50% 8%, oklch(0.42 0.18 277 / 9%), transparent 34rem), var(--m-bg);
	}

	.wrap {
		max-width: 78rem;
		margin-inline: auto;
		padding-inline: clamp(1.25rem, 4.2vw, 4rem);
	}

	/* One centred column: the heading sits above the questions rather than
	   beside them. */
	.faq__layout {
		display: grid;
		gap: clamp(2.25rem, 4vw, 3.25rem);
		align-items: start;
	}

	.faq__intro {
		text-align: center;
	}

	.faq__title {
		font-size: clamp(2rem, 3.2vw, 2.9rem);
		text-wrap: balance;
	}

	/* The rows stay left-aligned inside the centred column — a summary with a
	   chevron on the end, and an answer to read, both need a left edge. */
	.faq__list {
		position: relative;
		width: 100%;
		max-width: 46rem;
		margin-inline: auto;
		min-width: 0;
		border: 1px solid var(--m-border-soft);
		border-radius: 1rem;
		background: var(--m-card);
		overflow: hidden;
	}

	/* The divider motif the CTA, footer, and pricing table all carry. */
	.faq__list::before {
		content: '';
		position: absolute;
		inset: 0 0 auto 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--m-accent-line), transparent);
		pointer-events: none;
		z-index: 1;
	}

	.faq__item {
		border-bottom: 1px solid var(--m-border-soft);
		transition: background 220ms ease;
	}

	.faq__item:last-child {
		border-bottom: 0;
	}

	.faq__item[open] {
		background: var(--m-accent-soft);
	}

	.faq__q {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 1.2rem clamp(1.1rem, 2.5vw, 1.6rem);
		cursor: pointer;
		list-style: none;
		font-size: 1.06rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--m-text-1);
		transition: color 160ms ease;
	}

	.faq__q::-webkit-details-marker {
		display: none;
	}

	.faq__q:hover {
		color: var(--m-accent-text);
	}

	.faq__chev {
		display: inline-flex;
		flex: 0 0 auto;
		color: var(--m-text-3);
		transition:
			transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
			color 160ms ease;
	}

	.faq__item[open] .faq__chev {
		transform: rotate(180deg);
		color: var(--m-accent-text);
	}

	.faq__panel {
		overflow: hidden;
	}

	.faq__a {
		margin: 0;
		padding: 0 clamp(1.1rem, 2.5vw, 1.6rem) 1.4rem;
		max-width: 62ch;
		color: var(--m-text-2);
		font-size: 0.95rem;
		line-height: 1.75;
	}

	@media (prefers-reduced-motion: reduce) {
		.faq__q,
		.faq__chev,
		.faq__item {
			transition: none;
		}
	}
</style>
