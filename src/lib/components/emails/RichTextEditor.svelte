<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor, mergeAttributes } from '@tiptap/core';
	import Image from '@tiptap/extension-image';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import TextAlign from '@tiptap/extension-text-align';
	import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
	import Underline from '@tiptap/extension-underline';
	import StarterKit from '@tiptap/starter-kit';
	import { toast } from 'svelte-sonner';
	import AlignCenterIcon from '@lucide/svelte/icons/text-align-center';
	import AlignJustifyIcon from '@lucide/svelte/icons/text-align-justify';
	import AlignLeftIcon from '@lucide/svelte/icons/text-align-start';
	import AlignRightIcon from '@lucide/svelte/icons/text-align-end';
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
	import XIcon from '@lucide/svelte/icons/x';
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
		label?: string;
		class?: string;
		disabled?: boolean;
		placeholder?: string;
		workspaceLogoUrl?: string | null;
		workspaceName?: string;
	}

	const LOGO_SIZE_PRESETS = [
		{ label: 'Small', value: '25%' },
		{ label: 'Medium', value: '50%' },
		{ label: 'Full', value: '100%' }
	] as const;
	type LogoSizeValue = (typeof LOGO_SIZE_PRESETS)[number]['value'];

	const LOGO_ALIGN_PRESETS = [
		{ label: 'Left', value: 'left' },
		{ label: 'Center', value: 'center' },
		{ label: 'Right', value: 'right' }
	] as const;
	type LogoAlignValue = (typeof LOGO_ALIGN_PRESETS)[number]['value'];

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
		image: false,
		imageWidth: null as LogoSizeValue | null,
		fontFamily: null as string | null,
		fontFamilyLabel: DEFAULT_FONT_LABEL,
		fontSize: null as string | null,
		fontSizeLabel: DEFAULT_SIZE_LABEL
	};

	let {
		value = $bindable('<p></p>'),
		id = 'rich-text-editor',
		label = undefined,
		class: className = '',
		disabled = false,
		placeholder = 'Write your content here...',
		workspaceLogoUrl = null,
		workspaceName = ''
	}: Props = $props();

	let editorWrapper = $state<HTMLDivElement | null>(null);
	let editorElement = $state<HTMLDivElement | null>(null);
	let editor = $state<Editor | null>(null);
	let hasFocus = $state(false);
	let htmlDialogOpen = $state(false);
	let htmlSnippet = $state('');
	let toolbarState = $state(DEFAULT_TOOLBAR_STATE);
	let alignmentMenuOpen = $state(false);
	let imagePopoverPosition = $state<{
		top: number;
		left: number;
		placement: 'top' | 'bottom';
	} | null>(null);

	function currentHtml() {
		return sanitizeRichTextHtml(value) || '<p></p>';
	}

	function applyEditorValue(nextValue: string) {
		const sanitized = sanitizeRichTextHtml(nextValue);
		value = sanitized;
	}

	function normalizeImageWidth(value: unknown): LogoSizeValue | null {
		if (typeof value !== 'string') return null;
		const width = value.trim();
		return LOGO_SIZE_PRESETS.some((preset) => preset.value === width)
			? (width as LogoSizeValue)
			: null;
	}

	function normalizeImageAlign(value: unknown): LogoAlignValue {
		if (typeof value !== 'string') return 'center';
		const align = value.trim().toLowerCase();
		return LOGO_ALIGN_PRESETS.some((preset) => preset.value === align)
			? (align as LogoAlignValue)
			: 'center';
	}

	function alignmentMarginStyle(align: LogoAlignValue): string {
		if (align === 'left') return 'margin-left:0;margin-right:auto;';
		if (align === 'right') return 'margin-left:auto;margin-right:0;';
		return 'margin-left:auto;margin-right:auto;';
	}

	function parseAlignFromMargins(
		marginLeft: string | null | undefined,
		marginRight: string | null | undefined
	): LogoAlignValue {
		const left = (marginLeft ?? '').trim().toLowerCase();
		const right = (marginRight ?? '').trim().toLowerCase();
		if ((left === '0px' || left === '0') && right === 'auto') return 'left';
		if (left === 'auto' && (right === '0px' || right === '0')) return 'right';
		if (right === '0px' || right === '0') {
			return left === 'auto' ? 'right' : 'left';
		}
		if (left === '0' && right === 'auto') return 'left';
		if (left === 'auto' && right === '0') return 'right';
		return 'center';
	}

	const EmailImage = Image.extend({
		addAttributes() {
			return {
				...this.parent?.(),
				width: {
					default: null,
					parseHTML: (element: HTMLElement) =>
						normalizeImageWidth(element.getAttribute('width') ?? element.style.width),
					renderHTML: (attributes: Record<string, unknown>) => {
						const width = normalizeImageWidth(attributes.width);
						const align = normalizeImageAlign(attributes.align);
						const widthStyle = width ? `width:${width};` : '';
						return {
							...(width ? { width } : {}),
							style: `${widthStyle}max-width:100%;height:auto;display:block;${alignmentMarginStyle(align)}`
						};
					}
				},
				align: {
					default: 'center',
					parseHTML: (element: HTMLElement) =>
						parseAlignFromMargins(element.style.marginLeft, element.style.marginRight),
					renderHTML: () => ({})
				}
			};
		},
		renderHTML({ HTMLAttributes }) {
			return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
		}
	});

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

	export function insertWorkspaceLogo(logoUrl: string | null = workspaceLogoUrl) {
		insertLogo(logoUrl);
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

	function insertLogo(logoUrl: string | null = workspaceLogoUrl) {
		if (!editor || disabled || !logoUrl) return;
		editor
			.chain()
			.focus()
			.setImage({
				src: logoUrl,
				alt: workspaceName ? `${workspaceName} logo` : 'Logo'
			})
			.updateAttributes('image', { width: LOGO_SIZE_PRESETS[2].value })
			.run();
	}

	function setSelectedImageWidth(width: LogoSizeValue) {
		if (!editor || disabled) return;
		editor.chain().focus().updateAttributes('image', { width }).run();
	}

	function updateImagePopoverPosition(sourceEditor: Editor | null) {
		if (!sourceEditor || !editorWrapper || !sourceEditor.isActive('image')) {
			imagePopoverPosition = null;
			return;
		}

		const { from } = sourceEditor.state.selection;
		const dom = sourceEditor.view.nodeDOM(from);
		const image =
			dom instanceof HTMLImageElement
				? dom
				: dom instanceof HTMLElement
					? dom.querySelector('img')
					: null;
		if (!image) {
			imagePopoverPosition = null;
			return;
		}

		const wrapperRect = editorWrapper.getBoundingClientRect();
		const imageRect = image.getBoundingClientRect();
		if (imageRect.bottom < wrapperRect.top || imageRect.top > wrapperRect.bottom) {
			imagePopoverPosition = null;
			return;
		}

		const estimatedPopoverHalfWidth = 142;
		const minLeft = estimatedPopoverHalfWidth + 8;
		const maxLeft = Math.max(minLeft, window.innerWidth - estimatedPopoverHalfWidth - 8);
		const centeredLeft = imageRect.left + imageRect.width / 2;
		const left = Math.min(maxLeft, Math.max(minLeft, centeredLeft));

		const topAbove = imageRect.top - 10;
		const topBelow = imageRect.bottom + 10;
		const placement = topAbove > Math.max(wrapperRect.top, 56) + 38 ? 'top' : 'bottom';

		imagePopoverPosition = {
			left,
			top: placement === 'top' ? topAbove : topBelow,
			placement
		};
	}

	function removeSelectedImage() {
		if (!editor || disabled) return;
		editor.chain().focus().deleteSelection().run();
	}

	function setAlignment(alignment: TextAlignValue) {
		if (!editor || disabled) return;
		if (editor.isActive('image')) {
			if (alignment === 'justify') return;
			editor.chain().focus().updateAttributes('image', { align: alignment }).run();
			return;
		}
		editor.chain().focus().setTextAlign(alignment).run();
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
			imagePopoverPosition = null;
			return;
		}

		let blockShortLabel = 'Text';
		for (let level = 1; level <= 6; level += 1) {
			if (sourceEditor.isActive('heading', { level })) {
				blockShortLabel = `H${level}`;
				break;
			}
		}

		const imageActive = sourceEditor.isActive('image');
		const imageAttrs = imageActive ? sourceEditor.getAttributes('image') : null;
		const imageWidth = normalizeImageWidth(imageAttrs?.width);
		const imageAlign = normalizeImageAlign(imageAttrs?.align);
		const textAlignment = (['center', 'right', 'justify'].find((value) =>
			sourceEditor.isActive({ textAlign: value })
		) ?? 'left') as TextAlignValue;
		const alignment: TextAlignValue = imageActive ? imageAlign : textAlignment;

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
			image: imageActive,
			imageWidth,
			fontFamily,
			fontFamilyLabel: activeFontFamilyLabel(fontFamily, computedStyle?.fontFamily),
			fontSize,
			fontSizeLabel: readableFontSize(fontSize ?? computedStyle?.fontSize)
		};

		updateImagePopoverPosition(sourceEditor);
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
				EmailImage.configure({
					inline: false,
					allowBase64: false,
					HTMLAttributes: {
						class: 'rich-text-image'
					}
				}),
				Placeholder.configure({
					placeholder
				})
			],
			editorProps: {
				attributes: {
					id,
					class:
						'rich-text-editor-body min-h-[300px] bg-transparent text-sm leading-7 text-foreground outline-none'
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

		const handleReposition = () => updateImagePopoverPosition(instance);
		window.addEventListener('resize', handleReposition);
		editorWrapper?.addEventListener('scroll', handleReposition);

		return () => {
			window.removeEventListener('resize', handleReposition);
			editorWrapper?.removeEventListener('scroll', handleReposition);
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
	class={`flex flex-col overflow-hidden border-t border-border/70 bg-background transition-shadow ${className}`}
	class:border-ring={hasFocus}
	class:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]={hasFocus}
	class:border-border={!hasFocus}
>
	<div
		class="order-first flex shrink-0 flex-col gap-2 border-b border-border/70 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
	>
		{#if label}
			<label for={id} class="editor-label">{label}</label>
		{/if}
		<div
			class="editor-toolbar flex min-w-0 flex-wrap items-center gap-1 sm:justify-end"
			role="toolbar"
			aria-label="Rich text formatting"
			tabindex="-1"
			onmousedown={keepToolbarFocus}
		>
			<DropdownMenu>
				<DropdownMenuTrigger class="inline-flex">
					<button
						type="button"
						class="toolbar-select toolbar-select-block"
						disabled={!editor || disabled}
					>
						<span class="toolbar-select-label">{toolbarState.blockShortLabel}</span>
						<ChevronDownIcon class="size-3" />
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

			<DropdownMenu bind:open={alignmentMenuOpen}>
				<DropdownMenuTrigger class="inline-flex">
					<button
						type="button"
						class="toolbar-button"
						disabled={!editor || disabled}
						aria-label="Alignment"
					>
						{#if toolbarState.alignment === 'center'}
							<AlignCenterIcon class="size-3.5" />
						{:else if toolbarState.alignment === 'right'}
							<AlignRightIcon class="size-3.5" />
						{:else if toolbarState.alignment === 'justify'}
							<AlignJustifyIcon class="size-3.5" />
						{:else}
							<AlignLeftIcon class="size-3.5" />
						{/if}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" class="w-40">
					<DropdownMenuItem
						class={toolbarState.alignment === 'left' ? 'font-semibold' : undefined}
						onclick={() => setAlignment('left')}
					>
						<AlignLeftIcon class="size-4" />
						<span>Left</span>
					</DropdownMenuItem>
					<DropdownMenuItem
						class={toolbarState.alignment === 'center' ? 'font-semibold' : undefined}
						onclick={() => setAlignment('center')}
					>
						<AlignCenterIcon class="size-4" />
						<span>Center</span>
					</DropdownMenuItem>
					<DropdownMenuItem
						class={toolbarState.alignment === 'right' ? 'font-semibold' : undefined}
						onclick={() => setAlignment('right')}
					>
						<AlignRightIcon class="size-4" />
						<span>Right</span>
					</DropdownMenuItem>
					<DropdownMenuItem
						class={toolbarState.alignment === 'justify' ? 'font-semibold' : undefined}
						disabled={toolbarState.image}
						onclick={() => setAlignment('justify')}
					>
						<AlignJustifyIcon class="size-4" />
						<span>Justify</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<DropdownMenu>
				<DropdownMenuTrigger class="inline-flex">
					<button
						type="button"
						class="toolbar-select toolbar-select-font"
						disabled={!editor || disabled}
					>
						<span class="toolbar-select-label toolbar-select-label-plain">
							{toolbarState.fontFamilyLabel}
						</span>
						<ChevronDownIcon class="size-3" />
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

			<DropdownMenu>
				<DropdownMenuTrigger class="inline-flex">
					<button
						type="button"
						class="toolbar-select toolbar-select-size"
						disabled={!editor || disabled}
					>
						<span class="toolbar-select-label toolbar-select-label-plain">
							{toolbarState.fontSizeLabel}
						</span>
						<ChevronDownIcon class="size-3" />
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

			<span class="toolbar-divider"></span>

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
				<BoldIcon class="size-3.5" />
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
				<ItalicIcon class="size-3.5" />
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
				<UnderlineIcon class="size-3.5" />
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
				<StrikethroughIcon class="size-3.5" />
			</button>

			<span class="toolbar-divider"></span>

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
				<ListIcon class="size-3.5" />
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
				<ListOrderedIcon class="size-3.5" />
			</button>

			<span class="toolbar-divider"></span>

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
				<LinkIcon class="size-3.5" />
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

			<span class="toolbar-divider"></span>

			<button
				type="button"
				class="toolbar-button"
				disabled={!editor || disabled}
				aria-label="Insert HTML"
				title="Insert HTML"
				onclick={openHtmlDialog}
			>
				<CodeIcon class="size-3.5" />
			</button>
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
				<RemoveFormattingIcon class="size-3.5" />
			</button>
		</div>
	</div>

	<div
		bind:this={editorWrapper}
		class="rich-text-editor-viewport min-h-[300px] overflow-y-auto overscroll-y-contain px-4 py-4"
		role="region"
		aria-label="Rich text editing area"
	>
		<div bind:this={editorElement}></div>
	</div>
</div>

{#if toolbarState.image && imagePopoverPosition && !alignmentMenuOpen}
	<div
		class="image-popover"
		data-placement={imagePopoverPosition.placement}
		style="top:{imagePopoverPosition.top}px;left:{imagePopoverPosition.left}px"
		role="toolbar"
		aria-label="Image controls"
		tabindex="-1"
		onmousedown={keepToolbarFocus}
	>
		<div class="image-popover-group" role="group" aria-label="Image size">
			{#each LOGO_SIZE_PRESETS as preset (preset.value)}
				{@const isActive = toolbarState.imageWidth === preset.value}
				<button
					type="button"
					class="image-popover-btn image-popover-btn-text"
					class:is-active={isActive}
					aria-pressed={isActive}
					disabled={!editor || disabled}
					title={`${preset.label} image`}
					onclick={() => setSelectedImageWidth(preset.value)}
				>
					{preset.label}
				</button>
			{/each}
		</div>
		<span class="image-popover-divider" aria-hidden="true"></span>
		<button
			type="button"
			class="image-popover-btn is-destructive"
			disabled={!editor || disabled}
			onclick={removeSelectedImage}
			aria-label="Remove image"
			title="Remove image"
		>
			<XIcon class="size-3.5" />
		</button>
	</div>
{/if}

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

	.editor-label {
		flex-shrink: 0;
		font-size: 0.63rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
		user-select: none;
	}

	@media (max-width: 760px) {
		:global(.rich-text-editor-body) {
			min-height: 260px;
		}

		.rich-text-editor-viewport {
			min-height: 260px;
			max-height: none;
		}
	}

	.toolbar-button {
		display: inline-flex;
		height: 1.85rem;
		width: 1.85rem;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		color: var(--muted-foreground);
		transition:
			background-color 150ms ease,
			color 150ms ease,
			box-shadow 150ms ease;
	}

	.toolbar-button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--muted) 80%, transparent);
		color: var(--foreground);
	}

	.toolbar-button.is-active {
		background: color-mix(in srgb, var(--primary) 18%, transparent);
		color: color-mix(in srgb, var(--primary) 80%, var(--foreground));
	}

	.toolbar-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.toolbar-select {
		display: inline-flex;
		height: 1.85rem;
		align-items: center;
		gap: 0.25rem;
		border-radius: var(--radius-md);
		padding: 0 0.55rem;
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--foreground);
		transition:
			background-color 150ms ease,
			color 150ms ease;
		white-space: nowrap;
	}

	.toolbar-select-block {
		min-width: 0;
	}

	.toolbar-select-font {
		width: 7rem;
		justify-content: space-between;
	}

	.toolbar-select-size {
		width: 4.5rem;
		justify-content: space-between;
	}

	.toolbar-select:hover:not(:disabled) {
		background: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.toolbar-select:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.toolbar-select-label {
		min-width: 1.4rem;
		overflow: hidden;
		text-align: left;
		text-overflow: ellipsis;
		font-variant: all-small-caps;
		letter-spacing: 0.03em;
	}

	.toolbar-select-label-plain {
		font-variant: normal;
		letter-spacing: 0;
	}

	.toolbar-divider {
		display: inline-block;
		width: 1px;
		height: 1rem;
		margin: 0 0.1rem;
		background: var(--border);
		flex: 0 0 1px;
	}

	.image-popover {
		position: fixed;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--popover);
		color: var(--popover-foreground);
		box-shadow:
			0 12px 28px -14px rgb(0 0 0 / 0.55),
			0 2px 8px -4px rgb(0 0 0 / 0.4);
		z-index: 80;
		white-space: nowrap;
		transform: translate(-50%, -100%);
	}

	.image-popover[data-placement='bottom'] {
		transform: translate(-50%, 0);
	}

	.image-popover-group {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
	}

	.image-popover-divider {
		width: 1px;
		height: 1rem;
		background: var(--border);
		flex: 0 0 1px;
	}

	.image-popover-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.55rem;
		height: 1.55rem;
		border-radius: var(--radius-xs);
		color: var(--muted-foreground);
		font-size: 0.68rem;
		font-weight: 600;
		line-height: 1;
		transition:
			color 120ms ease,
			background 120ms ease,
			box-shadow 120ms ease;
	}

	.image-popover-btn-text {
		padding-inline: 0.4rem;
	}

	.image-popover-btn:hover:not(:disabled) {
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	.image-popover-btn.is-active {
		color: var(--foreground);
		background: color-mix(in srgb, var(--primary) 16%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, var(--border));
	}

	.image-popover-btn.is-destructive {
		color: var(--destructive);
		font-size: 1rem;
		font-weight: 500;
	}

	.image-popover-btn.is-destructive:hover:not(:disabled) {
		color: var(--destructive);
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
	}

	.image-popover-btn:disabled {
		opacity: 0.5;
	}

	:global(.rich-text-editor-body img.rich-text-image) {
		max-width: 100%;
		height: auto;
		display: block;
		margin: 0.5rem auto;
		border-radius: 4px;
	}

	:global(.rich-text-editor-body img.rich-text-image.ProseMirror-selectednode) {
		outline: 2px solid color-mix(in srgb, var(--primary) 60%, transparent);
		outline-offset: 2px;
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
