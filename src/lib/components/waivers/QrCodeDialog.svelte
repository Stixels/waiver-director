<script lang="ts">
	import QRCode from 'qrcode';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import CheckIcon from '@lucide/svelte/icons/check';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import LinkIcon from '@lucide/svelte/icons/link';
	import QrCodePreview from './QrCodePreview.svelte';

	interface Props {
		open: boolean;
		title: string;
		description: string;
		url: string;
		copySuccessMessage?: string;
		copyErrorMessage?: string;
		logContext?: string;
		downloadFileName?: string;
	}

	let {
		open = $bindable(),
		title,
		description,
		url,
		copySuccessMessage = 'Link copied.',
		copyErrorMessage = 'Unable to copy link.',
		logContext = 'qr-code-dialog',
		downloadFileName = 'waiver-qr-code.png'
	}: Props = $props();

	const DOWNLOAD_SIZE = 1024;

	let copied = $state(false);
	let isDownloading = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		return () => {
			if (copiedTimer) clearTimeout(copiedTimer);
		};
	});

	async function copyLink() {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			toast.success(copySuccessMessage);
			copied = true;
			if (copiedTimer) clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => {
				copied = false;
				copiedTimer = null;
			}, 1600);
		} catch (error) {
			console.error(`[${logContext}] unable to copy link`, error);
			toast.error(copyErrorMessage);
		}
	}

	async function downloadQrCode() {
		if (!url || isDownloading) return;
		isDownloading = true;
		try {
			// Generate a larger image than the on-screen preview so it prints crisply.
			const dataUrl = await QRCode.toDataURL(url, {
				margin: 2,
				width: DOWNLOAD_SIZE,
				color: { dark: '#111827', light: '#ffffff' }
			});
			const link = document.createElement('a');
			link.href = dataUrl;
			link.download = downloadFileName;
			document.body.appendChild(link);
			link.click();
			link.remove();
		} catch (error) {
			console.error(`[${logContext}] unable to download QR code`, error);
			toast.error('Unable to download the QR code.');
		} finally {
			isDownloading = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-sm gap-0 overflow-hidden p-0">
		<DialogHeader class="border-b border-border px-5 py-4">
			<DialogTitle>{title}</DialogTitle>
			<DialogDescription>{description}</DialogDescription>
		</DialogHeader>
		<div class="flex flex-col items-center gap-4 p-6">
			<QrCodePreview text={url} size={280} />
			<div class="grid w-full grid-cols-2 gap-2">
				<Button variant="outline" class="w-full" onclick={copyLink}>
					{#if copied}
						<CheckIcon class="size-3.5 text-emerald-500" aria-hidden="true" />
						Copied
					{:else}
						<LinkIcon class="size-3.5" aria-hidden="true" />
						Copy link
					{/if}
				</Button>
				<Button variant="outline" class="w-full" onclick={downloadQrCode} disabled={isDownloading}>
					<DownloadIcon class="size-3.5" aria-hidden="true" />
					{isDownloading ? 'Preparing…' : 'Download PNG'}
				</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>
