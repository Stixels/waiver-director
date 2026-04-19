<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { createSortable, isSortable } from '@dnd-kit/svelte/sortable';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TypeIcon from '@lucide/svelte/icons/type';
	import SquareCheckIcon from '@lucide/svelte/icons/square-check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import {
		createBlankField,
		createOptionId,
		formatFieldTypeLabel,
		type WaiverDefinition,
		type WaiverField,
		type WaiverFieldType
	} from '$lib/domain/waivers';
	import { MAX_SELECT_OPTIONS } from '$lib/domain/waiver-constraints';

	interface Props {
		draft?: WaiverDefinition | null;
	}

	let { draft = $bindable(null) }: Props = $props();

	type DragEndHandlerEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
	>[0];

	const fieldTypes: {
		type: WaiverFieldType;
		label: string;
		icon: typeof TypeIcon;
		hint: string;
	}[] = [
		{ type: 'text', label: 'Text', icon: TypeIcon, hint: 'Written answer' },
		{ type: 'checkbox', label: 'Checkbox', icon: SquareCheckIcon, hint: 'Single agreement' },
		{ type: 'select', label: 'Dropdown', icon: ChevronsUpDownIcon, hint: 'Pick one option' },
		{ type: 'date', label: 'Date', icon: CalendarIcon, hint: 'Calendar picker' }
	];

	function getFieldTypeIcon(type: WaiverFieldType) {
		return fieldTypes.find((entry) => entry.type === type)?.icon ?? TypeIcon;
	}

	function addField(type: WaiverFieldType) {
		if (!draft) return;
		draft.fields.push(createBlankField(type));
	}

	function removeField(index: number) {
		if (!draft) return;
		draft.fields.splice(index, 1);
	}

	function reorderFields(fromIndex: number, toIndex: number) {
		if (!draft) return;
		if (fromIndex === toIndex) return;
		if (
			fromIndex < 0 ||
			fromIndex >= draft.fields.length ||
			toIndex < 0 ||
			toIndex >= draft.fields.length
		) {
			return;
		}

		const next = [...draft.fields];
		const [field] = next.splice(fromIndex, 1);
		if (!field) return;
		next.splice(toIndex, 0, field);
		draft.fields = next;
	}

	function handleFieldDragEnd(event: DragEndHandlerEvent) {
		if (!draft) return;
		if (event.canceled) return;

		const { source, target } = event.operation;
		if (!isSortable(source) || !isSortable(target)) return;

		reorderFields(source.index, target.index);
	}

	function addOption(field: Extract<WaiverField, { type: 'select' }>) {
		field.options.push({
			id: createOptionId('option'),
			label: `Option ${field.options.length + 1}`
		});
	}

	function removeOption(field: Extract<WaiverField, { type: 'select' }>, optionIndex: number) {
		field.options.splice(optionIndex, 1);
	}
</script>

