<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, Check } from '@lucide/svelte';

	import { Button } from '$lib/components/ui/button';

	const freeItems = [
		'Add your waiver text and questions',
		'Set up signatures, minors, and consent',
		'Add your logo and brand colors',
		'Preview and edit before publishing'
	] as const;

	const proGroups = [
		{
			label: 'Publish & collect',
			items: [
				'Publish your waiver',
				'Share it by link, QR code, or embed',
				'Save every signed waiver'
			]
		},
		{
			label: 'Bookings & follow-up',
			items: [
				'See which guests have signed',
				'Send or schedule follow-up emails',
				'View reports and sync with various tools (Bookeo, Mailchimp, etc.)'
			]
		}
	] as const;
</script>

<section class="buyer-guide border-b" style="border-color: var(--m-border-soft);">
	<div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
		<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
			<div class="max-w-3xl" data-gsap-copy>
				<p class="marketing-kicker">Plans at a glance</p>
				<h2 class="marketing-display mt-6 text-[clamp(2.6rem,5vw,4.8rem)]">
					Start with the waiver. Add operations when you are ready.
				</h2>
				<p class="mt-6 max-w-2xl text-base leading-7" style="color: var(--m-text-2);">
					Build and preview the complete signing experience for free. Upgrade when it is time to
					publish, collect signatures, and run the work around them.
				</p>
			</div>
			<Button
				href={resolve('/pricing')}
				variant="outline"
				class="btn-mkt-outline h-11 w-fit gap-2 rounded-xl px-6 text-sm font-semibold"
			>
				Compare plans <ArrowRight size={15} aria-hidden="true" />
			</Button>
		</div>

		<div class="buyer-guide__grid mt-12 grid grid-flow-dense border lg:grid-cols-12">
			<article class="buyer-guide__tier p-6 sm:p-8 lg:col-span-5" data-gsap-copy>
				<p class="buyer-guide__label">Free workspace</p>
				<h3 class="mt-4 text-2xl font-semibold tracking-[-0.035em]">Build the complete waiver</h3>
				<p class="mt-4 max-w-md text-sm leading-6" style="color: var(--m-text-2);">
					Create and refine the full guest experience before committing to a paid plan.
				</p>

				<ul class="mt-8 space-y-3.5">
					{#each freeItems as item (item)}
						<li class="flex gap-3 text-sm leading-6" style="color: var(--m-text-2);">
							<span class="buyer-guide__check" aria-hidden="true">
								<Check size={12} strokeWidth={2.5} />
							</span>
							{item}
						</li>
					{/each}
				</ul>

				<p class="buyer-guide__footer mt-9 pt-5 text-xs font-medium">
					No deadline to finish your draft.
				</p>
			</article>

			<article
				class="buyer-guide__tier buyer-guide__tier--pro p-6 sm:p-8 lg:col-span-7"
				data-gsap-copy
			>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="buyer-guide__label">Pro operations</p>
					<span class="buyer-guide__includes">Everything in Free, plus</span>
				</div>
				<h3 class="mt-4 text-2xl font-semibold tracking-[-0.035em]">
					Publish and run live operations
				</h3>
				<p class="mt-4 max-w-xl text-sm leading-6" style="color: var(--m-text-2);">
					Turn the waiver into an active workflow for your guests, records, bookings, and team.
				</p>

				<div class="mt-8 grid gap-8 sm:grid-cols-2">
					{#each proGroups as group (group.label)}
						<div>
							<p class="buyer-guide__group-label">{group.label}</p>
							<ul class="mt-4 space-y-3.5">
								{#each group.items as item (item)}
									<li class="flex gap-3 text-sm leading-6" style="color: var(--m-text-2);">
										<span class="buyer-guide__check" aria-hidden="true">
											<Check size={12} strokeWidth={2.5} />
										</span>
										{item}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>

				<p class="buyer-guide__footer mt-9 pt-5 text-xs font-medium">
					Upgrade only when you are ready to publish.
				</p>
			</article>
		</div>

		<a
			href={resolve('/features')}
			class="buyer-guide__roadmap mt-6 inline-flex items-center gap-2 text-sm font-medium"
		>
			See current integrations and planned additions
			<ArrowRight size={14} aria-hidden="true" />
		</a>
	</div>
</section>

<style>
	.buyer-guide__grid {
		gap: 1px;
		border-color: var(--m-border-soft);
		border-radius: 1rem;
		background: var(--m-border-soft);
		overflow: hidden;
	}

	.buyer-guide__tier {
		background: var(--m-card);
	}

	.buyer-guide__tier--pro {
		background:
			radial-gradient(
				circle at 90% 0%,
				color-mix(in srgb, var(--m-accent) 14%, transparent),
				transparent 44%
			),
			var(--m-card);
	}

	.buyer-guide__label,
	.buyer-guide__group-label {
		font-size: 0.68rem;
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.buyer-guide__label {
		color: var(--m-accent-text);
	}

	.buyer-guide__group-label {
		color: var(--m-text-3);
	}

	.buyer-guide__includes {
		border: 1px solid color-mix(in srgb, var(--m-accent) 35%, var(--m-border-soft));
		border-radius: 999px;
		padding: 0.32rem 0.65rem;
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--m-accent-text);
	}

	.buyer-guide__check {
		display: grid;
		width: 1.15rem;
		height: 1.15rem;
		flex: 0 0 auto;
		place-items: center;
		margin-top: 0.18rem;
		border: 1px solid color-mix(in srgb, var(--m-accent) 35%, transparent);
		border-radius: 999px;
		color: var(--m-accent-text);
		background: color-mix(in srgb, var(--m-accent) 9%, transparent);
	}

	.buyer-guide__footer {
		border-top: 1px solid var(--m-border-soft);
		color: var(--m-text-3);
	}

	.buyer-guide__roadmap {
		color: var(--m-text-3);
		transition: color 160ms ease;
	}

	.buyer-guide__roadmap:hover {
		color: var(--m-text);
	}

	@media (prefers-reduced-motion: reduce) {
		.buyer-guide__roadmap {
			transition: none;
		}
	}
</style>
