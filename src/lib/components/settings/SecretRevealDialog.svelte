<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import CopyIcon from '@lucide/svelte/icons/copy';

	interface Props {
		open?: boolean;
		title: string;
		description: string;
		secret: string;
	}

	let { open = $bindable(false), title, description, secret }: Props = $props();

	async function copySecret() {
		try {
			await navigator.clipboard.writeText(secret);
			toast.success('Copied to clipboard.');
		} catch {
			toast.error('Copy failed. Select the value and copy it manually.');
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle>{title}</DialogTitle>
			<DialogDescription>{description}</DialogDescription>
		</DialogHeader>
		<div class="flex items-center gap-2">
			<code
				class="min-w-0 flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all select-all"
				>{secret}</code
			>
			<Button variant="outline" size="sm" onclick={copySecret}>
				<CopyIcon class="size-3.5" />
				Copy
			</Button>
		</div>
		<p class="text-xs text-muted-foreground">
			You won't be able to see this value again. Store it somewhere safe.
		</p>
		<DialogFooter>
			<Button onclick={() => (open = false)}>Done</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
