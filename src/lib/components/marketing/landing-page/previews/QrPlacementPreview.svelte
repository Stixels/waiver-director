<script lang="ts">
	import QRCode from 'qrcode';
	import { Link2 } from '@lucide/svelte';

	// Mirrors the QrCodeDialog in the app: one waiver QR code, reachable from the
	// waiver page and from any booking. Title and description are the dialog's own
	// copy; the note is what changes when it is opened from a booking.
	const code = {
		title: 'Waiver QR code',
		description: 'Scan to open the live waiver form.',
		where: 'Waiver page, once the waiver is published',
		note: 'Open it from a booking and that booking’s activity, time, and signed count appear on the form.',
		url: 'https://apex.waiver.link/ride'
	} as const;

	let dataUrl = $state<string | null>(null);

	$effect(() => {
		let cancelled = false;

		void QRCode.toDataURL(code.url, {
			margin: 1,
			width: 360,
			color: { dark: '#221d2b', light: '#f7f7f8' }
		})
			.then((next: string) => {
				if (!cancelled) dataUrl = next;
			})
			.catch((error: unknown) => {
				if (!cancelled) dataUrl = null;
				console.error('[marketing/qr-placement] unable to generate QR code', error);
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="mkt-vig qr-card" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">{code.title}</span>
		<span class="mkt-pill mkt-pill--accent">QR</span>
	</div>

	<div class="mkt-vig__body qr-card__body">
		<div class="qr-card__code">
			{#if dataUrl}
				<img src={dataUrl} alt={code.description} />
			{:else}
				<div class="qr-card__fallback" aria-hidden="true"></div>
			{/if}
		</div>

		<div class="qr-card__meta">
			<p class="qr-card__desc">{code.description}</p>
			<p class="qr-card__where">{code.where}</p>
			<span class="mkt-way qr-card__link">
				<Link2 size={15} aria-hidden="true" />
				<span>Copy link</span>
			</span>
		</div>
	</div>

	<p class="qr-card__note">{code.note}</p>
</div>

<style>
	.qr-card__body {
		display: grid;
		grid-template-columns: minmax(0, 9.25rem) minmax(0, 1fr);
		gap: 1.35rem;
		align-items: center;
		padding-block: 0.35rem;
	}

	@media (max-width: 480px) {
		.qr-card__body {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.qr-card__code {
		border-radius: 9px;
		background: oklch(0.97 0 0);
		padding: 6%;
		box-shadow: 0 12px 28px oklch(0 0 0 / 45%);
	}

	.qr-card__code img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 3px;
	}

	.qr-card__fallback {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 3px;
		background: oklch(0.9 0 0);
	}

	.qr-card__meta {
		display: grid;
		gap: 0.65rem;
		min-width: 0;
	}

	.qr-card__desc {
		font-size: 0.92rem;
		line-height: 1.5;
		letter-spacing: -0.015em;
		color: var(--m-text-2);
	}

	.qr-card__where {
		font-size: 0.76rem;
		line-height: 1.45;
		color: var(--m-text-3);
	}

	.qr-card__link {
		justify-self: start;
	}

	/* Sits below the body so the booking note reads as a footnote on the one
	   code rather than a second, separate QR feature. */
	.qr-card__note {
		border-top: 1px solid var(--m-border-soft);
		padding: 0.85rem 1rem 1rem;
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--m-text-3);
	}
</style>
