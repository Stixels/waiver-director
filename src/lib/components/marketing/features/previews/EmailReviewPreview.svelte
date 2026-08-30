<script lang="ts">
	// The review panel: a score with its verdict, the specific problems found, and
	// the rewrite offered back as a line diff the writer applies or discards.
	// Thresholds match the app's own bands — 82+ reads Strong, 65+ Solid.
	const score = 52;
	const issues = [
		'The subject promises a discount the body never mentions.',
		'Sent 6 days after the visit — review requests land best within 48 hours.'
	] as const;

	const diff = [
		{ kind: 'remove', text: 'Hey! Big news inside — you won’t believe this offer.' },
		{ kind: 'add', text: 'Thanks for paddling with us on Saturday, Dakota.' },
		{ kind: 'add', text: 'If you have 30 seconds, we would love a quick review.' }
	] as const;
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Review proposed changes</span>
		<span class="rev__score">
			<b>{score}</b>
			<span class="rev__scale">
				<em>Needs work</em>
				/ 100
			</span>
		</span>
	</div>

	<div class="mkt-vig__body rev">
		<ul class="rev__issues">
			{#each issues as issue (issue)}
				<li>{issue}</li>
			{/each}
		</ul>

		<div class="rev__diff">
			{#each diff as line (line.text)}
				<span class="rev__line rev__line--{line.kind}">
					<i aria-hidden="true">{line.kind === 'add' ? '+' : '−'}</i>
					{line.text}
				</span>
			{/each}
		</div>

		<p class="rev__counts">1 line removed · 2 added</p>
	</div>
</div>

<style>
	.rev__score {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		flex: 0 0 auto;
		padding: 0.15rem 0.5rem 0.2rem;
		border-radius: 8px;
		color: var(--m-amber);
		background: var(--m-amber-dim);
		border: 1px solid var(--m-amber-border);
	}

	.rev__score b {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}

	.rev__scale {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
		font-size: 0.62rem;
		font-weight: 600;
		color: oklch(0.78 0.18 75 / 78%);
	}

	.rev__scale em {
		font-style: normal;
		letter-spacing: 0.02em;
	}

	.rev {
		display: grid;
		gap: 0.9rem;
	}

	.rev__issues {
		display: grid;
		gap: 0.45rem;
	}

	.rev__issues li {
		position: relative;
		padding-left: 0.9rem;
		font-size: 0.76rem;
		line-height: 1.5;
		color: var(--m-text-2);
	}

	.rev__issues li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.52em;
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: var(--m-amber);
	}

	.rev__diff {
		display: grid;
		gap: 1px;
		border-radius: 9px;
		overflow: hidden;
		border: 1px solid var(--m-border-soft);
		background: var(--m-border-soft);
	}

	.rev__line {
		display: grid;
		grid-template-columns: 1rem minmax(0, 1fr);
		gap: 0.4rem;
		padding: 0.5rem 0.65rem;
		font-family: var(--m-font-mono);
		font-size: 0.68rem;
		line-height: 1.55;
		background: var(--m-surface);
		color: var(--m-text-2);
	}

	.rev__line i {
		font-style: normal;
		font-weight: 700;
		text-align: center;
	}

	.rev__line--remove {
		background: oklch(0.7 0.19 22 / 9%);
		color: oklch(0.78 0.12 22);
		text-decoration: line-through;
		text-decoration-color: oklch(0.7 0.19 22 / 45%);
	}

	.rev__line--add {
		background: var(--m-green-dim);
		color: oklch(0.78 0.14 155);
	}

	.rev__counts {
		font-size: 0.7rem;
		color: var(--m-text-3);
		font-variant-numeric: tabular-nums;
	}
</style>
