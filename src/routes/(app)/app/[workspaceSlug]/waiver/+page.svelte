<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { publicEnv } from '$lib/config/public';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import QrCodePreview from '$lib/components/waivers/QrCodePreview.svelte';
	import WaiverTemplateEditor from '$lib/components/waivers/WaiverTemplateEditor.svelte';
	import WaiverReadonlyDocument from '$lib/components/waivers/WaiverReadonlyDocument.svelte';
	import PastWaiversSheet from '$lib/components/waivers/PastWaiversSheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import {
		cloneDefinition,
		createBlankDefinition,
		definitionsEqual,
		normalizeDefinitionForCompare,
		type WaiverDefinition
	} from '$lib/domain/waivers';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import Code2Icon from '@lucide/svelte/icons/code-2';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CheckIcon from '@lucide/svelte/icons/check';
	import QrCodeIcon from '@lucide/svelte/icons/qr-code';

	let { data } = $props();

	type TemplateSummary = FunctionReturnType<typeof api.waivers.listTemplates>[number];
	type PublishingOverview = FunctionReturnType<typeof api.waivers.getPublishingOverview>;
	type PendingDiscardAction =
		| { type: 'switch-template'; templateId: TemplateSummary['templateId'] }
		| { type: 'open-create-confirm' }
		| null;
	type ConfirmKind = 'create' | 'publish' | 'archive' | 'delete' | 'discard';

	const convex = useConvexClient();

	const templatesQuery = useProtectedQuery(
		api.waivers.listTemplates,
		() => ({ workspaceId: data.currentWorkspace.workspaceId }),
		() => ({ keepPreviousData: true })
	);
	const publishingQuery = useProtectedQuery(
		api.waivers.getPublishingOverview,
		() => ({ workspaceId: data.currentWorkspace.workspaceId }),
		() => ({ keepPreviousData: true })
	);

	const templates = $derived((templatesQuery.data ?? []) as TemplateSummary[]);
	const publishingOverview = $derived(
		(publishingQuery.data ?? { activeLink: null }) as PublishingOverview
	);
	const isLoadingProtectedData = $derived(templatesQuery.isLoading || publishingQuery.isLoading);

	function activeTemplateRank(template: TemplateSummary) {
		if (template.isActivePublic) return 0;
		if (template.status === 'published') return 1;
		return 2;
	}

	const activeTemplates = $derived(
		[...templates]
			.filter((template) => template.status !== 'archived')
			.sort((a, b) => activeTemplateRank(a) - activeTemplateRank(b))
	);
	let selectedTemplateId = $state<TemplateSummary['templateId'] | null>(null);
	let draft = $state<WaiverDefinition | null>(null);
	let baselineDraft = $state<WaiverDefinition | null>(null);
	let hydratedTemplateId = $state<TemplateSummary['templateId'] | null>(null);
	let hydratedFingerprint = $state<string | null>(null);
	let recentCreatedTemplateId = $state<TemplateSummary['templateId'] | null>(null);
	let previewOpen = $state(false);
	let pastWaiversOpen = $state(false);
	let copyingKey = $state<string | null>(null);
	let qrDialogOpen = $state(false);
	let pendingDiscardAction = $state<PendingDiscardAction>(null);

	let isSaving = $state(false);
	let isPublishing = $state(false);
	let isArchiving = $state(false);
	let isDeleting = $state(false);
	let isCreating = $state(false);

	let confirmKind = $state<ConfirmKind | null>(null);
	let confirmOpen = $state(false);

	const selectedTemplate = $derived(
		templates.find((template) => template.templateId === selectedTemplateId) ?? null
	);
	const activePublicHref = $derived.by(() => {
		const slug = publishingOverview.activeLink?.slug;
		if (!slug) return null;

		return resolve(`/w/${slug}` as `/w/${string}`);
	});
	const activePublicUrl = $derived.by(() => {
		if (!activePublicHref) return null;

		const baseUrl =
			publicEnv.appUrl ||
			(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

		return new URL(activePublicHref, baseUrl).toString();
	});
	const activeEmbedSnippet = $derived(
		activePublicUrl
			? `<iframe src="${activePublicUrl}?embed=1" title="Waiver form" width="100%" height="920" style="border:0;border-radius:16px;overflow:hidden"></iframe>`
			: ''
	);
	const selectedFingerprint = $derived(
		selectedTemplate
			? JSON.stringify(
					normalizeDefinitionForCompare({
						title: selectedTemplate.title,
						introCopy: selectedTemplate.introCopy,
						fields: selectedTemplate.fields
					})
				)
			: null
	);
	const currentDraft = $derived(draft ?? createBlankDefinition());
	const isDirty = $derived(!definitionsEqual(draft, baselineDraft));
	const isReadOnly = $derived(selectedTemplate?.isReadOnly ?? false);
	const busy = $derived(isSaving || isPublishing || isArchiving || isDeleting || isCreating);
	const publishDisabled = $derived(
		busy ||
			isDirty ||
			!selectedTemplate ||
			(selectedTemplate.isActivePublic && !selectedTemplate.hasUnpublishedChanges)
	);

	beforeNavigate((navigation) => {
		if (!isDirty || navigation.willUnload) return;
		navigation.cancel();
	});

	$effect(() => {
		if (templates.length === 0) {
			selectedTemplateId = null;
			draft = null;
			baselineDraft = null;
			hydratedTemplateId = null;
			hydratedFingerprint = null;
			recentCreatedTemplateId = null;
			return;
		}

		const hasSelectedTemplate = selectedTemplateId
			? templates.some((template) => template.templateId === selectedTemplateId)
			: false;

		// No selection or selection removed from list → pick first active template
		if (!selectedTemplateId) {
			selectedTemplateId = activeTemplates[0]?.templateId ?? null;
			return;
		}

		if (!hasSelectedTemplate) {
			if (recentCreatedTemplateId === selectedTemplateId) {
				return;
			}

			selectedTemplateId = activeTemplates[0]?.templateId ?? null;
			return;
		}

		if (recentCreatedTemplateId === selectedTemplateId) {
			recentCreatedTemplateId = null;
		}

		// Selected template just became archived (e.g. user just archived it) → move to active
		const current = templates.find((t) => t.templateId === selectedTemplateId);
		if (current?.status === 'archived' && activeTemplates.length > 0) {
			selectedTemplateId = activeTemplates[0].templateId;
		}
	});

	$effect(() => {
		if (!selectedTemplate || !selectedFingerprint) {
			draft = null;
			baselineDraft = null;
			hydratedTemplateId = null;
			hydratedFingerprint = null;
			return;
		}

		if (
			selectedTemplate.templateId !== hydratedTemplateId ||
			(!isDirty && selectedFingerprint !== hydratedFingerprint)
		) {
			const nextDraft = cloneDefinition(selectedTemplate);
			draft = nextDraft;
			baselineDraft = cloneDefinition(nextDraft);
			hydratedTemplateId = selectedTemplate.templateId;
			hydratedFingerprint = selectedFingerprint;
		}
	});

	onMount(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!isDirty) return;
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	function syncBaseline(definition: WaiverDefinition) {
		baselineDraft = cloneDefinition(definition);
		draft = cloneDefinition(definition);
		hydratedFingerprint = JSON.stringify(normalizeDefinitionForCompare(definition));
	}

	function statusLine(template: TemplateSummary) {
		if (template.isActivePublic) return 'Live';
		if (template.status === 'archived') return 'Archived';
		if (template.usageState === 'used') return 'Signed history';
		if (template.lastPublishedVersionId) return 'Published';
		return 'Draft';
	}

	function publishButtonLabel(template: TemplateSummary | null) {
		if (!template) return 'Publish & activate';
		if (template.isActivePublic && !template.hasUnpublishedChanges) return 'Already live';
		if (template.lastPublishedVersionId && template.hasUnpublishedChanges) return 'Publish changes';
		if (template.lastPublishedVersionId) return 'Republish & activate';
		return 'Publish & activate';
	}

	function openConfirm(kind: ConfirmKind) {
		confirmKind = kind;
		confirmOpen = true;
	}

	function confirmConfig(kind: ConfirmKind) {
		switch (kind) {
			case 'create':
				return {
					title: 'Create a new waiver?',
					description: 'This will create a blank waiver for this workspace.',
					confirmLabel: 'Create waiver',
					destructive: false
				};
			case 'publish':
				return {
					title: 'Publish and activate this waiver?',
					description:
						'This creates a new published version and makes it the live waiver guests will sign.',
					confirmLabel: 'Publish waiver',
					destructive: false
				};
			case 'archive':
				return {
					title: 'Archive this waiver?',
					description:
						'Archived waivers are locked and moved to past waivers. Their signed records are preserved.',
					confirmLabel: 'Archive waiver',
					destructive: true
				};
			case 'delete':
				return {
					title: 'Delete this waiver?',
					description:
						'No one has signed this waiver yet. Deleting it removes it and any public links permanently.',
					confirmLabel: 'Delete permanently',
					destructive: true
				};
			case 'discard':
				return {
					title: 'Discard unsaved changes?',
					description: 'You have unsaved edits. Continuing will discard them.',
					confirmLabel: 'Discard changes',
					destructive: true
				};
		}
	}

	function requestTemplateSelection(templateId: TemplateSummary['templateId']) {
		if (templateId === selectedTemplateId) return;

		if (isDirty) {
			pendingDiscardAction = { type: 'switch-template', templateId };
			openConfirm('discard');
			return;
		}

		selectedTemplateId = templateId;
	}

	function requestCreateTemplate() {
		if (isDirty) {
			pendingDiscardAction = { type: 'open-create-confirm' };
			openConfirm('discard');
			return;
		}

		openConfirm('create');
	}

	function continuePendingDiscardAction() {
		const action = pendingDiscardAction;
		pendingDiscardAction = null;
		confirmOpen = false;
		confirmKind = null;

		if (baselineDraft) {
			draft = cloneDefinition(baselineDraft);
		}

		if (!action) return;

		if (action.type === 'switch-template') {
			selectedTemplateId = action.templateId;
			return;
		}

		if (action.type === 'open-create-confirm') {
			openConfirm('create');
		}
	}

	function openPreview() {
		previewOpen = true;
	}

	function openPastWaivers() {
		pastWaiversOpen = true;
	}

	async function copyText(key: string, text: string) {
		try {
			copyingKey = key;
			await navigator.clipboard.writeText(text);
			toast.success('Copied to clipboard.');
		} catch {
			toast.error('Unable to copy to the clipboard.');
		} finally {
			copyingKey = null;
		}
	}

	async function createTemplate() {
		if (convex.disabled) {
			toast.error('Waiver editor is still loading. Please try again.');
			return;
		}

		isCreating = true;

		try {
			const result = await convex.mutation(api.waivers.createTemplate, {
				workspaceId: data.currentWorkspace.workspaceId,
				title: `Waiver ${templates.length + 1}`
			});

			recentCreatedTemplateId = result.templateId;
			selectedTemplateId = result.templateId;
			confirmOpen = false;
			confirmKind = null;
			toast.success('Blank waiver created.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to create this waiver.'));
		} finally {
			isCreating = false;
		}
	}

	async function saveDraft() {
		if (convex.disabled || !selectedTemplate || !draft) return;

		isSaving = true;

		try {
			await convex.mutation(api.waivers.updateTemplate, {
				workspaceId: data.currentWorkspace.workspaceId,
				templateId: selectedTemplate.templateId,
				definition: draft
			});

			syncBaseline(draft);
			toast.success('Waiver saved.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to save this waiver.'));
		} finally {
			isSaving = false;
		}
	}

	async function publishTemplate() {
		if (convex.disabled || !selectedTemplate) return;

		isPublishing = true;

		try {
			await convex.mutation(api.waivers.publishTemplate, {
				workspaceId: data.currentWorkspace.workspaceId,
				templateId: selectedTemplate.templateId,
				activate: true
			});

			confirmOpen = false;
			confirmKind = null;
			toast.success('Waiver published and activated.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to publish this waiver.'));
		} finally {
			isPublishing = false;
		}
	}

	async function archiveTemplate() {
		if (convex.disabled || !selectedTemplate) return;

		isArchiving = true;

		try {
			await convex.mutation(api.waivers.archiveTemplate, {
				workspaceId: data.currentWorkspace.workspaceId,
				templateId: selectedTemplate.templateId
			});

			confirmOpen = false;
			confirmKind = null;
			toast.success('Waiver archived.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to archive this waiver.'));
		} finally {
			isArchiving = false;
		}
	}

	async function deleteTemplate() {
		if (convex.disabled || !selectedTemplate) return;

		isDeleting = true;

		try {
			await convex.mutation(api.waivers.deleteTemplate, {
				workspaceId: data.currentWorkspace.workspaceId,
				templateId: selectedTemplate.templateId
			});

			confirmOpen = false;
			confirmKind = null;
			toast.success('Waiver deleted.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to delete this waiver.'));
		} finally {
			isDeleting = false;
		}
	}

	async function handleConfirm() {
		switch (confirmKind) {
			case 'create':
				await createTemplate();
				return;
			case 'publish':
				await publishTemplate();
				return;
			case 'archive':
				await archiveTemplate();
				return;
			case 'delete':
				await deleteTemplate();
				return;
			case 'discard':
				continuePendingDiscardAction();
				return;
			default:
				return;
		}
	}
