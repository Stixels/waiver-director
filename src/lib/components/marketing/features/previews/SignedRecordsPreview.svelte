<script lang="ts">
	// The submissions table: who signed, what they signed for, and when it landed.
	// Minors ride on the signer's own record, which is why they appear as a chip
	// on the name rather than as rows of their own.
	const records = [
		{
			name: 'Dakota Martinez',
			email: 'dakota.martinez@example.com',
			minors: 1,
			activity: 'Wilderness Zipline Tour',
			born: 'Sep 24, 2002',
			at: '11:24 AM'
		},
		{
			name: 'Taylor Martinez',
			email: 'taylor.martinez@example.com',
			minors: 0,
			activity: 'Old Town Escape Room',
			born: 'Aug 23, 2001',
			at: '10:54 AM'
		},
		{
			name: 'Quinn Nguyen',
			email: 'quinn.nguyen30@example.com',
			minors: 0,
			activity: 'Mountain Bike Experience',
			born: 'Jul 22, 2000',
			at: '10:25 AM'
		},
		{
			name: 'Skyler Lee',
			email: 'skyler.lee@example.com',
			minors: 2,
			activity: 'River Rafting Expedition',
			born: 'Dec 15, 1993',
			at: '9:55 AM'
		},
		{
			name: 'Hayden Allen',
			email: 'hayden.allen1@example.com',
			minors: 0,
			activity: 'Sunset Ropes Course',
			born: 'May 20, 1998',
			at: '9:25 AM'
		}
	] as const;
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Signed records</span>
		<span class="mkt-pill mkt-pill--mute">Version 4</span>
	</div>

	<div class="mkt-vig__body">
		<ul class="rec">
			{#each records as record (record.email + record.activity)}
				<li>
					<span class="rec__who">
						<span class="rec__name">
							{record.name}
							{#if record.minors > 0}
								<em class="rec__minors">+{record.minors} minor{record.minors > 1 ? 's' : ''}</em>
							{/if}
						</span>
						<span class="rec__email">{record.email}</span>
					</span>
					<span class="rec__visit">
						<span class="rec__activity">{record.activity}</span>
						<span class="rec__born">Born {record.born}</span>
					</span>
					<span class="rec__at">{record.at}</span>
				</li>
			{/each}
		</ul>
	</div>
</div>

<style>
	.rec li {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.25rem 1rem;
		padding: 0.62rem 0.2rem;
		border-bottom: 1px solid var(--m-border-soft);
	}

	.rec li:last-child {
		border-bottom: none;
	}

	.rec__who,
	.rec__visit {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.rec__name {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--m-text-1);
		min-width: 0;
	}

	.rec__minors {
		font-style: normal;
		flex: 0 0 auto;
		font-size: 0.62rem;
		font-weight: 650;
		padding: 0.08rem 0.36rem;
		border-radius: 999px;
		color: var(--m-accent-text);
		background: var(--m-accent-dim);
		border: 1px solid var(--m-accent-border-soft);
	}

	.rec__email,
	.rec__born {
		font-size: 0.7rem;
		color: var(--m-text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rec__activity {
		font-size: 0.76rem;
		color: var(--m-text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rec__at {
		font-size: 0.72rem;
		color: var(--m-text-3);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		justify-self: end;
	}

	/* Named areas rather than row/column hints: an explicit row with no column
	   lets auto-placement claim the first track, which put the timestamp left of
	   the name. The signer and the time share a baseline, the visit runs full
	   width beneath them. */
	@media (max-width: 34rem) {
		.rec li {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'who at'
				'visit visit';
			align-items: baseline;
			row-gap: 0.45rem;
		}

		.rec__who {
			grid-area: who;
		}

		.rec__at {
			grid-area: at;
		}

		.rec__visit {
			grid-area: visit;
		}
	}
</style>
