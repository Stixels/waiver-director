<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	type Props = {
		label: string;
		/** Collects rows and returns the finished CSV. Reports row progress as it goes. */
		buildCsv: (onProgress: (rowCount: number) => void) => Promise<{
			filename: string;
			csv: string;
			rowCount: number;
		}>;
	};

	let { label, buildCsv }: Props = $props();

	let isExporting = $state(false);
	let progressCount = $state(0);

	function downloadCsv(filename: string, csv: string) {
		// The BOM lets Excel detect UTF-8 so accented names render correctly.
		const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	async function handleExport() {
		if (isExporting) return;
		isExporting = true;
		progressCount = 0;
		try {
			const result = await buildCsv((count) => {
				progressCount = count;
			});
			downloadCsv(result.filename, result.csv);
			toast.success(
				`Exported ${result.rowCount.toLocaleString()} ${result.rowCount === 1 ? 'row' : 'rows'}.`
			);
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Export failed. Please try again.'));
		} finally {
			isExporting = false;
		}
	}
</script>

<Button
	type="button"
	variant="outline"
	size="lg"
	class="h-9 gap-2"
	disabled={isExporting}
	onclick={handleExport}
	aria-live="polite"
>
	{#if isExporting}
		<LoaderCircleIcon class="size-4 animate-spin" aria-hidden="true" />
		<span>Exporting{progressCount > 0 ? ` ${progressCount.toLocaleString()}…` : '…'}</span>
	{:else}
		<DownloadIcon class="size-4" aria-hidden="true" />
		<span>{label}</span>
	{/if}
</Button>
