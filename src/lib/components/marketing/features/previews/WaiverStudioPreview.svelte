<script lang="ts">
	import { CalendarDays, Check, CheckSquare, ChevronsUpDown } from '@lucide/svelte';

	// The builder and the page it produces, side by side: the field rail on the
	// left is what the operator arranges, the panel on the right is what the guest
	// actually reads and signs.
	const fields = [
		{
			icon: CheckSquare,
			label: 'I agree to the activity guidelines',
			type: 'checkbox',
			required: true
		},
		{ icon: CalendarDays, label: 'Date of visit', type: 'date', required: true },
		{
			icon: ChevronsUpDown,
			label: 'Where did you hear from us?',
			type: 'dropdown',
			required: false
		}
	] as const;
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Apex Adventures Participation Waiver</span>
		<span class="mkt-pill mkt-pill--green"><i></i>Live</span>
	</div>

	<div class="mkt-vig__body studio">
		<div class="studio__rail">
			<p class="studio__railhead">Custom fields</p>
			{#each fields as field (field.label)}
				{@const Icon = field.icon}
				<span class="studio__field">
					<span class="studio__fieldic"><Icon size={13} aria-hidden="true" /></span>
					<span class="studio__fieldtext">
						<span class="studio__fieldlabel">{field.label}</span>
						<span class="studio__fieldtype">{field.type}</span>
					</span>
					{#if field.required}
						<span class="studio__req">Required</span>
					{/if}
				</span>
			{/each}
		</div>

		<div class="studio__page">
			<p class="studio__doctitle">
				Please review this participation agreement before your activity.
			</p>
			<p class="studio__docbody">
				By signing, you confirm that the information you provide is accurate and that you understand
				the activity guidelines.
			</p>
			<div class="studio__inputs">
				<span class="studio__input"><em>Full name</em></span>
				<span class="studio__input"><em>Email</em></span>
				<span class="studio__input studio__input--half"><em>Date of birth</em></span>
			</div>

			<span class="studio__check">
				<i aria-hidden="true"><Check size={11} strokeWidth={3} /></i>
				I agree to the activity guidelines
			</span>
		</div>
	</div>
</div>

<style>
	.studio {
		display: grid;
		gap: 1rem;
	}

	@media (min-width: 34rem) {
		.studio {
			grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
			gap: 1.15rem;
			align-items: start;
		}
	}

	.studio__rail {
		display: grid;
		gap: 0.45rem;
		align-content: start;
		min-width: 0;
	}

	.studio__railhead {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--m-text-3);
		margin-bottom: 0.15rem;
	}

	.studio__field {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.6rem;
		border-radius: 9px;
		border: 1px solid var(--m-border-soft);
		background: oklch(1 0 0 / 3%);
	}

	.studio__fieldic {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 6px;
		color: var(--m-text-3);
		background: oklch(1 0 0 / 5%);
		border: 1px solid var(--m-border-soft);
	}

	.studio__fieldtext {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.studio__fieldlabel {
		font-size: 0.75rem;
		font-weight: 550;
		letter-spacing: -0.015em;
		color: var(--m-text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.studio__fieldtype {
		font-family: var(--m-font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.03em;
		color: var(--m-text-3);
	}

	.studio__req {
		font-size: 0.6rem;
		font-weight: 650;
		letter-spacing: 0.02em;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		color: var(--m-accent-text);
		background: var(--m-accent-dim);
		border: 1px solid var(--m-accent-border-soft);
		white-space: nowrap;
	}

	/* The signing page reads as paper against the workspace chrome, which is how
	   it looks to the guest on their own phone. */
	.studio__page {
		border-radius: 11px;
		border: 1px solid var(--m-border-soft);
		background: var(--m-surface);
		padding: 0.95rem 1rem 1.1rem;
		min-width: 0;
	}

	.studio__doctitle {
		font-size: 0.92rem;
		font-weight: 650;
		line-height: 1.3;
		letter-spacing: -0.025em;
		color: var(--m-text-1);
		text-wrap: balance;
	}

	.studio__docbody {
		margin-top: 0.5rem;
		font-size: 0.74rem;
		line-height: 1.6;
		color: var(--m-text-3);
	}

	.studio__inputs {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.studio__input {
		display: block;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--m-border-strong);
	}

	.studio__input--half {
		max-width: 60%;
	}

	.studio__input em {
		font-style: normal;
		font-size: 0.63rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--m-text-3);
	}

	/* Shown ticked: the required consent is the gesture that turns a form into a
	   signed record, so the preview carries it in its answered state. */
	.studio__check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		font-size: 0.74rem;
		font-weight: 500;
		letter-spacing: -0.01em;
		color: var(--m-text-2);
	}

	.studio__check i {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: 1.05rem;
		height: 1.05rem;
		border-radius: 5px;
		color: oklch(0.99 0 0);
		background: var(--m-accent);
		border: 1px solid var(--m-accent-border);
		box-shadow: 0 0 12px var(--m-accent-glow);
	}
</style>
