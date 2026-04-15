<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';

	interface Props {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		cancelLabel?: string;
		destructive?: boolean;
		isConfirming?: boolean;
		onConfirm: () => Promise<void> | void;
	}

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		destructive = false,
		isConfirming = false,
		onConfirm
	}: Props = $props();

	async function handleConfirm() {
		await onConfirm();
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>{title}</DialogTitle>
			<DialogDescription>{description}</DialogDescription>
		</DialogHeader>
		<DialogFooter>
			<Button type="button" variant="outline" onclick={() => (open = false)}>
				{cancelLabel}
			</Button>
			<Button
				type="button"
				variant={destructive ? 'destructive' : 'default'}
				onclick={handleConfirm}
				disabled={isConfirming}
			>
				{isConfirming ? 'Working…' : confirmLabel}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
