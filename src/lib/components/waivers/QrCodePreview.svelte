<script lang="ts">
	import QRCode from 'qrcode';

	interface Props {
		text: string;
		size?: number;
	}

	let { text, size = 220 }: Props = $props();
	let dataUrl = $state<string | null>(null);

	$effect(() => {
		let cancelled = false;

		void QRCode.toDataURL(text, {
			margin: 1,
			width: size,
			color: {
				dark: '#111827',
				light: '#ffffff'
			}
		}).then((nextUrl: string) => {
			if (!cancelled) {
				dataUrl = nextUrl;
			}
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="inline-flex rounded-2xl border border-border bg-white p-3 shadow-sm">
	{#if dataUrl}
		<img src={dataUrl} alt="QR code preview" width={size} height={size} class="block rounded-lg" />
	{:else}
		<div
			class="animate-pulse rounded-lg bg-muted"
			style={`width:${size}px; height:${size}px;`}
			aria-hidden="true"
		></div>
	{/if}
</div>
