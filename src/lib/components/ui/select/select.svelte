<script lang="ts" module>
	export type SelectOption = { value: string; label: string; disabled?: boolean };
</script>

<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { cn } from '$lib/utils.js';

	interface Props {
		value?: string;
		options: SelectOption[];
		placeholder?: string;
		id?: string;
		'aria-label'?: string;
		'aria-describedby'?: string;
		'aria-invalid'?: boolean | 'true' | 'false';
		/** Classes for the trigger button; defaults to the app's input look. */
		class?: string;
		contentClass?: string;
		/**
		 * Render the menu in place instead of in a body portal. Use inside
		 * themed subtrees (e.g. the public waiver theme) so the menu inherits
		 * the same color variables as the trigger.
		 */
		inline?: boolean;
		onValueChange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		options,
		placeholder = 'Select one',
		id,
		'aria-label': ariaLabel,
		'aria-describedby': ariaDescribedby,
		'aria-invalid': ariaInvalid,
		class: className,
		contentClass,
		inline = false,
		onValueChange
	}: Props = $props();

	const selectedLabel = $derived(options.find((option) => option.value === value)?.label);
</script>

<SelectPrimitive.Root
	type="single"
	bind:value
	items={options}
	onValueChange={(next) => onValueChange?.(next)}
>
	<SelectPrimitive.Trigger
		{id}
		aria-label={ariaLabel}
		aria-describedby={ariaDescribedby}
		aria-invalid={ariaInvalid}
		data-slot="select-trigger"
		class={cn(
			'flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-placeholder:text-muted-foreground',
			className
		)}
	>
		<span class="min-w-0 truncate">{selectedLabel ?? placeholder}</span>
		<ChevronDownIcon class="size-4 shrink-0 opacity-60" aria-hidden="true" />
	</SelectPrimitive.Trigger>
	<SelectPrimitive.Portal disabled={inline}>
		<SelectPrimitive.Content
			data-slot="select-content"
			sideOffset={4}
			class={cn(
				'relative z-50 max-h-(--bits-select-content-available-height) w-(--bits-select-anchor-width) min-w-32 overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
				contentClass
			)}
		>
			<SelectPrimitive.Viewport>
				{#each options as option (option.value)}
					<SelectPrimitive.Item
						value={option.value}
						label={option.label}
						disabled={option.disabled}
						data-slot="select-item"
						class="relative flex min-h-8 cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-foreground/10 data-disabled:pointer-events-none data-disabled:opacity-50"
					>
						{#snippet children({ selected })}
							<span class="min-w-0 truncate">{option.label}</span>
							{#if selected}
								<CheckIcon class="absolute right-2 size-3.5" aria-hidden="true" />
							{/if}
						{/snippet}
					</SelectPrimitive.Item>
				{/each}
			</SelectPrimitive.Viewport>
		</SelectPrimitive.Content>
	</SelectPrimitive.Portal>
</SelectPrimitive.Root>
