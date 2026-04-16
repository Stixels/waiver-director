<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import RichTextEditor from '$lib/components/waivers/RichTextEditor.svelte';
	import { DragDropProvider } from '@dnd-kit/svelte';
	import { createSortable, isSortable } from '@dnd-kit/svelte/sortable';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
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

	const fieldTypeChips: { type: WaiverFieldType; icon: string; label: string }[] = [
		{ type: 'shortText', icon: 'T', label: 'Text' },
		{ type: 'longText', icon: '¶', label: 'Long' },
		{ type: 'checkbox', icon: '☐', label: 'Check' },
		{ type: 'select', icon: '⌵', label: 'Select' },
		{ type: 'date', icon: '◫', label: 'Date' }
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

		const nextFields = [...draft.fields];
		const [field] = nextFields.splice(fromIndex, 1);
		if (!field) return;

		nextFields.splice(toIndex, 0, field);
		draft.fields = nextFields;
	}

	function moveField(index: number, direction: -1 | 1) {
		if (!draft || readOnly) return;

		const nextIndex = index + direction;
		reorderFields(index, nextIndex);
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
	<div class="space-y-7">
		<div class="space-y-4">
			<div class="space-y-2">
				<label
					class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
					for="waiver-title"
				>
					Waiver title
				</label>
				<Input id="waiver-title" bind:value={draft.title} maxlength={120} disabled={readOnly} />
			</div>

			<div class="space-y-2">
				<label
					class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
					for="waiver-intro"
				>
					Waiver copy
				</label>
				<p class="text-sm text-muted-foreground">
					Write the waiver text exactly as guests should read it before signing.
				</p>
				<RichTextEditor
					id="waiver-intro"
					bind:value={draft.introCopy}
					disabled={readOnly}
					placeholder="Write the main waiver copy guests should read before signing."
				/>
			</div>
		</div>

		<div class="space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
						Custom fields
					</p>
					<p class="mt-0.5 text-xs text-muted-foreground/70">
						Add questions that appear before the signature section. Full name, email, date of birth,
						and signature are always collected. Drag the grip handle to reorder.
					</p>
				</div>

				<div class="flex flex-wrap gap-1.5">
					{#each fieldTypeChips as chip (chip.type)}
						<button
							type="button"
							class="flex h-9 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
							onclick={() => addField(chip.type)}
							disabled={readOnly}
						>
							<span class="font-mono text-[11px]">{chip.icon}</span>
							{chip.label}
						</button>
					{/each}
				</div>
			</div>

			{#if draft.fields.length === 0}
				<div
					class="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground"
				>
					No custom fields yet. Use the chips above to add the first question.
				</div>
			{:else}
				<DragDropProvider onDragEnd={handleFieldDragEnd}>
					<div class="space-y-3">
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
							<div
								{@attach sortable.attach}
								class="flex w-full min-w-0 overflow-hidden rounded-xl border bg-card transition-shadow {sortable.isDragging ||
								sortable.isDropTarget
									? 'border-primary/60'
									: 'border-border'} {sortable.isDragging ? 'shadow-lg' : ''}"
							>
								<!-- Full-height drag strip -->
								{#if !readOnly}
									<button
										type="button"
										{@attach sortable.attachHandle}
										class="flex w-7 shrink-0 cursor-grab items-center justify-center border-r border-border bg-muted/30 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground active:cursor-grabbing"
										aria-label="Drag to reorder field"
										title="Drag to reorder"
									>
										<GripVerticalIcon class="size-3.5" />
									</button>
								{/if}

								<div class="min-w-0 flex-1 px-3 py-3">
									<div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
										<span class="text-xs font-semibold text-foreground/70">
											{formatFieldTypeLabel(field.type)}
										</span>

										{#if !readOnly}
											<div class="flex items-center gap-1">
												<button
													type="button"
													class="flex h-6 w-6 items-center justify-center rounded border border-border text-sm text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
													disabled={index === 0}
													onclick={() => moveField(index, -1)}
													aria-label="Move field up"
												>
													↑
												</button>
												<button
													type="button"
													class="flex h-6 w-6 items-center justify-center rounded border border-border text-sm text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
													disabled={index === draft.fields.length - 1}
													onclick={() => moveField(index, 1)}
													aria-label="Move field down"
												>
													↓
												</button>
												<button
													type="button"
													class="flex h-6 items-center rounded border border-border px-2 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
													onclick={() => removeField(index)}
												>
													Remove
												</button>
											</div>
										{/if}
									</div>

									<div class="grid gap-3 md:grid-cols-2">
										<div class="space-y-1.5">
											<label
												for={`${field.id}-label`}
												class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
											>
												Label
											</label>
											<Input
												id={`${field.id}-label`}
												bind:value={field.label}
												maxlength={120}
												disabled={readOnly}
											/>
										</div>

										<div class="space-y-1.5">
											<p
												class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
											>
												Required
											</p>
											<label
												class="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-xs hover:bg-muted/30"
												class:cursor-default={readOnly}
											>
												<input
													type="checkbox"
													bind:checked={field.required}
													class="size-3.5"
													disabled={readOnly}
												/>
												<span>Require an answer</span>
											</label>
										</div>
									</div>

									{#if field.type === 'shortText' || field.type === 'longText'}
										<div class="mt-3 space-y-1.5">
											<label
												for={`${field.id}-placeholder`}
												class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
											>
												Placeholder
											</label>
											<Input
												id={`${field.id}-placeholder`}
												bind:value={field.placeholder}
												maxlength={120}
												disabled={readOnly}
											/>
										</div>
									{/if}

									{#if field.type === 'select'}
										<div class="mt-3 space-y-2.5">
											<div class="flex items-center justify-between gap-3">
												<p
													class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
												>
													Options
												</p>
												{#if !readOnly}
													<Button
														type="button"
														variant="outline"
														size="sm"
														onclick={() => addOption(field)}
													>
														Add option
													</Button>
												{/if}
											</div>

											<div class="space-y-2">
												{#each field.options as option, optionIndex (option.id)}
													<div class="flex gap-2">
														<Input
															id={`${field.id}-option-${optionIndex}`}
															bind:value={option.label}
															maxlength={80}
															disabled={readOnly}
														/>
														{#if !readOnly}
															<Button
																type="button"
																variant="outline"
																size="sm"
																onclick={() => removeOption(field, optionIndex)}
																disabled={field.options.length === 1}
															>
																Remove
															</Button>
														{/if}
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</div>
								<!-- end content wrapper -->
							</div>
							<!-- end flex card -->
						{/each}
					</div>
				</DragDropProvider>
			{/if}
		</div>
	</div>
{:else}
	<div
		class="flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center"
	>
		<div
			class="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="text-muted-foreground/40"
			>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
			</svg>
		</div>
		<p class="text-sm text-muted-foreground">Create or select a template to begin editing.</p>
	</div>
{/if}
