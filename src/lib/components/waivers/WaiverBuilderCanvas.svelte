<script lang="ts">
	import { onMount, tick } from 'svelte';
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
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import CloudCheckIcon from '@lucide/svelte/icons/cloud-check';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import type { WaiverField } from '$lib/domain/waivers';
	import WaiverDocumentShell from '$lib/components/waivers/WaiverDocumentShell.svelte';
	import WaiverPublicAboutSignerCard from '$lib/components/waivers/WaiverPublicAboutSignerCard.svelte';
	import WaiverPublicAdditionalInfoSection from '$lib/components/waivers/WaiverPublicAdditionalInfoSection.svelte';
	import WaiverPublicMinorsBlock from '$lib/components/waivers/WaiverPublicMinorsBlock.svelte';
	import WaiverPublicSignatureAreaPreview from '$lib/components/waivers/WaiverPublicSignatureAreaPreview.svelte';
	import WaiverPublicSignatureCard from '$lib/components/waivers/WaiverPublicSignatureCard.svelte';
	import {
		waiverAddMinorButtonClass,
		waiverFieldLabelClass,
		waiverSectionCardClass,
		waiverUnderlineInputClass
	} from '$lib/components/waivers/waiver-public-form-classes';
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
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { sanitizeRichTextHtml } from '$lib/utils/rich-text';
	import WaiverFieldDisplay from '$lib/components/waivers/WaiverFieldDisplay.svelte';

	export type SaveState = 'idle' | 'saving' | 'saved' | 'dirty' | 'error';

	interface Props {
		introCopy: string;
		fields: WaiverField[];
		workspaceName?: string;
		saveState?: SaveState;
		lastSavedAt?: number | null;
	}

	type TextAlignValue = 'left' | 'center' | 'right' | 'justify';
	const headingLevels = [1, 2, 3, 4, 5, 6] as const;

	let {
		introCopy = $bindable('<p></p>'),
		fields,
		workspaceName,
		saveState = 'idle',
		lastSavedAt = null
	}: Props = $props();

	let editorElement = $state<HTMLDivElement | null>(null);
	let editor = $state<Editor | null>(null);
	let lastSyncedValue = $state('');
	let hasFocus = $state(false);
	let linkDialogOpen = $state(false);
	let linkHrefDraft = $state('');
	let linkError = $state<string | null>(null);
	let linkInputEl = $state<HTMLInputElement | null>(null);
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

	const currentHtml = $derived(sanitizeRichTextHtml(introCopy) || '<p></p>');

	const savedLabel = $derived.by(() => {
		if (saveState === 'saving') return 'Saving…';
		if (saveState === 'error') return 'Could not save';
		if (saveState === 'dirty') return 'Unsaved changes';
		if (!lastSavedAt) return 'All changes saved';

		const time = new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(lastSavedAt));

		return `Last saved at ${time}`;
	});

	function applyEditorValue(nextValue: string) {
		const sanitized = sanitizeRichTextHtml(nextValue);
		introCopy = sanitized;
		lastSyncedValue = sanitized;
	}

	function command(action: (editor: Editor) => boolean) {
		if (!editor) return;
		action(editor);
	}

	function canCommand(action: (editor: Editor) => boolean) {
		if (!editor) return false;
		return action(editor);
	}

	function keepToolbarFocus(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof HTMLElement)) return;
		if (!target.closest('button')) return;
		event.preventDefault();
	}

	function safeLinkHref(rawHref: string): string | null {
		const trimmed = rawHref.trim();
		if (!trimmed) return null;

		const hasHierarchicalScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
		const hasAllowedNonHierarchicalScheme = /^(mailto|tel):/i.test(trimmed);
		const href =
			hasHierarchicalScheme || hasAllowedNonHierarchicalScheme ? trimmed : `https://${trimmed}`;
		try {
			const url = new URL(href);
			return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? href : null;
		} catch {
			return null;
		}
	}

	async function setLink() {
		if (!editor) return;

		const previousUrl = editor.getAttributes('link').href ?? 'https://';
		linkHrefDraft = previousUrl;
		linkError = null;
		linkDialogOpen = true;
		await tick();
		linkInputEl?.focus();
		linkInputEl?.select();
	}

	function cancelLinkDialog() {
		linkDialogOpen = false;
		linkError = null;
	}

	async function submitLink(event: SubmitEvent) {
		event.preventDefault();
		if (!editor) return;

		const trimmed = linkHrefDraft.trim();
		if (!trimmed) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			cancelLinkDialog();
			return;
		}

		const safeHref = safeLinkHref(trimmed);
		if (!safeHref) {
			linkError = 'Links must start with http://, https://, mailto:, or tel:.';
			await tick();
			linkInputEl?.focus();
			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href: safeHref }).run();
		cancelLinkDialog();
	}

	function syncToolbarState(sourceEditor: Editor | null) {
		if (!sourceEditor) return;

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
		if (!editorElement) return;

		const instance = new Editor({
			element: editorElement,
			content: currentHtml,
			editable: true,
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
					placeholder: 'Write the waiver copy guests should read before signing.'
				})
			],
			editorProps: {
				attributes: {
					class: 'waiver-canvas-editor w-full text-base leading-7 text-foreground/85 outline-none'
				}
			},
			onCreate: ({ editor }) => {
				lastSyncedValue = sanitizeRichTextHtml(editor.getHTML());
				syncToolbarState(editor);
			},
			onUpdate: ({ editor }) => {
				applyEditorValue(editor.getHTML());
				syncToolbarState(editor);
			},
			onSelectionUpdate: () => syncToolbarState(instance),
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
		};
	});

	$effect(() => {
		if (!editor) return;
		const sanitized = currentHtml;
		if (sanitizeRichTextHtml(editor.getHTML()) === sanitized || sanitized === lastSyncedValue) {
			return;
		}
		editor.commands.setContent(sanitized, { emitUpdate: false });
		lastSyncedValue = sanitizeRichTextHtml(editor.getHTML());
	});
