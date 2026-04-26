<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import TextAlign from '@tiptap/extension-text-align';
	import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
	import Underline from '@tiptap/extension-underline';
	import StarterKit from '@tiptap/starter-kit';
	import { toast } from 'svelte-sonner';
	import AlignCenterIcon from '@lucide/svelte/icons/align-center';
	import AlignJustifyIcon from '@lucide/svelte/icons/align-justify';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import AlignRightIcon from '@lucide/svelte/icons/align-right';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CodeIcon from '@lucide/svelte/icons/code';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import LinkIcon from '@lucide/svelte/icons/link';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import RemoveFormattingIcon from '@lucide/svelte/icons/remove-formatting';
	import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
	import UnderlineIcon from '@lucide/svelte/icons/underline';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { sanitizeRichTextHtml } from '$lib/utils/rich-text';

	interface Props {
		value?: string;
		id?: string;
		disabled?: boolean;
		placeholder?: string;
	}

	type TextAlignValue = 'left' | 'center' | 'right' | 'justify';
	const headingLevels = [1, 2, 3, 4, 5, 6] as const;
	const DEFAULT_FONT_LABEL = 'System';
	const DEFAULT_SIZE_LABEL = '14';
	const DEFAULT_OPTION_LABEL = 'Default';
	const DEFAULT_TOOLBAR_STATE = {
		blockShortLabel: 'Text',
		alignment: 'left' as TextAlignValue,
		bold: false,
		italic: false,
		underline: false,
		strike: false,
		bulletList: false,
		orderedList: false,
		link: false,
		fontFamily: null as string | null,
		fontFamilyLabel: DEFAULT_FONT_LABEL,
		fontSize: null as string | null,
		fontSizeLabel: DEFAULT_SIZE_LABEL
	};

	let {
		value = $bindable('<p></p>'),
		id = 'rich-text-editor',
		disabled = false,
		placeholder = 'Write your content here...'
	}: Props = $props();

	let editorElement = $state<HTMLDivElement | null>(null);
	let editor = $state<Editor | null>(null);
	let hasFocus = $state(false);
	let htmlDialogOpen = $state(false);
	let htmlSnippet = $state('');
	let toolbarState = $state(DEFAULT_TOOLBAR_STATE);

	function currentHtml() {
		return sanitizeRichTextHtml(value) || '<p></p>';
	}

	function applyEditorValue(nextValue: string) {
		const sanitized = sanitizeRichTextHtml(nextValue);
		value = sanitized;
	}

	function command(action: (editor: Editor) => boolean) {
		if (!editor || disabled) return;
		action(editor);
	}

	function canCommand(action: (editor: Editor) => boolean) {
		if (!editor || disabled) return false;
		return action(editor);
	}

	function keepToolbarFocus(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;
		if (!target.closest('button')) return;
		event.preventDefault();
	}

	export function insertText(text: string) {
		editor?.chain().focus().insertContent(text).run();
	}

	const FONT_FAMILIES = [
		{ label: DEFAULT_OPTION_LABEL, value: null },
		{ label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
		{ label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
		{ label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
		{ label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
		{ label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
		{ label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
		{ label: 'Courier New', value: '"Courier New", Courier, monospace' }
	] as const;

	const FONT_SIZES = [
		{ label: DEFAULT_OPTION_LABEL, value: null },
		{ label: '12', value: '12px' },
		{ label: '14', value: '14px' },
		{ label: '16', value: '16px' },
		{ label: '18', value: '18px' },
		{ label: '20', value: '20px' },
		{ label: '24', value: '24px' },
		{ label: '30', value: '30px' },
		{ label: '36', value: '36px' }
	] as const;

	function setLink() {
		if (!editor || disabled) return;

		const previousUrl = editor.getAttributes('link').href ?? 'https://';
		const href = window.prompt('Enter a URL', previousUrl);
		if (href === null) return;

		const trimmed = href.trim();
		if (!trimmed) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
	}

	function openHtmlDialog() {
		if (!editor || disabled) return;
		htmlSnippet = '';
		htmlDialogOpen = true;
	}

	function closeHtmlDialog() {
		htmlDialogOpen = false;
		htmlSnippet = '';
	}

	function insertHtmlSnippet() {
		if (!editor || disabled) return;

		const sanitized = sanitizeRichTextHtml(htmlSnippet);
		if (!sanitized) {
			toast.error('Paste a supported HTML snippet to insert.');
			return;
		}

		editor.chain().focus().insertContent(sanitized).run();
		closeHtmlDialog();
	}

	function normalizeTextStyleValue(value: unknown) {
		return typeof value === 'string' && value.trim() ? value.trim() : null;
	}

	function getSelectionComputedStyle(sourceEditor: Editor) {
		try {
			const { from } = sourceEditor.state.selection;
			const domAtPosition = sourceEditor.view.domAtPos(from).node;
			const element =
				domAtPosition instanceof HTMLElement ? domAtPosition : domAtPosition.parentElement;
			return element ? window.getComputedStyle(element) : null;
		} catch {
			return null;
		}
	}

	function readableFontFamily(value: string | null | undefined) {
		const firstFamily = value?.split(',')[0]?.trim().replaceAll('"', '').replaceAll("'", '');
		if (!firstFamily) return DEFAULT_FONT_LABEL;
		if (
			['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont'].includes(firstFamily)
		) {
			return DEFAULT_FONT_LABEL;
		}
		return firstFamily;
	}

	function readableFontSize(value: string | null | undefined) {
		if (!value) return DEFAULT_SIZE_LABEL;
		const numericSize = Number.parseFloat(value);
		return Number.isFinite(numericSize) ? `${Math.round(numericSize)}` : value.replace(/px$/i, '');
	}

	function syncToolbarState(sourceEditor: Editor | null) {
		if (!sourceEditor) {
			toolbarState = DEFAULT_TOOLBAR_STATE;
			return;
		}

		let blockShortLabel = 'Text';
		for (let level = 1; level <= 6; level += 1) {
			if (sourceEditor.isActive('heading', { level })) {
				blockShortLabel = `H${level}`;
				break;
			}
		}

		const alignment = (['center', 'right', 'justify'].find((value) =>
			sourceEditor.isActive({ textAlign: value })
		) ?? 'left') as TextAlignValue;

		const textStyleAttrs = sourceEditor.getAttributes('textStyle');
		const fontFamily = normalizeTextStyleValue(textStyleAttrs.fontFamily);
		const fontSize = normalizeTextStyleValue(textStyleAttrs.fontSize);
		const computedStyle = getSelectionComputedStyle(sourceEditor);

		toolbarState = {
			blockShortLabel,
			alignment,
			bold: sourceEditor.isActive('bold'),
			italic: sourceEditor.isActive('italic'),
			underline: sourceEditor.isActive('underline'),
			strike: sourceEditor.isActive('strike'),
			bulletList: sourceEditor.isActive('bulletList'),
			orderedList: sourceEditor.isActive('orderedList'),
			link: sourceEditor.isActive('link'),
			fontFamily,
			fontFamilyLabel: activeFontFamilyLabel(fontFamily, computedStyle?.fontFamily),
			fontSize,
			fontSizeLabel: readableFontSize(fontSize ?? computedStyle?.fontSize)
		};
	}

	function setFontFamily(family: string | null) {
		if (!editor || disabled) return;
		if (family) {
			editor.chain().focus().setFontFamily(family).run();
		} else {
			editor.chain().focus().unsetFontFamily().run();
		}
	}

	function setFontSize(size: string | null) {
		if (!editor || disabled) return;
		if (size) {
			editor.chain().focus().setFontSize(size).run();
		} else {
			editor.chain().focus().unsetFontSize().run();
		}
	}

	function activeFontFamilyLabel(value: string | null, fallback?: string | null) {
		if (!value) return readableFontFamily(fallback);
		return (
			FONT_FAMILIES.find((f) => f.value === value)?.label ?? value.split(',')[0].replaceAll('"', '')
		);
	}

	onMount(() => {
		if (!editorElement) {
			return;
		}

		const instance = new Editor({
			element: editorElement,
			content: currentHtml(),
			editable: !disabled,
			extensions: [
				StarterKit.configure({
					dropcursor: false,
					gapcursor: false,
					blockquote: false,
					code: false,
					codeBlock: false,
					hardBreak: false,
					horizontalRule: false
				}),
				Underline,
				TextStyle,
				FontFamily,
				FontSize,
				Link.configure({
					autolink: true,
					defaultProtocol: 'https',
					openOnClick: false
				}),
				TextAlign.configure({
					types: ['heading', 'paragraph']
				}),
				Placeholder.configure({
					placeholder
				})
			],
			editorProps: {
				attributes: {
					id,
					class:
						'rich-text-editor-body min-h-[260px] rounded-lg bg-background px-4 py-3 text-sm leading-7 text-foreground outline-none'
				}
			},
			onCreate: ({ editor }) => {
				syncToolbarState(editor);
			},
			onUpdate: ({ editor }) => {
				applyEditorValue(editor.getHTML());
				syncToolbarState(editor);
			},
			onSelectionUpdate: () => {
				syncToolbarState(instance);
			},
			onTransaction: ({ editor }) => {
				syncToolbarState(editor);
			},
			onFocus: () => {
				hasFocus = true;
				syncToolbarState(instance);
			},
			onBlur: ({ editor }) => {
				hasFocus = false;
				applyEditorValue(editor.getHTML());
				syncToolbarState(editor);
			}
		});

		editor = instance;
		syncToolbarState(instance);

		return () => {
			instance.destroy();
			editor = null;
			syncToolbarState(null);
		};
	});

	$effect(() => {
		if (!editor) return;
		editor.setEditable(!disabled);
	});

	$effect(() => {
		if (!editor) return;
		const sanitized = currentHtml();
		if (sanitizeRichTextHtml(editor.getHTML()) === sanitized) {
			return;
		}
		editor.commands.setContent(sanitized, { emitUpdate: false });
	});
</script>

<div
	class="flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow"
	class:border-ring={hasFocus}
	class:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]={hasFocus}
	class:border-border={!hasFocus}
>
	<div class="shrink-0 border-b border-border bg-muted/20 px-3 py-2">
		<div
			class="editor-toolbar flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1"
			role="toolbar"
			aria-label="Rich text formatting"
			tabindex="-1"
			onmousedown={keepToolbarFocus}
		>
			<div class="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
				<DropdownMenu>
					<DropdownMenuTrigger class="inline-flex">
						<button
							type="button"
							class="toolbar-select toolbar-select-font"
							disabled={!editor || disabled}
						>
							<span class="toolbar-select-label">{toolbarState.blockShortLabel}</span>
							<ChevronDownIcon class="toolbar-select-chevron" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" class="w-44">
						<DropdownMenuItem
							onclick={() => command((editor) => editor.chain().focus().setParagraph().run())}
						>
							Paragraph
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						{#each headingLevels as level (level)}
							<DropdownMenuItem
								class={toolbarState.blockShortLabel === `H${level}` ? 'font-semibold' : undefined}
								onclick={() =>
									command((editor) => editor.chain().focus().toggleHeading({ level }).run())}
							>
								Heading {level}
							</DropdownMenuItem>
						{/each}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div class="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
				<DropdownMenu>
					<DropdownMenuTrigger class="inline-flex">
						<button
							type="button"
							class="toolbar-select toolbar-select-size"
							disabled={!editor || disabled}
						>
							{#if toolbarState.alignment === 'center'}
								<AlignCenterIcon />
							{:else if toolbarState.alignment === 'right'}
								<AlignRightIcon />
							{:else if toolbarState.alignment === 'justify'}
								<AlignJustifyIcon />
							{:else}
								<AlignLeftIcon />
							{/if}
							<ChevronDownIcon class="toolbar-select-chevron" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" class="w-40">
						<DropdownMenuItem
							class={toolbarState.alignment === 'left' ? 'font-semibold' : undefined}
							onclick={() => command((editor) => editor.chain().focus().setTextAlign('left').run())}
						>
							<AlignLeftIcon />
							<span>Left</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							class={toolbarState.alignment === 'center' ? 'font-semibold' : undefined}
							onclick={() =>
								command((editor) => editor.chain().focus().setTextAlign('center').run())}
						>
							<AlignCenterIcon />
							<span>Center</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							class={toolbarState.alignment === 'right' ? 'font-semibold' : undefined}
							onclick={() =>
								command((editor) => editor.chain().focus().setTextAlign('right').run())}
						>
							<AlignRightIcon />
							<span>Right</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							class={toolbarState.alignment === 'justify' ? 'font-semibold' : undefined}
							onclick={() =>
								command((editor) => editor.chain().focus().setTextAlign('justify').run())}
						>
							<AlignJustifyIcon />
							<span>Justify</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div
				class="toolbar-select-group toolbar-select-group-font flex items-center gap-1 rounded-lg border border-border bg-background p-1"
			>
				<DropdownMenu>
					<DropdownMenuTrigger class="inline-flex w-full">
						<button
							type="button"
							class="toolbar-select toolbar-select-font"
							disabled={!editor || disabled}
						>
							<span class="toolbar-select-label">
								{toolbarState.fontFamilyLabel}
							</span>
							<ChevronDownIcon class="toolbar-select-chevron" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" class="w-48">
						{#each FONT_FAMILIES as family (family.label)}
							<DropdownMenuItem
								class={toolbarState.fontFamily === family.value ? 'font-semibold' : undefined}
								onclick={() => setFontFamily(family.value)}
							>
								<span style={family.value ? `font-family: ${family.value}` : undefined}>
									{family.label}
								</span>
							</DropdownMenuItem>
						{/each}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div
				class="toolbar-select-group toolbar-select-group-size flex items-center gap-1 rounded-lg border border-border bg-background p-1"
			>
				<DropdownMenu>
					<DropdownMenuTrigger class="inline-flex w-full">
						<button
							type="button"
							class="toolbar-select toolbar-select-size"
							disabled={!editor || disabled}
						>
							<span class="toolbar-select-label">
								{toolbarState.fontSizeLabel}
							</span>
							<ChevronDownIcon class="toolbar-select-chevron" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" class="w-32">
						{#each FONT_SIZES as size (size.label)}
							<DropdownMenuItem
								class={toolbarState.fontSize === size.value ? 'font-semibold' : undefined}
								onclick={() => setFontSize(size.value)}
							>
								{size.label}
							</DropdownMenuItem>
						{/each}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div class="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
				<button
					type="button"
					class="toolbar-button"
					class:is-active={toolbarState.bold}
					aria-pressed={toolbarState.bold}
					disabled={!canCommand((editor) => editor.can().chain().focus().toggleBold().run())}
					aria-label="Bold"
					title="Bold"
					onclick={() => command((editor) => editor.chain().focus().toggleBold().run())}
				>
					<BoldIcon />
				</button>
				<button
					type="button"
					class="toolbar-button"
					class:is-active={toolbarState.italic}
					aria-pressed={toolbarState.italic}
					disabled={!canCommand((editor) => editor.can().chain().focus().toggleItalic().run())}
					aria-label="Italic"
					title="Italic"
					onclick={() => command((editor) => editor.chain().focus().toggleItalic().run())}
				>
					<ItalicIcon />
				</button>
				<button
					type="button"
					class="toolbar-button"
					class:is-active={toolbarState.underline}
					aria-pressed={toolbarState.underline}
					disabled={!canCommand((editor) => editor.can().chain().focus().toggleUnderline().run())}
					aria-label="Underline"
					title="Underline"
					onclick={() => command((editor) => editor.chain().focus().toggleUnderline().run())}
				>
					<UnderlineIcon />
				</button>
				<button
					type="button"
					class="toolbar-button"
					class:is-active={toolbarState.strike}
					aria-pressed={toolbarState.strike}
					disabled={!canCommand((editor) => editor.can().chain().focus().toggleStrike().run())}
					aria-label="Strike"
					title="Strike"
					onclick={() => command((editor) => editor.chain().focus().toggleStrike().run())}
				>
					<StrikethroughIcon />
				</button>
			</div>

			<div class="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
				<button
					type="button"
					class="toolbar-button"
					class:is-active={toolbarState.bulletList}
					aria-pressed={toolbarState.bulletList}
					disabled={!editor || disabled}
					aria-label="Bulleted list"
					title="Bulleted list"
					onclick={() => command((editor) => editor.chain().focus().toggleBulletList().run())}
				>
					<ListIcon />
				</button>
				<button
					type="button"
					class="toolbar-button"
					class:is-active={toolbarState.orderedList}
					aria-pressed={toolbarState.orderedList}
					disabled={!editor || disabled}
					aria-label="Numbered list"
					title="Numbered list"
					onclick={() => command((editor) => editor.chain().focus().toggleOrderedList().run())}
				>
					<ListOrderedIcon />
				</button>
			</div>

			<div class="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
				<button
					type="button"
					class="toolbar-button"
					class:is-active={toolbarState.link}
					aria-pressed={toolbarState.link}
					disabled={!editor || disabled}
					aria-label="Set link"
					title="Set link"
					onclick={setLink}
				>
					<LinkIcon />
				</button>
				{#if toolbarState.link}
					<button
						type="button"
						class="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
						disabled={!canCommand((editor) => editor.can().chain().focus().unsetLink().run())}
						onclick={() => command((editor) => editor.chain().focus().unsetLink().run())}
					>
						Remove
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
				<button
					type="button"
					class="toolbar-button"
					disabled={!editor || disabled}
					aria-label="Insert HTML"
					title="Insert HTML"
					onclick={openHtmlDialog}
				>
					<CodeIcon />
				</button>
			</div>

			<div class="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
				<button
					type="button"
					class="toolbar-button"
					disabled={!canCommand((editor) =>
						editor.can().chain().focus().unsetAllMarks().clearNodes().run()
					)}
					aria-label="Clear formatting"
					title="Clear formatting"
					onclick={() =>
						command((editor) => editor.chain().focus().unsetAllMarks().clearNodes().run())}
				>
					<RemoveFormattingIcon />
				</button>
			</div>
		</div>
	</div>

	<div
		class="rich-text-editor-viewport min-h-0 shrink-0 overflow-y-auto overscroll-y-contain px-3 py-3"
		role="region"
		aria-label="Rich text editing area"
	>
		<div bind:this={editorElement}></div>
	</div>
</div>

<Dialog bind:open={htmlDialogOpen}>
	<DialogContent class="gap-0 overflow-hidden p-0 sm:max-w-xl">
		<DialogHeader class="border-b border-border px-6 py-4">
			<DialogTitle>Insert HTML</DialogTitle>
			<DialogDescription>
				Paste a snippet. Unsupported tags and attributes are removed before insertion.
			</DialogDescription>
		</DialogHeader>
		<form
			class="space-y-4 px-6 py-5"
			onsubmit={(event) => {
				event.preventDefault();
				insertHtmlSnippet();
			}}
		>
			<Textarea
				bind:value={htmlSnippet}
				class="min-h-48 font-mono text-xs leading-5"
				placeholder="<p>Your email content...</p>"
				{disabled}
			/>
			<DialogFooter>
				<Button type="button" variant="outline" onclick={closeHtmlDialog}>Cancel</Button>
				<Button type="submit" disabled={disabled || !htmlSnippet.trim()}>Insert</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>

<style>
	.rich-text-editor-viewport {
		max-height: min(50vh, 28rem);
	}

	.toolbar-button {
		display: inline-flex;
		height: 1.85rem;
		width: 1.85rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		color: var(--muted-foreground);
		transition:
			background-color 150ms ease,
			color 150ms ease,
			box-shadow 150ms ease,
			border-color 150ms ease;
	}

	.toolbar-button:hover {
		background: color-mix(in srgb, var(--muted) 80%, transparent);
		color: var(--foreground);
	}

	.toolbar-button.is-active {
		background: color-mix(in srgb, var(--muted) 80%, transparent);
		color: var(--foreground);
	}

	.toolbar-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.toolbar-select {
		display: inline-flex;
		height: 1.85rem;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		border-radius: 0.5rem;
		padding: 0 0.45rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--foreground);
		transition:
			background-color 150ms ease,
			color 150ms ease;
		white-space: nowrap;
	}

	.toolbar-select-group {
		flex: 0 0 auto;
	}

	.toolbar-select-group-font {
		width: 7.5rem;
	}

	.toolbar-select-group-size {
		width: 4.75rem;
	}

	.toolbar-select-font {
		min-width: 0;
	}

	.toolbar-select-size {
		min-width: 0;
	}

	.toolbar-select:hover {
		background: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.toolbar-select:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.toolbar-select-label {
		min-width: 2rem;
		overflow: hidden;
		text-align: left;
		text-overflow: ellipsis;
	}

	:global(.toolbar-select-chevron) {
		width: 0.8rem;
		height: 0.8rem;
		flex: 0 0 0.8rem;
	}

	:global(.rich-text-editor-body p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--muted-foreground);
		opacity: 0.7;
		pointer-events: none;
		height: 0;
	}

	:global(.rich-text-editor-body p) {
		margin: 0 0 0.875rem;
	}

	:global(.rich-text-editor-body h1),
	:global(.rich-text-editor-body h2),
	:global(.rich-text-editor-body h3),
	:global(.rich-text-editor-body h4),
	:global(.rich-text-editor-body h5),
	:global(.rich-text-editor-body h6) {
		margin: 1.25rem 0 0.75rem;
		font-weight: 700;
		line-height: 1.2;
	}

	:global(.rich-text-editor-body h1) {
		font-size: 1.875rem;
	}

	:global(.rich-text-editor-body h2) {
		font-size: 1.5rem;
	}

	:global(.rich-text-editor-body h3) {
		font-size: 1.25rem;
	}

	:global(.rich-text-editor-body h4) {
		font-size: 1.125rem;
	}

	:global(.rich-text-editor-body h5),
	:global(.rich-text-editor-body h6) {
		font-size: 1rem;
	}

	:global(.rich-text-editor-body ul),
	:global(.rich-text-editor-body ol) {
		margin: 0 0 0.875rem;
		padding-left: 1.25rem;
	}

	:global(.rich-text-editor-body ul) {
		list-style-type: disc;
	}

	:global(.rich-text-editor-body ol) {
		list-style-type: decimal;
	}

	:global(.rich-text-editor-body li) {
		display: list-item;
		margin: 0.2rem 0;
	}

	:global(.rich-text-editor-body a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	:global(.rich-text-editor-body strong) {
		font-weight: 700;
	}

	:global(.rich-text-editor-body em) {
		font-style: italic;
	}

	:global(.rich-text-editor-body.ProseMirror) {
		outline: none;
	}

	:global(.rich-text-editor-body .ProseMirror-selectednode) {
		outline: 2px solid color-mix(in srgb, var(--ring) 55%, transparent);
		outline-offset: 2px;
	}

	:global(.rich-text-editor-body.ProseMirror[contenteditable='false']) {
		opacity: 0.8;
	}
</style>
