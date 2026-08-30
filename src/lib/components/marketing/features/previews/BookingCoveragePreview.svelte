<script lang="ts">
	import { QrCode } from '@lucide/svelte';

	// The bookings day view: the schedule, who booked it, and how much of each
	// party has signed. Fictional Apex Adventures data, as everywhere else on the
	// marketing surface.
	const bookings = [
		{
			time: '11:15 AM',
			within: 'Now',
			activity: 'Old Town Escape Room',
			customer: 'Cameron Nguyen',
			signed: 6,
			expected: 6
		},
		{
			time: '11:50 AM',
			within: 'Now',
			activity: 'Wilderness Zipline Tour',
			customer: 'Dakota Nguyen',
			signed: 7,
			expected: 9
		},
		{
			time: '12:25 PM',
			within: 'In 28m',
			activity: 'Harbor Kayak Adventure',
			customer: 'Reese Nguyen',
			signed: 6,
			expected: 9
		},
		{
			time: '1:00 PM',
			within: null,
			activity: 'Urban Axe Throwing',
			customer: 'Skyler Nguyen',
			signed: 5,
			expected: 5
		},
		{
			time: '1:35 PM',
			within: null,
			activity: 'Sunset Ropes Course',
			customer: 'Rowan Nguyen',
			signed: 6,
			expected: 8
		}
	] as const;
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Saturday, Aug 29</span>
		<span class="mkt-pill mkt-pill--mute">7 bookings</span>
	</div>

	<div class="mkt-vig__body">
		<ul class="bk">
			{#each bookings as booking (booking.activity)}
				{@const covered = booking.signed >= booking.expected}
				<li class:is-soon={booking.within !== null}>
					<span class="bk__time">
						{booking.time}
						{#if booking.within}<em class="bk__within">{booking.within}</em>{/if}
					</span>
					<span class="bk__activity">{booking.activity}</span>
					<span class="bk__customer">{booking.customer}</span>
					<span class="bk__count" class:is-covered={covered}>
						{booking.signed}<i>/ {booking.expected}</i>
					</span>
					<span class="bk__state">
						{#if covered}
							<span class="mkt-pill mkt-pill--green"><i></i>Signed</span>
						{:else}
							<span class="bk__share">
								<QrCode size={13} aria-hidden="true" />
								Share
							</span>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	</div>
</div>

<style>
	.bk li {
		display: grid;
		grid-template-columns: 5.75rem minmax(0, 1.25fr) minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.4rem 0.9rem;
		padding: 0.62rem 0.2rem;
		border-bottom: 1px solid var(--m-border-soft);
	}

	.bk li:last-child {
		border-bottom: none;
	}

	/* The next parties up carry the accent edge, the same marker the app uses to
	   pull a supervisor's eye to what is about to walk in. */
	.bk li.is-soon {
		box-shadow: inset 2px 0 0 -1px var(--m-accent-line);
		padding-left: 0.55rem;
	}

	.bk__time {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		align-items: flex-start;
		font-size: 0.76rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--m-text-1);
		font-variant-numeric: tabular-nums;
	}

	.bk__within {
		font-style: normal;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 0.1rem 0.34rem;
		border-radius: 5px;
		color: var(--m-amber);
		background: var(--m-amber-dim);
		border: 1px solid var(--m-amber-border);
	}

	.bk__activity {
		font-size: 0.8rem;
		font-weight: 550;
		letter-spacing: -0.015em;
		color: var(--m-text-1);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bk__customer {
		font-size: 0.76rem;
		color: var(--m-text-3);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bk__count {
		font-size: 0.8rem;
		font-weight: 650;
		color: var(--m-amber);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.bk__count.is-covered {
		color: var(--m-green);
	}

	.bk__count i {
		font-style: normal;
		font-weight: 500;
		color: var(--m-text-3);
	}

	.bk__state {
		justify-self: end;
	}

	.bk__share {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 1.6rem;
		padding: 0 0.55rem;
		border-radius: 7px;
		border: 1px solid var(--m-border-strong);
		background: var(--m-surface);
		font-size: 0.7rem;
		font-weight: 550;
		color: var(--m-text-2);
		white-space: nowrap;
	}

	/* Below the two-column breakpoint the row folds into three lines rather than
	   shrinking five columns into illegibility. */
	@media (max-width: 34rem) {
		.bk li {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.3rem 0.75rem;
		}

		.bk__time {
			flex-direction: row;
			align-items: center;
			gap: 0.45rem;
		}

		.bk__activity {
			grid-column: 1;
			grid-row: 2;
		}

		.bk__customer {
			grid-column: 1;
			grid-row: 3;
		}

		.bk__count {
			grid-column: 2;
			grid-row: 1;
			justify-self: end;
		}

		.bk__state {
			grid-column: 2;
			grid-row: 2 / span 2;
			align-self: center;
		}
	}
</style>