</script>

<svelte:head>
	<title>{data.currentWorkspace.name} Waiver | Waiver Director</title>
</svelte:head>

{#if confirmKind}
	<ConfirmDialog
		bind:open={confirmOpen}
		title={confirmConfig(confirmKind).title}
		description={confirmConfig(confirmKind).description}
		confirmLabel={confirmConfig(confirmKind).confirmLabel}
		destructive={confirmConfig(confirmKind).destructive}
		isConfirming={isCreating || isPublishing || isArchiving || isDeleting}
		onConfirm={handleConfirm}
	/>
{/if}

<PastWaiversSheet bind:open={pastWaiversOpen} workspaceId={data.currentWorkspace.workspaceId} />

<Dialog bind:open={previewOpen}>
	<DialogContent
		class="h-[96vh] w-[calc(100vw-1rem)] max-w-none gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-w-[min(1500px,calc(100vw-4rem))]"
	>
		<DialogHeader class="border-b border-border px-6 py-4">
			<DialogTitle>Draft preview</DialogTitle>
			<DialogDescription>
				This preview includes the current draft, including unsaved changes.
			</DialogDescription>
		</DialogHeader>

		<div class="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6">
			<WaiverReadonlyDocument
				workspaceName={data.currentWorkspace.name}
				title={currentDraft.title}
				introCopy={currentDraft.introCopy}
				fields={currentDraft.fields}
				preview
			/>
		</div>
	</DialogContent>
</Dialog>

{#if activePublicUrl}
	<Dialog bind:open={qrDialogOpen}>
		<DialogContent class="max-w-xs gap-0 overflow-hidden p-0">
			<DialogHeader class="border-b border-border px-5 py-4">
				<DialogTitle>QR Code</DialogTitle>
				<DialogDescription>Scan to open the live waiver form.</DialogDescription>
			</DialogHeader>
			<div class="flex flex-col items-center gap-4 p-6">
				<QrCodePreview text={activePublicUrl} size={200} />
				<p class="max-w-full text-center font-mono text-xs break-all text-muted-foreground">
					{activePublicUrl}
				</p>
				<Button variant="outline" class="w-full" onclick={() => copyText('link', activePublicUrl)}>
					{copyingKey === 'link' ? '✓ Copied link' : 'Copy link'}
				</Button>
			</div>
		</DialogContent>
	</Dialog>
{/if}

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-5xl min-w-0 space-y-5">
		<!-- Page header -->
		<div class="space-y-1">
			<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Waiver</p>
			<h1 class="text-2xl font-semibold tracking-tight">Edit and share your workspace waiver</h1>
		</div>

		{#if isLoadingProtectedData}
			<div
				class="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center"
			>
				<p class="text-base font-medium tracking-tight">Loading waiver workspace…</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Connecting your signed-in session to live waiver data.
				</p>
			</div>
		{:else if activeTemplates.length === 0}
			<div
				class="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center"
			>
				<p class="text-base font-medium tracking-tight">No waiver yet</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Create a waiver to start collecting signed submissions.
				</p>
				<div class="mt-5 flex flex-wrap items-center justify-center gap-3">
					<Button onclick={requestCreateTemplate} disabled={busy}>
						{isCreating ? 'Creating…' : 'Create waiver'}
					</Button>
					<Button variant="outline" onclick={openPastWaivers} disabled={busy}>
						View past waivers
					</Button>
				</div>
			</div>
		{:else}
			<!-- Live status bar -->
			{#if publishingOverview.activeLink && activePublicUrl}
				<div class="flex items-stretch overflow-hidden rounded-xl border border-border bg-card">
					<!-- Left: Live indicator + info -->
					<div class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
						<div class="flex shrink-0 items-center gap-2">
							<span class="relative flex h-2 w-2">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
								></span>
								<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
							</span>
							<span class="text-[10px] font-bold tracking-[0.2em] text-emerald-600 uppercase">
								Live
							</span>
						</div>
						<div class="hidden h-3.5 w-px shrink-0 bg-border sm:block"></div>
						<div class="hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-foreground">
									{publishingOverview.activeLink.title}
								</p>
								<p class="truncate font-mono text-[11px] leading-tight text-muted-foreground/60">
									{activePublicUrl}
								</p>
							</div>
							<button
								type="button"
								class="flex shrink-0 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
								onclick={() => copyText('link', activePublicUrl)}
								disabled={copyingKey === 'link'}
								title="Copy link"
							>
								{#if copyingKey === 'link'}
									<CheckIcon class="h-3.5 w-3.5 text-emerald-500" />
								{:else}
									<ClipboardIcon class="h-3.5 w-3.5" />
								{/if}
							</button>
						</div>
					</div>

					<!-- Right: segmented action buttons -->
					<div class="flex shrink-0 items-stretch divide-x divide-border border-l border-border">
						<!-- Copy embed code -->
						<button
							type="button"
							class="flex items-center gap-1.5 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
							onclick={() => copyText('embed', activeEmbedSnippet)}
							disabled={copyingKey === 'embed'}
						>
							{#if copyingKey === 'embed'}
								<CheckIcon class="h-3.5 w-3.5 shrink-0 text-emerald-500" />
								<span class="hidden text-emerald-600 sm:inline">Copied!</span>
							{:else}
								<Code2Icon class="h-3.5 w-3.5 shrink-0" />
								<span class="hidden sm:inline">Copy embed code</span>
							{/if}
						</button>

						<!-- Open in new tab -->
						<a
							href={resolve(`/w/${publishingOverview.activeLink.slug}` as `/w/${string}`)}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-1.5 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							<ExternalLinkIcon class="h-3.5 w-3.5 shrink-0" />
							<span class="hidden md:inline">Open</span>
						</a>

						<!-- QR Code button — opens dialog with a scannable size -->
						<button
							type="button"
							onclick={() => (qrDialogOpen = true)}
							class="flex items-center gap-1.5 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							title="View QR code"
						>
							<QrCodeIcon class="h-3.5 w-3.5 shrink-0" />
							<span class="hidden md:inline">QR code</span>
						</button>
					</div>
				</div>
			{:else if selectedTemplate}
				<div
					class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3"
				>
					<span
						class="shrink-0 text-[10px] font-bold tracking-[0.18em] text-muted-foreground/50 uppercase"
					>
						Not live
					</span>
					<p class="text-sm text-muted-foreground">
						Publish this waiver to create the public form guests can sign.
					</p>
				</div>
			{/if}

			<!-- Editor section -->
			{#if selectedTemplate}
				<div class="space-y-4">
					<!-- Editor header -->
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div class="space-y-1.5">
							<div class="flex flex-wrap items-center gap-3">
								<h2 class="text-xl font-semibold tracking-tight">{selectedTemplate.title}</h2>
								<span
									class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
								>
									{statusLine(selectedTemplate)}
								</span>
							</div>

							<!-- Multiple waivers switcher -->
							{#if activeTemplates.length > 1}
								<DropdownMenu>
									<DropdownMenuTrigger
										class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
									>
										{activeTemplates.length} waivers — switch
										<ChevronDownIcon class="h-3 w-3" />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" class="w-56">
										{#each activeTemplates as template (template.templateId)}
											<DropdownMenuItem
												onclick={() => requestTemplateSelection(template.templateId)}
												class={template.templateId === selectedTemplateId ? 'font-medium' : ''}
											>
												<span class="flex-1 truncate">{template.title}</span>
												{#if template.isActivePublic}
													<span class="ml-2 text-[10px] font-semibold text-emerald-500 uppercase">
														Live
													</span>
												{/if}
											</DropdownMenuItem>
										{/each}
									</DropdownMenuContent>
								</DropdownMenu>
							{/if}
						</div>

						<!-- Actions -->
						<div class="flex flex-wrap items-center gap-2">
							<Button type="button" variant="outline" onclick={openPreview}>Preview</Button>

							{#if !isReadOnly}
								<Button
									type="button"
									variant="outline"
									onclick={saveDraft}
									disabled={busy || !isDirty}
								>
									{isSaving ? 'Saving…' : 'Save draft'}
								</Button>
								<Button
									type="button"
									onclick={() => openConfirm('publish')}
									disabled={publishDisabled}
								>
									{isPublishing ? 'Publishing…' : publishButtonLabel(selectedTemplate)}
								</Button>
							{/if}

							<DropdownMenu>
								<DropdownMenuTrigger class="inline-flex">
									<Button type="button" variant="outline" size="icon-sm">
										<EllipsisIcon />
										<span class="sr-only">More actions</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" class="w-48">
									{#if selectedTemplate.canDelete}
										<DropdownMenuItem onclick={() => openConfirm('delete')}>
											Delete permanently
										</DropdownMenuItem>
									{/if}
									{#if selectedTemplate.canArchive && !selectedTemplate.isReadOnly}
										<DropdownMenuItem onclick={() => openConfirm('archive')}>
											Archive waiver
										</DropdownMenuItem>
									{/if}
									{#if selectedTemplate.canDelete || (selectedTemplate.canArchive && !selectedTemplate.isReadOnly)}
										<DropdownMenuSeparator />
									{/if}
									<DropdownMenuItem onclick={requestCreateTemplate}>
										Create new waiver
									</DropdownMenuItem>
									<DropdownMenuItem onclick={openPastWaivers}>View past waivers</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<WaiverTemplateEditor bind:draft readOnly={isReadOnly} />
				</div>
			{/if}
		{/if}
	</div>
</div>
