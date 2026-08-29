<script lang="ts">
	import { ShieldCheck } from '@lucide/svelte';

	// The follow-up queue as staff read it: one row per message, carrying the
	// booking it belongs to, when it is due, and where delivery actually stands.
	const queue = [
		{
			name: 'Logan Martinez',
			booking: '#DEMO-20260823-02',
			when: 'Sent Aug 23, 5:45 PM',
			state: 'Sent',
			tone: 'green'
		},
		{
			name: 'Jordan Martinez',
			booking: '#DEMO-20260823-05',
			when: 'Failed Aug 23, 6:00 PM',
			state: 'Failed',
			tone: 'red'
		},
		{
			name: 'Jordan Lee',
			booking: '#DEMO-20260823-03',
			when: 'Held · no marketing consent',
			state: 'Blocked',
			tone: 'amber'
		},
		{
			name: 'Casey Chen',
			booking: '#DEMO-20260823-03',
			when: 'Not scheduled yet',
			state: 'Unscheduled',
			tone: 'mute'
		},
		{
			name: 'Reese Martinez',
			booking: '#DEMO-20260823-01',
			when: 'Queued for Aug 30, 9:00 AM',
			state: 'Queued',
			tone: 'accent'
		}
	] as const;
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Follow-up queue</span>
		<span class="q__from">
			<ShieldCheck size={13} aria-hidden="true" />
			Apex Adventures
		</span>
	</div>

	<div class="mkt-vig__body">
		<ul class="q">
			{#each queue as row (row.name + row.booking)}
				<li>
					<span class="q__who">
						<span class="q__name">{row.name}</span>
						<span class="q__booking">{row.booking}</span>
					</span>
					<span class="q__when">{row.when}</span>
					<span class="mkt-pill mkt-pill--{row.tone} q__state" data-tone={row.tone}>
						{#if row.tone !== 'mute'}<i></i>{/if}{row.state}
					</span>
				</li>
			{/each}
		</ul>
	</div>
</div>

<style>
	.q__from {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		flex: 0 0 auto;
		font-size: 0.68rem;
		font-weight: 550;
		color: var(--m-text-3);
	}

	.q li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.3rem 0.9rem;
		padding: 0.62rem 0.2rem;
		border-bottom: 1px solid var(--m-border-soft);
	}

	.q li:last-child {
		border-bottom: none;
	}

	.q__who {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.q__name {
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--m-text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.q__booking {
		font-family: var(--m-font-mono);
		font-size: 0.66rem;
		color: var(--m-text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.q__when {
		font-size: 0.72rem;
		color: var(--m-text-3);
		font-variant-numeric: tabular-nums;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.q__state {
		justify-self: end;
	}

	/* A failed send is the one state that has to survive a glance, so it carries
	   its own tone rather than borrowing the amber that already means "held".
	   There is no red pill in the shared set, and a preview is the wrong place to
	   add one, so it stays scoped here. */
	.q__state[data-tone='red'] {
		color: oklch(0.7 0.19 22);
		background: oklch(0.7 0.19 22 / 12%);
		border-color: oklch(0.7 0.19 22 / 24%);
	}

	/* Named areas rather than row/column hints: an explicit row with no column
	   lets auto-placement claim the first track, which put the status pill left of
	   the customer. The name and its state share the top line, the schedule runs
	   full width beneath them. */
	@media (max-width: 34rem) {
		.q li {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'who state'
				'when when';
			align-items: baseline;
			row-gap: 0.45rem;
		}

		.q__who {
			grid-area: who;
		}

		.q__state {
			grid-area: state;
		}

		.q__when {
			grid-area: when;
		}
	}
</style>
