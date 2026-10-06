<script lang="ts">
	import { onMount } from 'svelte';

	const fields = [
		{ label: 'Full name', type: 'text', live: false },
		{ label: 'Date of birth', type: 'date', live: false },
		{ label: 'Signing for a minor', type: 'checkbox', live: true }
	] as const;

	// A signature is the one gesture this whole product exists to capture, so it is
	// the page's single authored motion moment: it draws itself once, on arrival.
	let signatureEl = $state<SVGPathElement | null>(null);
	let wrapEl = $state<HTMLElement | null>(null);
	let drawn = $state(false);

	onMount(() => {
		const path = signatureEl;
		const wrap = wrapEl;
		if (!path || !wrap) return;

		const length = Math.ceil(path.getTotalLength());
		wrap.style.setProperty('--signature-length', String(length));

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			drawn = true;
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					drawn = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '-15% 0px -15% 0px' }
		);

		observer.observe(wrap);

		return () => observer.disconnect();
	});
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Participation Waiver</span>
		<span class="mkt-pill mkt-pill--accent">Draft</span>
	</div>

	<div class="mkt-vig__body">
		<p class="builder__doc">
			I understand that kayaking involves inherent risks, including capsizing and cold water.
			<b>I accept these risks on my own behalf</b> and release Apex Adventures from liability arising
			from ordinary negligence.
		</p>

		<div class="builder__fields">
			{#each fields as field (field.label)}
				<span class="mkt-field" class:mkt-field--live={field.live}>
					<span class="mkt-field__label">{field.label}</span>
					<span class="mkt-field__type">{field.type}</span>
				</span>
			{/each}
		</div>

		<div class="builder__sign" class:is-drawn={drawn} bind:this={wrapEl}>
			<span class="builder__sign-cap">Signature</span>
			<svg viewBox="0 0 260 44" role="img" aria-label="A handwritten signature">
				<path
					bind:this={signatureEl}
					d="M6 36C14 14 21 9 25 20c4 11 1 21-4 19-5-2 2-17 15-19 13-2 20 6 16 12-4 6-11 3-5-6 6-9 19-12 28-6 9 6 5 15-1 13-6-2 2-14 17-12 15 2 21 9 30 7 9-2 14-9 20-16 6-7 12-10 20-8 8 2 12 8 22 9 10 1 18-3 27-9"
				/>
			</svg>
			<div class="builder__sign-rule" aria-hidden="true"></div>
		</div>

		<div class="builder__foot">
			<span class="builder__ver">
				Publishing creates <b>v3</b> · v2 stays on 41 signed records
			</span>
		</div>
	</div>
</div>

<style>
	.builder__doc {
		font-size: 0.8rem;
		line-height: 1.62;
		color: var(--m-text-3);
	}

	.builder__doc b {
		color: var(--m-text-2);
		font-weight: 600;
	}

	.builder__fields {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}

	.builder__sign {
		margin-top: 0.75rem;
		padding: 0.7rem 0.85rem 0.55rem;
		border-radius: 10px;
		border: 1px dashed var(--m-border-strong);
		background: oklch(1 0 0 / 2%);
	}

	.builder__sign-cap {
		font-size: 0.66rem;
		font-weight: 650;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--m-text-3);
	}

	.builder__sign svg {
		display: block;
		width: 100%;
		height: 2.9rem;
		margin-top: 0.2rem;
		overflow: visible;
	}

	.builder__sign path {
		fill: none;
		stroke: var(--m-text-1);
		stroke-width: 2.1;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: var(--signature-length, 420);
		stroke-dashoffset: var(--signature-length, 420);
	}

	.builder__sign.is-drawn path {
		animation: builder-sign-draw 1.5s cubic-bezier(0.5, 0.05, 0.2, 1) forwards;
	}

	@keyframes builder-sign-draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	.builder__sign-rule {
		height: 1px;
		background: var(--m-border-strong);
		margin-top: 0.15rem;
	}

	.builder__foot {
		margin-top: 1rem;
		padding-top: 0.85rem;
		border-top: 1px solid var(--m-border-soft);
	}

	.builder__ver {
		font-size: 0.72rem;
		color: var(--m-text-3);
	}

	.builder__ver b {
		color: var(--m-text-2);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		.builder__sign path {
			stroke-dashoffset: 0;
		}

		.builder__sign.is-drawn path {
			animation: none;
		}
	}
</style>