{#if draft}
	<div class="flex h-full min-h-0 flex-col">
		<!-- Header row: Custom fields label + Add button -->
		<div
			class="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-4 py-2.5"
		>
			<div class="min-w-0">
				<p class="panel-section-label">Custom fields</p>
				<p class="text-[10.5px] leading-tight text-muted-foreground/65">
					Questions before the signature.
				</p>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger class="inline-flex">
					<Button
						type="button"
						size="sm"
						variant="outline"
						class="h-8 shrink-0 gap-1 rounded-md px-2.5 text-[11px] font-medium tracking-wide"
					>
						<PlusIcon class="size-3" />
						Add field
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="w-56">
					{#each fieldTypes as type (type.type)}
						<DropdownMenuItem onclick={() => addField(type.type)}>
							<type.icon class="size-4 text-muted-foreground" />
							<div class="flex flex-col">
								<span class="text-sm font-medium">{type.label}</span>
								<span class="text-[11px] text-muted-foreground">{type.hint}</span>
							</div>
						</DropdownMenuItem>
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>

		<!-- Scrollable fields list -->
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">
			{#if draft.fields.length === 0}
				<div
					class="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-10 text-center"
				>
					<p class="text-[11px] text-muted-foreground">No custom fields yet.</p>
					<p class="mt-1 text-[11px] text-muted-foreground/70">
						Use <span class="font-medium text-foreground/80">Add field</span> to collect extra info before
						the signature.
					</p>
				</div>
			{:else}
				<DragDropProvider onDragEnd={handleFieldDragEnd}>
					<ul class="space-y-1.5">
						{#each draft.fields as field, index (field.id)}
							{@const sortable = createSortable({
								id: field.id,
								get index() {
									return index;
								}
							})}
							{@const FieldIcon = getFieldTypeIcon(field.type)}
							<li
								{@attach sortable.attach}
								class="field-row"
								class:is-dragging={sortable.isDragging}
								class:is-drop-target={sortable.isDropTarget}
							>
								<button
									type="button"
									{@attach sortable.attachHandle}
									class="field-grip"
									aria-label="Drag to reorder field"
									title="Drag to reorder"
								>
									<GripVerticalIcon class="size-3.5" />
								</button>

								<div class="min-w-0 flex-1 px-2.5 py-1.5">
									<!-- Meta row: type pill + required toggle + delete -->
									<div class="flex items-center justify-between gap-2">
										<div class="flex min-w-0 items-center gap-1.5">
											<span class="field-type-pill">
												<FieldIcon class="field-type-pill-icon size-3" />
												<span class="field-type-pill-text">
													{formatFieldTypeLabel(field.type)}
												</span>
											</span>
											<label class="required-switch">
												<input type="checkbox" bind:checked={field.required} />
												<span class="switch-track">
													<span class="switch-thumb"></span>
												</span>
												<span class="switch-label">Required</span>
											</label>
										</div>

										<Tooltip>
											<TooltipTrigger class="inline-flex">
												<button
													type="button"
													class="field-delete"
													onclick={() => removeField(index)}
													aria-label="Delete field"
												>
													<Trash2Icon class="size-3.5" />
												</button>
											</TooltipTrigger>
											<TooltipContent side="top" sideOffset={4}>Delete field</TooltipContent>
										</Tooltip>
									</div>

									<!-- Label input below -->
									<div class="mt-1.5">
										<label for={`${field.id}-label`} class="sr-only"> Label guests will see </label>
										<Input
											id={`${field.id}-label`}
											bind:value={field.label}
											maxlength={120}
											placeholder="Label guests will see"
											class="field-label-input"
										/>
									</div>

									{#if field.type === 'select'}
										<div class="options-card mt-2">
											<div class="flex items-center justify-between gap-2">
												<p class="options-label">Options</p>
												<span class="options-count">
													{field.options.length}
													{field.options.length === 1 ? 'item' : 'items'}
												</span>
											</div>
											<div class="mt-1.5 space-y-1">
												{#each field.options as option, optionIndex (option.id)}
													<div class="option-row">
														<span class="option-index" aria-hidden="true">
															{optionIndex + 1}
														</span>
														<Input
															id={`${field.id}-option-${optionIndex}`}
															bind:value={option.label}
															maxlength={80}
															class="option-input"
															placeholder="Option label"
														/>
														<button
															type="button"
															class="field-inline-remove"
															disabled={field.options.length === 1}
															onclick={() => removeOption(field, optionIndex)}
															aria-label="Remove option"
														>
															<Trash2Icon class="size-3" />
														</button>
													</div>
												{/each}
											</div>
											<button
												type="button"
												class="add-option-btn"
												disabled={field.options.length >= MAX_SELECT_OPTIONS}
												onclick={() => addOption(field)}
											>
												<PlusIcon class="size-3" />
												<span>Add option</span>
											</button>
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				</DragDropProvider>
			{/if}
		</div>
	</div>
{:else}
	<div
		class="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground"
	>
		Create or select a waiver to begin editing.
	</div>
{/if}

<style>
	.panel-section-label {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 90%, var(--foreground));
	}

	.field-row {
		display: flex;
		min-width: 0;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--card) 50%, transparent);
		border-radius: 0.55rem;
		overflow: hidden;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			box-shadow 160ms ease,
			transform 160ms ease;
	}

	.field-row:hover {
		border-color: color-mix(in srgb, var(--border) 100%, var(--foreground) 4%);
		background: color-mix(in srgb, var(--card) 70%, transparent);
	}

	.field-row:focus-within {
		border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
		background: color-mix(in srgb, var(--card) 80%, transparent);
	}

	.field-row.is-drop-target {
		border-color: color-mix(in srgb, var(--primary) 50%, var(--border));
	}

	.field-row.is-dragging {
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
	}

	.field-grip {
		display: flex;
		width: 1.5rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--muted) 30%, transparent);
		color: color-mix(in srgb, var(--muted-foreground) 60%, transparent);
		border-right: 1px solid var(--border);
		cursor: grab;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.field-grip:hover {
		background: color-mix(in srgb, var(--muted) 60%, transparent);
		color: var(--foreground);
	}

	.field-grip:active {
		cursor: grabbing;
	}

	:global(.field-label-input) {
		height: 1.9rem;
		background: color-mix(in srgb, var(--background) 60%, transparent);
		border: 1px solid var(--border);
		padding-left: 0.6rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--foreground);
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease;
	}

	:global(.field-label-input:focus-visible) {
		border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
		outline: none;
	}

	.field-type-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		height: 1.2rem;
		padding: 0 0.5rem 0 0.38rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--muted) 40%, transparent);
		font-size: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		color: color-mix(in srgb, var(--muted-foreground) 90%, var(--foreground));
		text-transform: uppercase;
	}

	:global(.field-type-pill-icon) {
		flex: 0 0 auto;
		color: color-mix(in srgb, var(--muted-foreground) 85%, transparent);
	}

	.field-type-pill-text {
		line-height: 1;
	}

	.required-switch {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		user-select: none;
	}

	.required-switch input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.switch-track {
		position: relative;
		display: inline-block;
		width: 1.5rem;
		height: 0.85rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--muted-foreground) 25%, var(--border));
		transition: background 180ms ease;
	}

	.switch-thumb {
		position: absolute;
		top: 0.1rem;
		left: 0.1rem;
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 999px;
		background: var(--background);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
		transition: transform 180ms ease;
	}

	.required-switch input:checked ~ .switch-track {
		background: color-mix(in srgb, var(--primary) 85%, transparent);
	}

	.required-switch input:checked ~ .switch-track .switch-thumb {
		transform: translateX(0.65rem);
	}

	.required-switch input:focus-visible ~ .switch-track {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent);
	}

	.switch-label {
		font-size: 0.65rem;
		font-weight: 500;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	.field-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.35rem;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.field-delete:hover {
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
		color: var(--destructive);
	}

	.field-inline-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 0.35rem;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.field-inline-remove:hover:not(:disabled) {
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
		color: var(--destructive);
	}

	.field-inline-remove:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.options-card {
		position: relative;
		padding: 0.45rem 0.55rem 0.45rem 0.6rem;
		border-radius: 0.45rem;
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		background: color-mix(in srgb, var(--muted) 18%, transparent);
	}

	.options-card::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.4rem;
		bottom: 0.4rem;
		width: 2px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 45%, var(--border));
		opacity: 0.6;
	}

	.options-label {
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 85%, var(--foreground));
	}

	.options-count {
		font-size: 0.58rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		color: color-mix(in srgb, var(--muted-foreground) 75%, transparent);
		font-variant-numeric: tabular-nums;
	}

	.option-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.option-index {
		display: inline-flex;
		flex: 0 0 auto;
		width: 0.95rem;
		height: 0.95rem;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: color-mix(in srgb, var(--muted) 60%, transparent);
		font-size: 0.55rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: color-mix(in srgb, var(--muted-foreground) 90%, transparent);
	}

	:global(.option-input) {
		height: 1.55rem !important;
		font-size: 0.72rem !important;
		padding-left: 0.5rem !important;
		padding-right: 0.5rem !important;
		background: color-mix(in srgb, var(--background) 85%, transparent);
	}

	.add-option-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		margin-top: 0.4rem;
		height: 1.4rem;
		padding: 0 0.5rem 0 0.4rem;
		border-radius: 999px;
		border: 1px dashed color-mix(in srgb, var(--primary) 35%, var(--border));
		background: transparent;
		font-size: 0.62rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: color-mix(in srgb, var(--primary) 70%, var(--foreground));
		transition:
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	.add-option-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
		color: color-mix(in srgb, var(--primary) 90%, var(--foreground));
	}

	.add-option-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.add-option-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent);
	}
</style>
