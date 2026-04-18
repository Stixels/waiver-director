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
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
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

	interface Props {
		draft?: WaiverDefinition | null;
		readOnly?: boolean;
	}

	let { draft = $bindable(null), readOnly = false }: Props = $props();

	type DragEndHandlerEvent = Parameters<
		NonNullable<ComponentProps<typeof DragDropProvider>['onDragEnd']>
	>[0];

	const fieldTypes: {
		type: WaiverFieldType;
		label: string;
		icon: typeof TypeIcon;
		hint: string;
	}[] = [
		{ type: 'shortText', label: 'Short text', icon: TypeIcon, hint: 'Single line answer' },
		{ type: 'longText', label: 'Long text', icon: AlignLeftIcon, hint: 'Paragraph answer' },
		{ type: 'checkbox', label: 'Checkbox', icon: SquareCheckIcon, hint: 'Single agreement' },
		{ type: 'select', label: 'Dropdown', icon: ChevronsUpDownIcon, hint: 'Pick one option' },
		{ type: 'date', label: 'Date', icon: CalendarIcon, hint: 'Calendar picker' }
	];

	function addField(type: WaiverFieldType) {
		if (!draft || readOnly) return;
		draft.fields.push(createBlankField(type));
	}

	function removeField(index: number) {
		if (!draft || readOnly) return;
		draft.fields.splice(index, 1);
	}

	function reorderFields(fromIndex: number, toIndex: number) {
		if (!draft || readOnly) return;
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
		if (!draft || readOnly) return;
		if (event.canceled) return;

		const { source, target } = event.operation;
		if (!isSortable(source) || !isSortable(target)) return;

		reorderFields(source.index, target.index);
	}

	function addOption(field: Extract<WaiverField, { type: 'select' }>) {
		if (readOnly) return;
		field.options.push({
			id: createOptionId('option'),
			label: `Option ${field.options.length + 1}`
		});
	}

	function removeOption(field: Extract<WaiverField, { type: 'select' }>, optionIndex: number) {
		if (readOnly) return;
		field.options.splice(optionIndex, 1);
	}
</script>

{#if draft}
	<div class="flex h-full min-h-0 flex-col">
		<!-- Header row: Custom fields label + Add button -->
		<div
			class="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-5 py-3.5"
		>
			<div>
				<p class="panel-section-label">Custom fields</p>
				<p class="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/70">
					Questions that appear before the signature.
				</p>
			</div>
			{#if !readOnly}
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
			{/if}
		</div>

		<!-- Scrollable fields list -->
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
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
					<ul class="space-y-2.5">
						{#each draft.fields as field, index (field.id)}
							{@const sortable = createSortable({
								id: field.id,
								get index() {
									return index;
								},
								get disabled() {
									return readOnly;
								}
							})}
							<li
								{@attach sortable.attach}
								class="field-row"
								class:is-dragging={sortable.isDragging}
								class:is-drop-target={sortable.isDropTarget}
							>
								{#if !readOnly}
									<button
										type="button"
										{@attach sortable.attachHandle}
										class="field-grip"
										aria-label="Drag to reorder field"
										title="Drag to reorder"
									>
										<GripVerticalIcon class="size-3.5" />
									</button>
								{/if}

								<div class="min-w-0 flex-1 px-3 py-2.5">
									<!-- Meta row: type pill + required toggle + delete -->
									<div class="flex items-center justify-between gap-2">
										<div class="flex min-w-0 items-center gap-2">
											<span class="field-type-pill">
												{formatFieldTypeLabel(field.type)}
											</span>
											{#if !readOnly}
												<label class="required-switch">
													<input
														type="checkbox"
														bind:checked={field.required}
														disabled={readOnly}
													/>
													<span class="switch-track">
														<span class="switch-thumb"></span>
													</span>
													<span class="switch-label">Required</span>
												</label>
											{:else if field.required}
												<span class="field-type-pill is-required">Required</span>
											{/if}
										</div>

										{#if !readOnly}
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
										{/if}
									</div>

									<!-- Label input below -->
									<div class="mt-2">
										<label for={`${field.id}-label`} class="sr-only"> Label guests will see </label>
										<Input
											id={`${field.id}-label`}
											bind:value={field.label}
											maxlength={120}
											disabled={readOnly}
											placeholder="Label guests will see"
											class="field-label-input"
										/>
									</div>

									{#if field.type === 'select'}
										<div class="mt-3 rounded-md border border-border/60 bg-muted/20 p-2.5">
											<div class="flex items-center justify-between">
												<p
													class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
												>
													Options
												</p>
												{#if !readOnly}
													<button
														type="button"
														class="text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
														onclick={() => addOption(field)}
													>
														+ Add option
													</button>
												{/if}
											</div>
											<div class="mt-1.5 space-y-1.5">
												{#each field.options as option, optionIndex (option.id)}
													<div class="flex items-center gap-1.5">
														<Input
															id={`${field.id}-option-${optionIndex}`}
															bind:value={option.label}
															maxlength={80}
															disabled={readOnly}
															class="h-7 text-xs"
															placeholder="Option label"
														/>
														{#if !readOnly}
															<button
																type="button"
																class="field-inline-remove"
																disabled={field.options.length === 1}
																onclick={() => removeOption(field, optionIndex)}
																aria-label="Remove option"
															>
																<Trash2Icon class="size-3" />
															</button>
														{/if}
													</div>
												{/each}
											</div>
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
			box-shadow 160ms ease,
			transform 160ms ease;
	}

	.field-row.is-drop-target {
		border-color: color-mix(in srgb, var(--primary) 50%, var(--border));
	}

	.field-row.is-dragging {
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
	}

	.field-grip {
		display: flex;
		width: 1.75rem;
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
		height: 2.15rem;
		background: color-mix(in srgb, var(--background) 60%, transparent);
		border: 1px solid var(--border);
		padding-left: 0.65rem;
		font-size: 0.85rem;
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
		height: 1.3rem;
		padding: 0 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--muted) 40%, transparent);
		font-size: 0.64rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: color-mix(in srgb, var(--muted-foreground) 90%, var(--foreground));
		text-transform: uppercase;
	}

	.field-type-pill.is-required {
		border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
		background: color-mix(in srgb, var(--primary) 14%, transparent);
		color: color-mix(in srgb, var(--primary) 80%, var(--foreground));
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
		width: 1.7rem;
		height: 0.95rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--muted-foreground) 25%, var(--border));
		transition: background 180ms ease;
	}

	.switch-thumb {
		position: absolute;
		top: 0.1rem;
		left: 0.1rem;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 999px;
		background: var(--background);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
		transition: transform 180ms ease;
	}

	.required-switch input:checked ~ .switch-track {
		background: color-mix(in srgb, var(--primary) 85%, transparent);
	}

	.required-switch input:checked ~ .switch-track .switch-thumb {
		transform: translateX(0.75rem);
	}

	.required-switch input:focus-visible ~ .switch-track {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent);
	}

	.switch-label {
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		color: var(--muted-foreground);
	}

	.field-delete {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.65rem;
		height: 1.65rem;
		border-radius: 0.4rem;
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
</style>
