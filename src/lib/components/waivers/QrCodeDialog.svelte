<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
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
	}

	let {
		open = $bindable(),
		title,
		description,
		url,
		copySuccessMessage = 'Link copied.',
		copyErrorMessage = 'Unable to copy link.',
		logContext = 'qr-code-dialog'
	}: Props = $props();

	async function copyLink() {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			toast.success(copySuccessMessage);
		} catch (error) {
			console.error(`[${logContext}] unable to copy link`, error);
			toast.error(copyErrorMessage);
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-xs gap-0 overflow-hidden p-0">
		<DialogHeader class="border-b border-border px-5 py-4">
			<DialogTitle>{title}</DialogTitle>
			<DialogDescription>{description}</DialogDescription>
		</DialogHeader>
		<div class="flex flex-col items-center gap-4 p-6">
			<QrCodePreview text={url} size={200} />
			<Button variant="outline" class="w-full" onclick={copyLink}>
				<LinkIcon class="size-3.5" aria-hidden="true" />
				Copy link
			</Button>
		</div>
	</DialogContent>
</Dialog>
