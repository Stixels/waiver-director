<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { RangeCalendar } from '$lib/components/ui/range-calendar';
	import { parseDate, type DateValue } from '@internationalized/date';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	let {
		startDate,
		endDate,
		onchange
	}: {
		startDate: string;
		endDate: string;
		onchange: (start: string, end: string) => void;
	} = $props();

	const MAX_RANGE_DAYS = 90;
	const DAY_MS = 24 * 60 * 60 * 1000;
	const presets: Array<{ label: string; days: number }> = [
		{ label: '7d', days: 7 },
		{ label: '30d', days: 30 },
		{ label: '90d', days: 90 }
	];

	let dateCalendarOpen = $state(false);
	let dateRangeValue = $state<{ start: DateValue | undefined; end: DateValue | undefined }>();

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

	function dateValueKey(value: DateValue | undefined) {
		return value?.toString() ?? '';
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

	function rangeLabel(from: string, to: string) {
		return `${formatFilterDate(from)} - ${formatFilterDate(to)}`;
	}

	function clampRange(from: string, to: string) {
		const fromDate = parseLocalDate(from);
		const toDate = parseLocalDate(to);
		if (toDate.getTime() - fromDate.getTime() <= (MAX_RANGE_DAYS - 1) * DAY_MS) {
			return { from, to };
		}
		return {
			from,
			to: toDateInputValue(
				new Date(
					fromDate.getFullYear(),
					fromDate.getMonth(),
					fromDate.getDate() + MAX_RANGE_DAYS - 1
				)
			)
		};
	}

	function setRange(from: string, to: string) {
		const next = clampRange(from, to);
		dateRangeValue = {
			start: dateValueFromString(next.from),
			end: dateValueFromString(next.to)
		};
		if (next.from !== startDate || next.to !== endDate) {
			onchange(next.from, next.to);
		}
	}

	function applyPreset(days: number) {
		const end = new Date();
		const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));
		setRange(toDateInputValue(start), toDateInputValue(end));
		dateCalendarOpen = false;
	}

	const today = $derived(toDateInputValue(new Date()));
	const selectedLabel = $derived(rangeLabel(startDate, endDate));

	$effect(() => {
		dateRangeValue = {
			start: dateValueFromString(startDate),
			end: dateValueFromString(endDate)
		};
	});

	$effect(() => {
		const nextStart = dateValueKey(dateRangeValue?.start);
		const nextEnd = dateValueKey(dateRangeValue?.end);
		if (!nextStart || !nextEnd) return;
		if (nextStart === startDate && nextEnd === endDate) return;
		const next = clampRange(nextStart, nextEnd);
		if (next.from !== nextStart || next.to !== nextEnd) {
			dateRangeValue = {
				start: dateValueFromString(next.from),
				end: dateValueFromString(next.to)
			};
			return;
		}
		onchange(next.from, next.to);
	});
</script>

<div class="flex flex-wrap items-center justify-end gap-2">
	<div class="flex items-center gap-1">
		{#each presets as preset (preset.days)}
			<Button
				variant="outline"
				size="sm"
				onclick={() => applyPreset(preset.days)}
				class="h-8 px-3 text-xs"
			>
				{preset.label}
			</Button>
		{/each}
	</div>

	<Popover bind:open={dateCalendarOpen}>
		<PopoverTrigger>
			{#snippet child({ props })}
				<Button
					{...props}
					type="button"
					variant="outline"
					size="sm"
					class="h-8 min-w-52 justify-between gap-2"
				>
					<span class="inline-flex min-w-0 items-center gap-1.5">
						<CalendarClockIcon class="size-3.5 shrink-0" aria-hidden="true" />
						<span class="truncate">{selectedLabel}</span>
					</span>
					<ChevronDownIcon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				</Button>
			{/snippet}
		</PopoverTrigger>
		<PopoverContent align="end" class="w-auto p-2">
			<RangeCalendar
				bind:value={dateRangeValue}
				maxValue={dateValueFromString(today)}
				class="w-fit"
			/>
		</PopoverContent>
	</Popover>
</div>
