<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
	import {
		DateFormatter,
		getLocalTimeZone,
		isEqualMonth,
		type DateValue
	} from '@internationalized/date';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { buttonVariants, type ButtonVariant } from '$lib/components/ui/button';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils';

	let {
		ref = $bindable(null),
		value = $bindable(),
		placeholder = $bindable(),
		weekdayFormat = 'short',
		class: className,
		buttonVariant = 'ghost',
		locale = 'en-US',
		disableDaysOutsideMonth = false,
		...restProps
	}: WithoutChildrenOrChild<RangeCalendarPrimitive.RootProps> & {
		buttonVariant?: ButtonVariant;
	} = $props();

	const monthFormatter = $derived(new DateFormatter(locale, { month: 'long', year: 'numeric' }));

	function formatMonth(month: DateValue) {
		return monthFormatter.format(month.toDate(getLocalTimeZone()));
	}
</script>

<RangeCalendarPrimitive.Root
	bind:ref
	bind:value
	bind:placeholder
	{weekdayFormat}
	{disableDaysOutsideMonth}
	{locale}
	class={cn(
		'group/calendar bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(6)] [[data-slot=popover-content]_&]:bg-transparent',
		className
	)}
	{...restProps}
>
	{#snippet children({ months, weekdays })}
		<div class="relative flex flex-col gap-4">
			<nav class="absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1">
				<RangeCalendarPrimitive.PrevButton
					class={cn(
						buttonVariants({ variant: buttonVariant }),
						'size-(--cell-size) bg-transparent p-0 select-none disabled:opacity-50'
					)}
				>
					<ChevronLeftIcon class="size-4" aria-hidden="true" />
				</RangeCalendarPrimitive.PrevButton>
				<RangeCalendarPrimitive.NextButton
					class={cn(
						buttonVariants({ variant: buttonVariant }),
						'size-(--cell-size) bg-transparent p-0 select-none disabled:opacity-50'
					)}
				>
					<ChevronRightIcon class="size-4" aria-hidden="true" />
				</RangeCalendarPrimitive.NextButton>
			</nav>

			{#each months as month (month.value.toString())}
				<div class="flex flex-col">
					<RangeCalendarPrimitive.Header
						class="flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium"
					>
						<RangeCalendarPrimitive.Heading class="px-(--cell-size) text-sm font-medium">
							{formatMonth(month.value)}
						</RangeCalendarPrimitive.Heading>
					</RangeCalendarPrimitive.Header>

					<RangeCalendarPrimitive.Grid class="mt-4 flex w-full border-collapse flex-col gap-1">
						<RangeCalendarPrimitive.GridHead>
							<RangeCalendarPrimitive.GridRow class="flex select-none">
								{#each weekdays as weekday, index (index)}
									<RangeCalendarPrimitive.HeadCell
										class="w-(--cell-size) rounded-md text-[0.8rem] font-normal text-muted-foreground"
									>
										{weekday.slice(0, 2)}
									</RangeCalendarPrimitive.HeadCell>
								{/each}
							</RangeCalendarPrimitive.GridRow>
						</RangeCalendarPrimitive.GridHead>
						<RangeCalendarPrimitive.GridBody>
							{#each month.weeks as weekDates (weekDates.map((date) => date.toString()).join('-'))}
								<RangeCalendarPrimitive.GridRow class="mt-2 flex w-full">
									{#each weekDates as date (date.toString())}
										<RangeCalendarPrimitive.Cell
											{date}
											month={month.value}
											class={cn(
												'relative size-(--cell-size) p-0 text-center text-sm focus-within:z-20 data-[range-middle]:rounded-e-(--cell-radius) [&:first-child[data-selected]_[data-bits-day]]:rounded-s-(--cell-radius) [&:has([data-range-end])]:rounded-e-(--cell-radius) dark:[&:has([data-range-end])]:hover:bg-accent [&:has([data-range-middle])]:rounded-none [&:has([data-range-middle])]:bg-accent first:[&:has([data-range-middle])]:rounded-s-(--cell-radius) last:[&:has([data-range-middle])]:rounded-e-(--cell-radius) dark:[&:has([data-range-middle])]:hover:bg-accent/50 [&:has([data-range-start])]:rounded-s-(--cell-radius) dark:[&:has([data-range-start])]:hover:bg-accent [&:has([data-selected])]:bg-accent [&:last-child[data-selected]_[data-bits-day]]:rounded-e-(--cell-radius)'
											)}
										>
											<RangeCalendarPrimitive.Day
												class={cn(
													'flex size-(--cell-size) flex-col items-center justify-center gap-1 rounded-(--cell-radius) p-0 leading-none font-normal whitespace-nowrap select-none not-data-selected:hover:bg-accent/50 not-data-selected:hover:text-accent-foreground focus:relative focus:border-ring focus:ring-ring/50 data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground data-[disabled]:opacity-50 data-[range-end]:bg-primary data-[range-end]:text-primary-foreground data-[range-end]:hover:text-foreground data-[range-middle]:rounded-none data-[range-start]:bg-primary data-[range-start]:text-primary-foreground data-[range-start]:hover:text-foreground data-[unavailable]:line-through dark:data-[range-middle]:hover:bg-accent/0 [&>span]:text-xs [&>span]:opacity-70 [&[data-outside-month]:not([data-selected])]:text-muted-foreground [&[data-outside-month]:not([data-selected])]:hover:text-accent-foreground [&[data-today]:not([data-selected])]:bg-accent [&[data-today]:not([data-selected])]:text-accent-foreground [&[data-today][data-disabled]]:text-muted-foreground',
													!isEqualMonth(date, month.value) && 'text-muted-foreground'
												)}
											/>
										</RangeCalendarPrimitive.Cell>
									{/each}
								</RangeCalendarPrimitive.GridRow>
							{/each}
						</RangeCalendarPrimitive.GridBody>
					</RangeCalendarPrimitive.Grid>
				</div>
			{/each}
		</div>
	{/snippet}
</RangeCalendarPrimitive.Root>
