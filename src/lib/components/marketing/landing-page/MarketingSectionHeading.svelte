<script lang="ts">
	type Props = {
		eyebrow: string;
		title: string;
		description?: string;
		align?: 'left' | 'center';
		class?: string;
	};

	let { eyebrow, title, description, align = 'left', class: className = '' }: Props = $props();
</script>

<header
	class={[
		'landing-section-heading',
		align === 'center' && 'landing-section-heading--center',
		className
	]}
>
	<p class="landing-section-heading__eyebrow">{eyebrow}</p>
	<h2 class="landing-section-heading__title">{title}</h2>
	{#if description}
		<p class="landing-section-heading__description">
			{description}
		</p>
	{/if}
</header>

<style>
	.landing-section-heading {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.landing-section-heading--center {
		text-align: center;
	}

	.landing-section-heading__eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--primary);
	}

	.landing-section-heading__title {
		font-family: var(--m-font-display);
		font-size: clamp(28px, 4vw, 44px);
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.05;
		text-wrap: balance;
	}

	.landing-section-heading__description {
		max-width: 42rem;
		font-size: 15px;
		line-height: 1.7;
		color: var(--muted-foreground);
		text-wrap: pretty;
	}

	.landing-section-heading--center .landing-section-heading__description {
		margin-inline: auto;
	}
</style>
