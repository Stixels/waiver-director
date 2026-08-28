<script lang="ts">
	import QRCode from 'qrcode';
	import { CalendarCheck, Code, Link2 } from '@lucide/svelte';

	// The marketing surface already runs on the fictional Apex Adventures demo data,
	// so the code encodes the same address the chip below it displays.
	const shareUrl = 'https://apex.waiver.link/ride';
	const shareLabel = 'apex.waiver.link/ride';

	let qrDataUrl = $state<string | null>(null);

	$effect(() => {
		let cancelled = false;

		void QRCode.toDataURL(shareUrl, {
			margin: 1,
			width: 320,
			color: { dark: '#221d2b', light: '#f7f7f8' }
		})
			.then((next: string) => {
				if (!cancelled) qrDataUrl = next;
			})
			.catch((error: unknown) => {
				if (!cancelled) qrDataUrl = null;
				console.error('[marketing/share-preview] unable to generate QR code', error);
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Share this waiver</span>
		<span class="mkt-pill mkt-pill--green"><i></i>Published</span>
	</div>

	<div class="mkt-vig__body share__body">
		<div class="share__qr">
			{#if qrDataUrl}
				<img src={qrDataUrl} alt="QR code linking to the Apex Adventures waiver" />
			{:else}
				<div class="share__qr-fallback" aria-hidden="true"></div>
			{/if}
		</div>

		<div class="share__ways">
			<span class="mkt-way">
				<Link2 size={16} aria-hidden="true" />
				<span><code>{shareLabel}</code></span>
			</span>
			<span class="mkt-way">
				<Code size={16} aria-hidden="true" />
				<span>Embed on your site</span>
			</span>
			<span class="mkt-way">
				<CalendarCheck size={16} aria-hidden="true" />
				<span>QR for one booking</span>
			</span>
		</div>
	</div>
</div>

<style>
	.share__body {
		display: grid;
		gap: 1rem;
		grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
		align-items: center;
	}

	@media (max-width: 540px) {
		.share__body {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.share__qr {
		border-radius: 10px;
		background: oklch(0.97 0 0);
		padding: 7%;
		box-shadow: 0 14px 34px oklch(0 0 0 / 48%);
	}

	.share__qr img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 4px;
	}

	.share__qr-fallback {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 4px;
		background: oklch(0.9 0 0);
	}

	.share__ways {
		display: grid;
		gap: 0.5rem;
	}
</style>