</script>

<Dialog bind:open={linkDialogOpen}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Set link</DialogTitle>
			<DialogDescription>Enter a URL for the selected text.</DialogDescription>
		</DialogHeader>
		<form class="space-y-4" onsubmit={submitLink}>
			<div class="space-y-1.5">
				<label for="waiver-link-url" class="text-xs font-medium text-foreground">URL</label>
				<Input
					id="waiver-link-url"
					bind:value={linkHrefDraft}
					bind:ref={linkInputEl}
					aria-invalid={linkError ? 'true' : undefined}
					aria-describedby={linkError ? 'waiver-link-error' : undefined}
				/>
				{#if linkError}
					<p id="waiver-link-error" class="text-xs text-destructive">{linkError}</p>
				{/if}
			</div>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={cancelLinkDialog}>Cancel</Button>
				<Button type="submit">Apply link</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>

<section class="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
	<!-- Toolbar -->
	<div
		class="canvas-toolbar flex shrink-0 items-center gap-2 border-b border-border/80 bg-card/40 px-4 py-2 backdrop-blur-sm"
		role="toolbar"
		aria-label="Waiver copy formatting"
		tabindex="-1"
		onmousedown={keepToolbarFocus}
	>
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<span class="save-indicator" data-state={saveState}>
				{#if saveState === 'saving'}
					<LoaderIcon class="size-3.5 animate-spin" />
				{:else if saveState === 'error'}
					<CloudOffIcon class="size-3.5" />
				{:else if saveState === 'dirty'}
					<CloudIcon class="size-3.5" />
				{:else}
					<CloudCheckIcon class="size-3.5" />
				{/if}
				<span class="truncate">{savedLabel}</span>
			</span>
		</div>

		<div class="flex items-center gap-1">
			<!-- Block style -->
			<DropdownMenu>
				<DropdownMenuTrigger class="toolbar-select" disabled={!editor} aria-label="Text style">
					{#snippet child({ props })}
						<button {...props}>
							<span class="toolbar-select-label">{toolbarState.blockShortLabel}</span>
							<ChevronDownIcon class="size-3" />
						</button>
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="w-40">
					<DropdownMenuItem onclick={() => command((e) => e.chain().focus().setParagraph().run())}>
						Paragraph
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{#each headingLevels as level (level)}
						<DropdownMenuItem
							class={toolbarState.blockShortLabel === `H${level}` ? 'font-semibold' : undefined}
							onclick={() => command((e) => e.chain().focus().toggleHeading({ level }).run())}
						>
							Heading {level}
						</DropdownMenuItem>
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>

			<!-- Alignment -->
			<DropdownMenu>
				<DropdownMenuTrigger class="toolbar-button" disabled={!editor} aria-label="Alignment">
					{#snippet child({ props })}
						<button {...props}>
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
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="w-40">
					<DropdownMenuItem
						class={toolbarState.alignment === 'left' ? 'font-semibold' : undefined}
						onclick={() => command((e) => e.chain().focus().setTextAlign('left').run())}
					>
						<AlignLeftIcon class="size-4" />
						<span>Left</span>
					</DropdownMenuItem>
					<DropdownMenuItem
						class={toolbarState.alignment === 'center' ? 'font-semibold' : undefined}
						onclick={() => command((e) => e.chain().focus().setTextAlign('center').run())}
					>
						<AlignCenterIcon class="size-4" />
						<span>Center</span>
					</DropdownMenuItem>
					<DropdownMenuItem
						class={toolbarState.alignment === 'right' ? 'font-semibold' : undefined}
						onclick={() => command((e) => e.chain().focus().setTextAlign('right').run())}
					>
						<AlignRightIcon class="size-4" />
						<span>Right</span>
					</DropdownMenuItem>
					<DropdownMenuItem
						class={toolbarState.alignment === 'justify' ? 'font-semibold' : undefined}
						onclick={() => command((e) => e.chain().focus().setTextAlign('justify').run())}
					>
						<AlignJustifyIcon class="size-4" />
						<span>Justify</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<span class="toolbar-divider"></span>

			<button
				type="button"
				class="toolbar-button"
				class:is-active={toolbarState.bold}
				aria-pressed={toolbarState.bold}
				aria-label="Bold"
				title="Bold"
				disabled={!canCommand((e) => e.can().chain().focus().toggleBold().run())}
				onclick={() => command((e) => e.chain().focus().toggleBold().run())}
			>
				<BoldIcon class="size-3.5" />
			</button>
			<button
				type="button"
				class="toolbar-button"
				class:is-active={toolbarState.italic}
				aria-pressed={toolbarState.italic}
				aria-label="Italic"
				title="Italic"
				disabled={!canCommand((e) => e.can().chain().focus().toggleItalic().run())}
				onclick={() => command((e) => e.chain().focus().toggleItalic().run())}
			>
				<ItalicIcon class="size-3.5" />
			</button>
			<button
				type="button"
				class="toolbar-button"
				class:is-active={toolbarState.underline}
				aria-pressed={toolbarState.underline}
				aria-label="Underline"
				title="Underline"
				disabled={!canCommand((e) => e.can().chain().focus().toggleUnderline().run())}
				onclick={() => command((e) => e.chain().focus().toggleUnderline().run())}
			>
				<UnderlineIcon class="size-3.5" />
			</button>
			<button
				type="button"
				class="toolbar-button"
				class:is-active={toolbarState.strike}
				aria-pressed={toolbarState.strike}
				aria-label="Strikethrough"
				title="Strikethrough"
				disabled={!canCommand((e) => e.can().chain().focus().toggleStrike().run())}
				onclick={() => command((e) => e.chain().focus().toggleStrike().run())}
			>
				<StrikethroughIcon class="size-3.5" />
			</button>

			<span class="toolbar-divider"></span>

			<button
				type="button"
				class="toolbar-button"
				class:is-active={toolbarState.bulletList}
				aria-pressed={toolbarState.bulletList}
				aria-label="Bulleted list"
				title="Bulleted list"
				disabled={!editor}
				onclick={() => command((e) => e.chain().focus().toggleBulletList().run())}
			>
				<ListIcon class="size-3.5" />
			</button>
			<button
				type="button"
				class="toolbar-button"
				class:is-active={toolbarState.orderedList}
				aria-pressed={toolbarState.orderedList}
				aria-label="Numbered list"
				title="Numbered list"
				disabled={!editor}
				onclick={() => command((e) => e.chain().focus().toggleOrderedList().run())}
			>
				<ListOrderedIcon class="size-3.5" />
			</button>

			<span class="toolbar-divider"></span>

			<button
				type="button"
				class="toolbar-button"
				class:is-active={toolbarState.link}
				aria-pressed={toolbarState.link}
				aria-label="Set link"
				title="Set link"
				disabled={!editor}
				onclick={setLink}
			>
				<LinkIcon class="size-3.5" />
			</button>
			<button
				type="button"
				class="toolbar-button"
				aria-label="Clear formatting"
				title="Clear formatting"
				disabled={!canCommand((e) => e.can().chain().focus().unsetAllMarks().clearNodes().run())}
				onclick={() => command((e) => e.chain().focus().unsetAllMarks().clearNodes().run())}
			>
				<RemoveFormattingIcon class="size-3.5" />
			</button>
		</div>
	</div>

	<!-- Scrollable document canvas -->
	<div class="flex-1 overflow-y-auto overscroll-y-contain" data-canvas-scroll>
		<WaiverDocumentShell {workspaceName}>
			<!-- Editable waiver copy — just the body, no eyebrow/title/separator -->
			<section class="{waiverSectionCardClass} canvas-document-card" class:is-focused={hasFocus}>
				<div class="canvas-editor-wrapper">
					<div bind:this={editorElement}></div>
				</div>
			</section>

			<!-- Signer section preview -->
			<div class="mt-6">
				<WaiverPublicAboutSignerCard>
					<div class="space-y-6">
						<div>
							<div class={waiverFieldLabelClass}>Full name</div>
							<div
								class="{waiverUnderlineInputClass} pointer-events-none text-muted-foreground/45 select-none"
								aria-hidden="true"
							>
								Preview value
							</div>
						</div>

						<div>
							<div class={waiverFieldLabelClass}>Email</div>
							<div
								class="{waiverUnderlineInputClass} pointer-events-none text-muted-foreground/45 select-none"
								aria-hidden="true"
							>
								Preview value
							</div>
						</div>

						<div>
							<div class={waiverFieldLabelClass}>Date of birth</div>
							<div
								class="{waiverUnderlineInputClass} pointer-events-none text-muted-foreground/45 select-none"
								aria-hidden="true"
							>
								YYYY-MM-DD
							</div>
						</div>
					</div>

					<WaiverPublicMinorsBlock>
						{#snippet headerActions()}
							<button type="button" class={waiverAddMinorButtonClass} disabled aria-hidden="true">
								Add minor
							</button>
						{/snippet}
						{#snippet body()}{/snippet}
					</WaiverPublicMinorsBlock>

					{#if fields.length > 0}
						<WaiverPublicAdditionalInfoSection>
							{#each fields as field (field.id)}
								<WaiverFieldDisplay {field} preview />
							{/each}
						</WaiverPublicAdditionalInfoSection>
					{/if}
				</WaiverPublicAboutSignerCard>
			</div>

			<div class="mt-6">
				<WaiverPublicSignatureCard>
					<WaiverPublicSignatureAreaPreview />
				</WaiverPublicSignatureCard>
			</div>

			<p class="mt-6 text-center text-[10px] tracking-[0.18em] text-muted-foreground/45 uppercase">
				Preview
			</p>
		</WaiverDocumentShell>
	</div>
</section>

<style>
	.save-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.55rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		color: var(--muted-foreground);
		background: color-mix(in srgb, var(--muted) 40%, transparent);
		transition:
			color 180ms ease,
			background 180ms ease;
	}

	.save-indicator[data-state='saving'] {
		color: color-mix(in srgb, var(--primary) 60%, var(--foreground));
	}

	.save-indicator[data-state='saved'],
	.save-indicator[data-state='idle'] {
		color: color-mix(in srgb, var(--muted-foreground) 85%, var(--foreground));
	}

	.save-indicator[data-state='error'] {
		color: var(--destructive);
		background: color-mix(in srgb, var(--destructive) 14%, transparent);
	}

	.save-indicator[data-state='dirty'] {
		color: color-mix(in srgb, var(--primary) 70%, var(--foreground));
	}

	.toolbar-button {
		display: inline-flex;
		height: 1.85rem;
		width: 1.85rem;
		align-items: center;
		justify-content: center;
		border-radius: 0.45rem;
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
		border-radius: 0.45rem;
		padding: 0 0.55rem;
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--foreground);
		transition:
			background-color 150ms ease,
			color 150ms ease;
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
		text-align: left;
		font-variant: all-small-caps;
		letter-spacing: 0.03em;
	}

	.toolbar-divider {
		display: inline-block;
		width: 1px;
		height: 1rem;
		margin: 0 0.1rem;
		background: var(--border);
	}

	.canvas-document-card {
		position: relative;
		transition:
			border-color 200ms ease,
			box-shadow 200ms ease;
	}

	.canvas-document-card.is-focused {
		border-color: color-mix(in srgb, var(--primary) 50%, var(--border));
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--primary) 16%, transparent),
			0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.canvas-editor-wrapper {
		min-height: 12rem;
	}

	:global(.waiver-canvas-editor) {
		min-height: 12rem;
		outline: none;
	}

	:global(.waiver-canvas-editor p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--muted-foreground);
		opacity: 0.55;
		pointer-events: none;
		height: 0;
	}

	:global(.waiver-canvas-editor p) {
		margin: 0 0 1rem;
	}

	:global(.waiver-canvas-editor h1),
	:global(.waiver-canvas-editor h2),
	:global(.waiver-canvas-editor h3),
	:global(.waiver-canvas-editor h4),
	:global(.waiver-canvas-editor h5),
	:global(.waiver-canvas-editor h6) {
		margin: 1.5rem 0 0.75rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--foreground);
	}

	:global(.waiver-canvas-editor h1) {
		font-size: 1.75rem;
	}

	:global(.waiver-canvas-editor h2) {
		font-size: 1.375rem;
	}

	:global(.waiver-canvas-editor h3) {
		font-size: 1.2rem;
	}

	:global(.waiver-canvas-editor h4),
	:global(.waiver-canvas-editor h5),
	:global(.waiver-canvas-editor h6) {
		font-size: 1.05rem;
	}

	:global(.waiver-canvas-editor ul),
	:global(.waiver-canvas-editor ol) {
		margin: 0 0 1rem;
		padding-left: 1.25rem;
	}

	:global(.waiver-canvas-editor li) {
		margin: 0.2rem 0;
	}

	:global(.waiver-canvas-editor a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	:global(.waiver-canvas-editor strong) {
		font-weight: 700;
	}

	:global(.waiver-canvas-editor em) {
		font-style: italic;
	}

	:global(.waiver-canvas-editor.ProseMirror) {
		outline: none;
	}
</style>
