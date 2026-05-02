<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { parseDate, type DateValue } from '@internationalized/date';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';

	let {
		startDate,
		endDate,
		onchange
	}: {
		startDate: string;
		endDate: string;
		onchange: (start: string, end: string) => void;
	} = $props();

	const MAX_RANGE_DAYS = 30;
	const presets: Array<{ label: string; days: number }> = [
		{ label: '7d', days: 7 },
		{ label: '30d', days: 30 }
	];
	let endingCalendarOpen = $state(false);
	let endingDateValue = $state<DateValue | undefined>();

	function toDateInputValue(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function parseLocalDate(value: string): Date {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function dateValueFromString(value: string) {
		return value ? parseDate(value) : undefined;
	}

	function formatFilterDate(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		if (!year || !month || !day) return value;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(year, month - 1, day));
	}

	function daysInRange(from: string, to: string) {
		const fromDate = parseLocalDate(from);
		const toDate = parseLocalDate(to);
		const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
		return Math.min(MAX_RANGE_DAYS, Math.max(1, diffDays + 1));
	}

	function rangeStartForEndingOn(end: string, days: number) {
		const endDate = parseLocalDate(end);
		return toDateInputValue(
			new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (days - 1))
		);
	}

	const today = $derived(toDateInputValue(new Date()));
	const selectedDays = $derived(daysInRange(startDate, endDate));
	const selectedLabel = $derived(
		`${selectedDays} days ending ${formatFilterDate(endDate || today)}`
	);

	function setWindow(days: number, endingOn = endDate || today) {
		const cappedEnd = endingOn > today ? today : endingOn;
		const nextStart = rangeStartForEndingOn(cappedEnd, days);
		if (nextStart !== startDate || cappedEnd !== endDate) {
			onchange(nextStart, cappedEnd);
		}
	}

	function handleEndingChange(value: string) {
		if (!value) return;
		setWindow(selectedDays, value);
		endingCalendarOpen = false;
	}

	$effect(() => {
		endingDateValue = dateValueFromString(endDate || today);
	});

	$effect(() => {
		const nextEnd = endingDateValue?.toString();
		if (!nextEnd || nextEnd === endDate) return;
		handleEndingChange(nextEnd);
	});
</script>

<div class="flex flex-wrap items-center justify-end gap-2">
	<div class="flex items-center gap-1">
		{#each presets as preset (preset.days)}
			<Button
				variant={selectedDays === preset.days ? 'default' : 'outline'}
				size="sm"
				onclick={() => setWindow(preset.days)}
				class="h-8 px-3 text-xs"
			>
				{preset.label}
			</Button>
		{/each}
	</div>

	<Popover bind:open={endingCalendarOpen}>
		<PopoverTrigger>
			{#snippet child({ props })}
				<Button
					{...props}
					type="button"
					variant="outline"
					size="sm"
					class="h-8 min-w-44 justify-between gap-2"
					title={selectedLabel}
				>
					<span class="inline-flex min-w-0 items-center gap-1.5">
						<CalendarClockIcon class="size-3.5 shrink-0" aria-hidden="true" />
						<span>Ending {formatFilterDate(endDate || today)}</span>
					</span>
				</Button>
			{/snippet}
		</PopoverTrigger>
		<PopoverContent align="end" class="w-auto p-0">
			<Calendar
				type="single"
				bind:value={endingDateValue}
				maxValue={dateValueFromString(today)}
				class="w-fit"
			/>
		</PopoverContent>
	</Popover>
</div>
