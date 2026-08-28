<script lang="ts">
	import { Copy, QrCode } from '@lucide/svelte';

	type Participant = {
		initials: string;
		name: string;
		minors?: string;
		signed: boolean;
	};

	const bookingNumber = 'BK-4471-QT';
	const expected = 8;

	const participants: Participant[] = [
		{ initials: 'AM', name: 'Alex Martinez', signed: true },
		{ initials: 'JC', name: 'Jamie Chen', minors: '+1 minor', signed: true },
		{ initials: 'CP', name: 'Casey Patel', signed: false },
		{ initials: 'JL', name: 'Jordan Lee', signed: false }
	];

	// Six of the eight expected guests have signed; the roster shows the first four.
	const signedCount = 6;
	const meterSlots = Array.from({ length: expected }, (_, index) => index < signedCount);

	let copied = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyBookingNumber() {
		try {
			await navigator.clipboard?.writeText(bookingNumber);
		} catch {
			// Clipboard access can be denied; still confirm the intent visually.
		}

		copied = true;
		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (copied = false), 1600);
	}

	$effect(() => () => clearTimeout(resetTimer));
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<div>
			<div class="coverage__activity">Sunset Kayak Tour</div>
			<div class="coverage__when">Today · 5:30 PM · Marina dock</div>
		</div>
		<div class="coverage__count">
			<div class="coverage__num">{signedCount}<small> / {expected}</small></div>
			<div class="coverage__cap">Signed</div>
		</div>
	</div>

	<div class="mkt-vig__body">
		<div class="mkt-meter" aria-hidden="true">
			{#each meterSlots as isSigned, index (index)}
				<i class:is-warn={!isSigned}></i>
			{/each}
		</div>

		<ul class="mkt-roster coverage__roster">
			{#each participants as participant (participant.name)}
				<li class:is-pending={!participant.signed}>
					<span class="mkt-roster__av">{participant.initials}</span>
					<span class="mkt-roster__name">
						{participant.name}{#if participant.minors}<span class="mkt-roster__minor">
								{participant.minors}</span
							>{/if}
					</span>
					{#if participant.signed}
						<span class="mkt-pill mkt-pill--green"><i></i>Signed</span>
					{:else}
						<span class="mkt-pill mkt-pill--amber"><i></i>Not signed</span>
					{/if}
				</li>
			{/each}
		</ul>

		<div class="mkt-covrow">
			<span class="mkt-idchip">
				{bookingNumber}
				<button
					type="button"
					class="mkt-idchip__btn"
					class:is-done={copied}
					onclick={copyBookingNumber}
					aria-label="Copy booking number {bookingNumber}"
				>
					<Copy size={13} aria-hidden="true" />
				</button>
			</span>

			<span
				class="btn-mkt-outline inline-flex h-9 items-center gap-2 rounded-[9px] px-3.5 text-[0.82rem] font-medium"
			>
				<QrCode size={15} aria-hidden="true" />
				Booking QR
			</span>

			<span class="mkt-idchip__flash" role="status" aria-live="polite">
				{copied ? 'Copied' : ''}
			</span>
		</div>
	</div>
</div>

<style>
	.coverage__activity {
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.coverage__when {
		font-size: 0.72rem;
		color: var(--m-text-3);
		margin-top: 0.2rem;
		font-variant-numeric: tabular-nums;
	}

	.coverage__count {
		text-align: right;
		flex: 0 0 auto;
	}

	.coverage__num {
		font-family: var(--m-font-display);
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.04em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.coverage__num small {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--m-text-3);
	}

	.coverage__cap {
		font-size: 0.66rem;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--m-text-3);
		margin-top: 0.35rem;
	}

	.coverage__roster {
		margin-top: 0.8rem;
	}
</style>
