<script lang="ts">
	import QRCode from 'qrcode';
	import { Link2 } from '@lucide/svelte';

	// Mirrors the two QrCodeDialog entry points in the app: one for the published
	// waiver, one scoped to a single booking. Titles and descriptions are the
	// dialogs' own copy.
	const codes = [
		{
			title: 'Waiver QR code',
			description: 'Scan to open the live waiver form.',
			where: 'Waiver page, once the waiver is published',
			url: 'https://apex.waiver.link/ride'
		},
		{
			title: 'Booking QR code',
			description: 'Scan to open the waiver for Sunset Kayak Tour.',
			where: 'Bookings list, and inside any booking',
			url: 'https://apex.waiver.link/b/BK-4471-QT'
		}
	] as const;

	let dataUrls = $state<Record<string, string | null>>({});

	$effect(() => {
		let cancelled = false;

		for (const code of codes) {
			void QRCode.toDataURL(code.url, {
				margin: 1,
				width: 240,
				color: { dark: '#221d2b', light: '#f7f7f8' }
			})
				.then((next: string) => {
					if (!cancelled) dataUrls = { ...dataUrls, [code.title]: next };
				})
				.catch((error: unknown) => {
					console.error('[marketing/qr-placement] unable to generate QR code', error);
				});
		}

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="qr-placement">
	{#each codes as code (code.title)}
		<div class="mkt-vig qr-card" data-gsap-image>
			<div class="mkt-vig__head">
				<span class="mkt-vig__title">{code.title}</span>
				<span class="mkt-pill mkt-pill--accent">QR</span>
			</div>

			<div class="mkt-vig__body qr-card__body">
				<div class="qr-card__code">
					{#if dataUrls[code.title]}
						<img src={dataUrls[code.title]} alt="QR code for the {code.title.toLowerCase()}" />
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
		</div>
	{/each}
</div>

<style>
	.qr-placement {
		display: grid;
		gap: 1rem;
		min-width: 0;
	}

	.qr-card__body {
		display: grid;
		grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr);
		gap: 1rem;
		align-items: center;
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
		gap: 0.5rem;
		min-width: 0;
	}

	.qr-card__desc {
		font-size: 0.84rem;
		line-height: 1.5;
		color: var(--m-text-2);
	}

	.qr-card__where {
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--m-text-3);
	}

	.qr-card__link {
		justify-self: start;
	}
</style>
