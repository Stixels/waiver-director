<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import TextAlign from '@tiptap/extension-text-align';
	import Underline from '@tiptap/extension-underline';
	import StarterKit from '@tiptap/starter-kit';
	import AlignCenterIcon from '@lucide/svelte/icons/align-center';
	import AlignJustifyIcon from '@lucide/svelte/icons/align-justify';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import AlignRightIcon from '@lucide/svelte/icons/align-right';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
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
	import { sanitizeRichTextHtml } from '$lib/utils/rich-text';

	interface Props {
		value?: string;
		id?: string;
		disabled?: boolean;
		placeholder?: string;
	}

	type TextAlignValue = 'left' | 'center' | 'right' | 'justify';
	const headingLevels = [1, 2, 3, 4, 5, 6] as const;

	let {
		value = $bindable('<p></p>'),
		id = 'rich-text-editor',
		disabled = false,
		placeholder = 'Write the waiver copy guests should read before signing.'
	}: Props = $props();

	let editorElement = $state<HTMLDivElement | null>(null);
	let editor = $state<Editor | null>(null);
	let hasFocus = $state(false);
	let toolbarState = $state({
		blockShortLabel: 'Text',
		alignment: 'left' as TextAlignValue,
		bold: false,
		italic: false,
		underline: false,
		strike: false,
		bulletList: false,
		orderedList: false,
		link: false
	});

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

	function syncToolbarState(sourceEditor: Editor | null) {
		if (!sourceEditor) {
			toolbarState = {
				blockShortLabel: 'Text',
				alignment: 'left',
				bold: false,
				italic: false,
				underline: false,
				strike: false,
				bulletList: false,
				orderedList: false,
				link: false
			};
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

		toolbarState = {
			blockShortLabel,
			alignment,
			bold: sourceEditor.isActive('bold'),
			italic: sourceEditor.isActive('italic'),
			underline: sourceEditor.isActive('underline'),
			strike: sourceEditor.isActive('strike'),
			bulletList: sourceEditor.isActive('bulletList'),
			orderedList: sourceEditor.isActive('orderedList'),
			link: sourceEditor.isActive('link')
		};
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
						'waiver-editor min-h-[260px] rounded-lg bg-background px-4 py-3 text-sm leading-7 text-foreground outline-none'
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

		const handleSelectionUpdate = () => syncToolbarState(instance);
		const handleTransaction = () => syncToolbarState(instance);
		instance.on('selectionUpdate', handleSelectionUpdate);
		instance.on('transaction', handleTransaction);

		return () => {
			instance.off('selectionUpdate', handleSelectionUpdate);
			instance.off('transaction', handleTransaction);
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
						<button type="button" class="toolbar-select" disabled={!editor || disabled}>
							<span class="toolbar-select-label">{toolbarState.blockShortLabel}</span>
							<ChevronDownIcon />
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
						<button type="button" class="toolbar-select" disabled={!editor || disabled}>
							{#if toolbarState.alignment === 'center'}
								<AlignCenterIcon />
							{:else if toolbarState.alignment === 'right'}
								<AlignRightIcon />
							{:else if toolbarState.alignment === 'justify'}
								<AlignJustifyIcon />
							{:else}
								<AlignLeftIcon />
							{/if}
							<ChevronDownIcon />
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
					disabled={!canCommand((editor) => editor.can().chain().focus().toggleBulletList().run())}
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
					disabled={!canCommand((editor) => editor.can().chain().focus().toggleOrderedList().run())}
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

	<div
		class="shrink-0 border-t border-border bg-muted/10 px-4 py-2 text-[11px] text-muted-foreground"
	>
		Use simple formatting for legal copy: emphasis, lists, and links.
	</div>
</div>

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
		align-items: center;
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

	.toolbar-select:hover {
		background: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.toolbar-select:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.toolbar-select-label {
		min-width: 2rem;
		text-align: left;
	}

	:global(.waiver-editor p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--muted-foreground);
		opacity: 0.7;
		pointer-events: none;
		height: 0;
	}

	:global(.waiver-editor p) {
		margin: 0 0 0.875rem;
	}

	:global(.waiver-editor h1),
	:global(.waiver-editor h2),
	:global(.waiver-editor h3),
	:global(.waiver-editor h4),
	:global(.waiver-editor h5),
	:global(.waiver-editor h6) {
		margin: 1.25rem 0 0.75rem;
		font-weight: 700;
		line-height: 1.2;
	}

	:global(.waiver-editor h1) {
		font-size: 1.875rem;
	}

	:global(.waiver-editor h2) {
		font-size: 1.5rem;
	}

	:global(.waiver-editor h3) {
		font-size: 1.25rem;
	}

	:global(.waiver-editor h4) {
		font-size: 1.125rem;
	}

	:global(.waiver-editor h5),
	:global(.waiver-editor h6) {
		font-size: 1rem;
	}

	:global(.waiver-editor ul),
	:global(.waiver-editor ol) {
		margin: 0 0 0.875rem;
		padding-left: 1.25rem;
	}

	:global(.waiver-editor a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	:global(.waiver-editor img[data-email-image='true']) {
		border-radius: 0.75rem;
	}

	:global(.waiver-editor p[data-email-button='true']) {
		margin: 0 0 1rem;
	}

	:global(.waiver-editor strong) {
		font-weight: 700;
	}

	:global(.waiver-editor em) {
		font-style: italic;
	}

	:global(.waiver-editor.ProseMirror) {
		outline: none;
	}

	:global(.waiver-editor .ProseMirror-selectednode) {
		outline: 2px solid color-mix(in srgb, var(--ring) 55%, transparent);
		outline-offset: 2px;
	}

	:global(.waiver-editor.ProseMirror[contenteditable='false']) {
		opacity: 0.8;
	}
</style>
