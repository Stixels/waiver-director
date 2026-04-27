<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	interface Props {
		open: boolean;
		templateName: string;
		isSaving: boolean;
		canSave: boolean;
		onConfirm: () => void;
	}

	let {
		open = $bindable(false),
		templateName = $bindable(''),
		isSaving,
		canSave,
		onConfirm
	}: Props = $props();
</script>

<Dialog bind:open>
	<DialogContent class="max-w-sm gap-0 overflow-hidden p-0">
		<DialogHeader class="border-b border-border px-6 py-4">
			<DialogTitle>Save as template</DialogTitle>
			<DialogDescription>Give this template a name so you can load it later.</DialogDescription>
		</DialogHeader>
		<div class="px-6 py-5">
			<label
				for="template-name"
				class="block pb-1 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
			>
				Template name
			</label>
			<Input
				id="template-name"
				bind:value={templateName}
				placeholder="e.g. Summer promotion, Default thank-you..."
				onkeydown={(event) => {
					if (event.key === 'Enter' && templateName.trim() && canSave) {
						onConfirm();
					}
				}}
			/>
		</div>
		<div class="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
			<Button variant="outline" onclick={() => (open = false)} disabled={isSaving}>Cancel</Button>
			<Button onclick={onConfirm} disabled={isSaving || !templateName.trim() || !canSave}>
				{isSaving ? 'Saving...' : 'Save template'}
			</Button>
		</div>
	</DialogContent>
</Dialog>
