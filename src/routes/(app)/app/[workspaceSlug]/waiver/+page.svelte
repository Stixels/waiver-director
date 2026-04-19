<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { publicEnv } from '$lib/config/public';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import QrCodePreview from '$lib/components/waivers/QrCodePreview.svelte';
	import WaiverVersionHistorySheet from '$lib/components/waivers/WaiverVersionHistorySheet.svelte';
	import WaiverBuilderCanvas, {
		type SaveState
	} from '$lib/components/waivers/WaiverBuilderCanvas.svelte';
	import WaiverBuilderPanel from '$lib/components/waivers/WaiverBuilderPanel.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
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
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger
	} from '$lib/components/ui/tooltip';
	import {
		cloneDefinition,
		createBlankDefinition,
		definitionsEqual,
		normalizeDefinitionForCompare,
		type WaiverDefinition
	} from '$lib/domain/waivers';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import Code2Icon from '@lucide/svelte/icons/code-2';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CheckIcon from '@lucide/svelte/icons/check';
	import QrCodeIcon from '@lucide/svelte/icons/qr-code';
	import UploadCloudIcon from '@lucide/svelte/icons/upload-cloud';
	import Pencil from '@lucide/svelte/icons/pencil';
	import XIcon from '@lucide/svelte/icons/x';

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);

	type WorkspaceWaiverSummary = NonNullable<
		FunctionReturnType<typeof api.waivers.getWorkspaceWaiver>
	>;
	type PublishingOverview = FunctionReturnType<typeof api.waivers.getPublishingOverview>;
	type ConfirmKind = 'publish';

	const convex = useConvexClient();

	const waiverQuery = useProtectedQuery(
		api.waivers.getWorkspaceWaiver,
		() => (currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);
	const publishingQuery = useProtectedQuery(
		api.waivers.getPublishingOverview,
		() => (currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);

	const workspaceWaiver = $derived((waiverQuery.data ?? null) as WorkspaceWaiverSummary | null);
	const publishingOverview = $derived(
		(publishingQuery.data ?? { activeLink: null }) as PublishingOverview
	);
	const isLoadingProtectedData = $derived(
		appContext.isLoading || waiverQuery.isLoading || publishingQuery.isLoading
	);

	let draft = $state<WaiverDefinition | null>(null);
	let baselineDraft = $state<WaiverDefinition | null>(null);
	let hydratedWaiverId = $state<WorkspaceWaiverSummary['waiverId'] | null>(null);
	let hydratedFingerprint = $state<string | null>(null);
	let versionHistoryOpen = $state(false);
	let copyingKey = $state<string | null>(null);
	let copiedKey = $state<string | null>(null);
	let qrDialogOpen = $state(false);

	// Inline title editing (header pencil)
	let isEditingTitle = $state(false);
	let titleDraft = $state('');
	let titleInputEl = $state<HTMLInputElement | null>(null);

	// Save state machine for debounced autosave
	let isSaving = $state(false);
	let lastSavedAt = $state<number | null>(null);
	let lastSaveError = $state(false);
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
	const AUTOSAVE_DELAY_MS = 800;

	let isPublishing = $state(false);
	let isEnsuringWaiver = $state(false);

	let confirmKind = $state<ConfirmKind | null>(null);
	let confirmOpen = $state(false);

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
		workspaceWaiver
			? JSON.stringify(
					normalizeDefinitionForCompare({
						title: workspaceWaiver.title,
						introCopy: workspaceWaiver.introCopy,
						fields: workspaceWaiver.fields
					})
				)
			: null
	);
	const currentDraft = $derived(draft ?? createBlankDefinition());
	const isDirty = $derived(!definitionsEqual(draft, baselineDraft));
	// Fingerprint that changes on every deep mutation of the draft. We read it
	// inside the autosave effect so each keystroke resets the debounce timer.
	const draftFingerprint = $derived(
		draft ? JSON.stringify(normalizeDefinitionForCompare(draft)) : ''
	);
	const busy = $derived(isPublishing || isEnsuringWaiver);
	const publishDisabled = $derived(
		busy ||
			isDirty ||
			isSaving ||
			!workspaceWaiver ||
			(workspaceWaiver.isActivePublic && !workspaceWaiver.hasUnpublishedChanges)
	);

	const saveState = $derived<SaveState>(
		(() => {
			if (lastSaveError) return 'error';
			if (isSaving) return 'saving';
			if (isDirty) return 'dirty';
			if (lastSavedAt) return 'saved';
			return 'idle';
		})()
	);

	beforeNavigate((navigation) => {
		if (!isDirty && !isSaving) return;
		if (navigation.willUnload) return;
		navigation.cancel();
		toast.message('Still saving your latest changes. Give it a moment and try again.');
	});

	$effect(() => {
		if (
			!currentWorkspace ||
			isLoadingProtectedData ||
			!!workspaceWaiver ||
			isEnsuringWaiver ||
			convex.disabled
		) {
			return;
		}
		void ensureWorkspaceWaiver();
	});

	$effect(() => {
		if (!workspaceWaiver || !selectedFingerprint) {
			draft = null;
			baselineDraft = null;
			hydratedWaiverId = null;
			hydratedFingerprint = null;
			return;
		}

		if (
			workspaceWaiver.waiverId !== hydratedWaiverId ||
			(!isDirty && selectedFingerprint !== hydratedFingerprint)
		) {
			const nextDraft = cloneDefinition(workspaceWaiver);
			draft = nextDraft;
			baselineDraft = cloneDefinition(nextDraft);
			hydratedWaiverId = workspaceWaiver.waiverId;
			hydratedFingerprint = selectedFingerprint;
			lastSavedAt = null;
			lastSaveError = false;
		}
	});

	// Debounced autosave: whenever the draft diverges from baseline, schedule a
	// save. Re-triggers on every deep change via `draftFingerprint`; only the
	// trailing call runs.
	$effect(() => {
		// Subscribe to every deep mutation of the draft AND to the save cycle, so that
		// if the user keeps editing while a save is in flight, we re-schedule an
		// autosave the moment the in-flight save completes.
		void draftFingerprint;
		void isSaving;

		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
			autosaveTimer = null;
		}

		// Gate the save scheduling outside of reactive tracking so we don't subscribe
		// to unrelated state like workspaceWaiver metadata or the convex client flag.
		untrack(() => {
			if (!workspaceWaiver || !currentWorkspace) return;
			if (!isDirty) return;
			if (isSaving) return;
			if (convex.disabled) return;

			autosaveTimer = setTimeout(() => {
				void runAutosave();
			}, AUTOSAVE_DELAY_MS);
		});

		return () => {
			if (autosaveTimer) {
				clearTimeout(autosaveTimer);
				autosaveTimer = null;
			}
		};
	});

	onMount(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!isDirty && !isSaving) return;
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			if (copyFeedbackTimer) {
				clearTimeout(copyFeedbackTimer);
				copyFeedbackTimer = null;
			}
		};
	});

	function syncBaseline(definition: WaiverDefinition) {
		baselineDraft = cloneDefinition(definition);
		hydratedFingerprint = JSON.stringify(normalizeDefinitionForCompare(definition));
	}

	async function runAutosave() {
		if (!draft || !workspaceWaiver || !currentWorkspace || convex.disabled) return;
		if (isSaving) return;
		if (definitionsEqual(draft, baselineDraft)) return;

		const snapshot = cloneDefinition(draft);
		const targetWaiverId = workspaceWaiver.waiverId;
		const workspaceId = currentWorkspace.workspaceId;

		isSaving = true;
		lastSaveError = false;

		try {
			await convex.mutation(api.waivers.updateWorkspaceWaiver, {
				workspaceId,
				waiverId: targetWaiverId,
				definition: snapshot
			});

			// If the user continued editing while we saved, the current draft may
			// have moved on. Re-baseline to the snapshot we just persisted so the
			// new diff only covers the post-save edits.
			if (workspaceWaiver && workspaceWaiver.waiverId === targetWaiverId) {
				syncBaseline(snapshot);
				lastSavedAt = Date.now();
			}
		} catch (error) {
			lastSaveError = true;
			toast.error(getConvexErrorMessage(error, 'We could not save your latest changes.'));
		} finally {
			isSaving = false;
		}
	}

	async function flushAutosave() {
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
			autosaveTimer = null;
		}
		await runAutosave();
	}

	function startTitleEdit() {
		if (!draft) return;
		titleDraft = draft.title;
		isEditingTitle = true;
		queueMicrotask(() => {
			titleInputEl?.focus();
			titleInputEl?.select();
		});
	}

	function commitTitleEdit() {
		if (!draft) {
			isEditingTitle = false;
			return;
		}
		const next = titleDraft.trim();
		if (next.length > 0) {
			draft.title = next;
		}
		isEditingTitle = false;
	}

	function cancelTitleEdit() {
		isEditingTitle = false;
		titleDraft = '';
	}

	function handleTitleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitTitleEdit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelTitleEdit();
		}
	}

	function publishButtonLabel(waiver: WorkspaceWaiverSummary | null) {
		if (!waiver) return 'Publish';
		if (waiver.isActivePublic && !waiver.hasUnpublishedChanges) return 'Live';
		if (waiver.lastPublishedVersionId && waiver.hasUnpublishedChanges) return 'Publish changes';
		if (waiver.lastPublishedVersionId) return 'Republish';
		return 'Publish';
	}

	function openConfirm(kind: ConfirmKind) {
		confirmKind = kind;
		confirmOpen = true;
	}

	function confirmConfig(kind: ConfirmKind) {
		switch (kind) {
			case 'publish':
				return {
					title: 'Publish this waiver?',
					description:
						'This creates a new published version and makes it the live waiver guests will sign.',
					confirmLabel: 'Publish waiver',
					destructive: false
				};
		}
	}

	function openVersionHistory() {
		versionHistoryOpen = true;
	}

	async function copyText(key: string, text: string) {
		try {
			copyingKey = key;
			await navigator.clipboard.writeText(text);
			copiedKey = key;
			if (copyFeedbackTimer) {
				clearTimeout(copyFeedbackTimer);
			}
			copyFeedbackTimer = setTimeout(() => {
				if (copiedKey === key) {
					copiedKey = null;
				}
				copyFeedbackTimer = null;
			}, 1600);
			toast.success('Copied to clipboard.');
		} catch {
			toast.error('Unable to copy to the clipboard.');
		} finally {
			copyingKey = null;
		}
	}

	async function ensureWorkspaceWaiver() {
		if (convex.disabled || !currentWorkspace) {
			toast.error('Waiver editor is still loading. Please try again.');
			return;
		}

		isEnsuringWaiver = true;

		try {
			await convex.mutation(api.waivers.ensureWorkspaceWaiver, {
				workspaceId: currentWorkspace.workspaceId
			});
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to set up this workspace waiver.'));
		} finally {
			isEnsuringWaiver = false;
		}
	}

	async function publishWorkspaceWaiver() {
		if (convex.disabled || !currentWorkspace || !workspaceWaiver) return;

		// Ensure any pending edits are persisted before publishing.
		await flushAutosave();
		if (lastSaveError) return;

		isPublishing = true;

		try {
			await convex.mutation(api.waivers.publishWorkspaceWaiver, {
				workspaceId: currentWorkspace.workspaceId,
				waiverId: workspaceWaiver.waiverId
			});

			confirmOpen = false;
			confirmKind = null;
			toast.success('Waiver published.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to publish this waiver.'));
		} finally {
			isPublishing = false;
		}
	}

	async function handleConfirm() {
		switch (confirmKind) {
			case 'publish':
				await publishWorkspaceWaiver();
				return;
			default:
				return;
		}
	}
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Waiver | Waiver Director</title>
</svelte:head>

{#if confirmKind}
	<ConfirmDialog
		bind:open={confirmOpen}
		title={confirmConfig(confirmKind).title}
		description={confirmConfig(confirmKind).description}
		confirmLabel={confirmConfig(confirmKind).confirmLabel}
		destructive={confirmConfig(confirmKind).destructive}
		isConfirming={isPublishing}
		onConfirm={handleConfirm}
	/>
{/if}

{#if currentWorkspace}
	<WaiverVersionHistorySheet
		bind:open={versionHistoryOpen}
		workspaceId={currentWorkspace.workspaceId}
	/>
{/if}

{#if activePublicUrl}
	<Dialog bind:open={qrDialogOpen}>
		<DialogContent class="max-w-xs gap-0 overflow-hidden p-0">
			<DialogHeader class="border-b border-border px-5 py-4">
				<DialogTitle>QR Code</DialogTitle>
				<DialogDescription>Scan to open the live waiver form.</DialogDescription>
			</DialogHeader>
			<div class="flex flex-col items-center gap-4 p-6">
				<QrCodePreview text={activePublicUrl} size={200} />
				<button
					type="button"
					class="public-url-copy public-url-copy-dialog"
					class:is-copied={copiedKey === 'link'}
					onclick={() => copyText('link', activePublicUrl)}
					disabled={copyingKey === 'link'}
					aria-label="Copy waiver link"
				>
					<span class="public-url-copy-text">{activePublicUrl}</span>
					<span class="public-url-copy-icon" aria-hidden="true">
						{#if copiedKey === 'link'}
							<CheckIcon class="size-3.5" />
						{:else}
							<ClipboardIcon class="size-3.5" />
						{/if}
					</span>
				</button>
				<Button variant="outline" class="w-full" onclick={() => copyText('link', activePublicUrl)}>
					{copiedKey === 'link' ? 'Copied link' : 'Copy link'}
				</Button>
			</div>
		</DialogContent>
	</Dialog>
{/if}

<TooltipProvider delayDuration={200}>
	<div class="builder-shell flex h-full min-h-0 w-full flex-col bg-background">
		<!-- TOP BAR: share + publish -->
		<header
			class="builder-topbar flex shrink-0 items-stretch gap-0 border-b border-border/80 bg-card/30"
		>
			{#if isLoadingProtectedData}
				<div class="flex flex-1 items-center gap-3 px-4 py-2.5">
					<Skeleton class="h-5 w-24" />
					<Skeleton class="h-4 w-64" />
					<div class="ml-auto flex items-center gap-2">
						<Skeleton class="h-8 w-20" />
						<Skeleton class="h-8 w-24" />
					</div>
				</div>
			{:else if publishingOverview.activeLink && activePublicUrl}
				<div class="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">
					<div class="flex shrink-0 items-center gap-1.5">
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
					<div class="hidden h-4 w-px shrink-0 bg-border sm:block"></div>
					<div class="hidden min-w-0 flex-1 sm:block">
						<button
							type="button"
							class="public-url-copy"
							class:is-copied={copiedKey === 'link'}
							onclick={() => copyText('link', activePublicUrl)}
							disabled={copyingKey === 'link'}
							aria-label="Copy waiver link"
						>
							<span class="public-url-copy-label" aria-hidden="true">URL</span>
							<span class="public-url-copy-divider" aria-hidden="true"></span>
							<span class="public-url-copy-text">{activePublicUrl}</span>
							<span class="public-url-copy-icon" aria-hidden="true">
								{#if copiedKey === 'link'}
									<CheckIcon class="size-3.5" />
								{:else}
									<ClipboardIcon class="size-3.5" />
								{/if}
							</span>
						</button>
					</div>

					<div class="flex shrink-0 items-center gap-1">
						<div class="sm:hidden">
							<Tooltip>
								<TooltipTrigger class="inline-flex">
									<button
										type="button"
										class="topbar-icon-btn"
										onclick={() => copyText('link', activePublicUrl)}
										disabled={copyingKey === 'link'}
										aria-label="Copy link"
									>
										{#if copiedKey === 'link'}
											<CheckIcon class="size-3.5 text-emerald-500" />
										{:else}
											<ClipboardIcon class="size-3.5" />
										{/if}
									</button>
								</TooltipTrigger>
								<TooltipContent side="bottom" sideOffset={4}>
									{copiedKey === 'link' ? 'Copied!' : 'Copy link'}
								</TooltipContent>
							</Tooltip>
						</div>

						<Tooltip>
							<TooltipTrigger class="inline-flex">
								<button
									type="button"
									class="topbar-icon-btn"
									onclick={() => copyText('embed', activeEmbedSnippet)}
									disabled={copyingKey === 'embed'}
									aria-label="Copy embed code"
								>
									{#if copiedKey === 'embed'}
										<CheckIcon class="size-3.5 text-emerald-500" />
									{:else}
										<Code2Icon class="size-3.5" />
									{/if}
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom" sideOffset={4}>
								{copiedKey === 'embed' ? 'Copied!' : 'Copy embed code'}
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger class="inline-flex">
								<a
									href={resolve(`/w/${publishingOverview.activeLink.slug}` as `/w/${string}`)}
									target="_blank"
									rel="noopener noreferrer"
									class="topbar-icon-btn"
									aria-label="Open live waiver"
								>
									<ExternalLinkIcon class="size-3.5" />
								</a>
							</TooltipTrigger>
							<TooltipContent side="bottom" sideOffset={4}>Open live waiver</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger class="inline-flex">
								<button
									type="button"
									class="topbar-icon-btn"
									onclick={() => (qrDialogOpen = true)}
									aria-label="Show QR code"
								>
									<QrCodeIcon class="size-3.5" />
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom" sideOffset={4}>Show QR code</TooltipContent>
						</Tooltip>
					</div>
				</div>
			{:else}
				<div class="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">
					<span
						class="shrink-0 text-[10px] font-bold tracking-[0.2em] text-muted-foreground/60 uppercase"
					>
						Not live
					</span>
					<p class="truncate text-[13px] text-muted-foreground">
						Publish this waiver to share a public signing link with your guests.
					</p>
				</div>
			{/if}

			<!-- Right cluster: secondary menu + publish -->
			<div class="flex shrink-0 items-center gap-1 border-l border-border/80 px-2">
				{#if workspaceWaiver}
					<DropdownMenu>
						<DropdownMenuTrigger class="inline-flex">
							<button
								type="button"
								class="topbar-icon-btn"
								aria-label="More actions"
								title="More actions"
							>
								<EllipsisIcon class="size-4" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" class="w-56">
							<DropdownMenuItem onclick={openVersionHistory}>Version history</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				{/if}

				{#if workspaceWaiver}
					<Button
						type="button"
						size="sm"
						onclick={() => openConfirm('publish')}
						disabled={publishDisabled}
						class="publish-btn ml-1 h-8 gap-1.5"
					>
						<UploadCloudIcon class="size-3.5" />
						<span>{isPublishing ? 'Publishing…' : publishButtonLabel(workspaceWaiver)}</span>
					</Button>
				{/if}
			</div>
		</header>

		<!-- WAIVER BUILDER BODY -->
		{#if isLoadingProtectedData}
			<div class="flex flex-1 flex-col lg:flex-row">
				<aside
					class="builder-panel w-full shrink-0 border-b border-border/80 bg-card/20 lg:w-96 lg:border-r lg:border-b-0"
				>
					<div class="flex h-full min-h-0 flex-col">
						<div
							class="title-bar flex shrink-0 items-center gap-1.5 border-b border-border/80 bg-card/40 px-4 py-2"
						>
							<Skeleton class="h-2.5 w-14" />
							<span class="h-3.5 w-px shrink-0 bg-border"></span>
							<Skeleton class="h-4 min-w-0 flex-1" />
							<Skeleton class="h-[1.85rem] w-[1.85rem] shrink-0 rounded-md" />
						</div>
						<div
							class="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-4 py-2.5"
						>
							<div class="min-w-0 space-y-1.5">
								<Skeleton class="h-2.5 w-28" />
								<Skeleton class="h-2.5 w-36" />
							</div>
							<Skeleton class="h-8 w-20 shrink-0 rounded-md" />
						</div>
						<div class="min-h-0 flex-1 overflow-hidden p-4">
							<div class="space-y-1.5">
								{#each [0, 1, 2] as index (index)}
									<div
										class="flex min-w-0 overflow-hidden rounded-[0.55rem] border border-border bg-card/20"
									>
										<Skeleton class="w-6 shrink-0 rounded-none bg-muted/30" />
										<div class="min-w-0 flex-1 px-2.5 py-1.5">
											<div class="flex items-center justify-between gap-2">
												<div class="flex min-w-0 items-center gap-1.5">
													<Skeleton class="h-[1.2rem] w-20 rounded-full" />
													<Skeleton class="h-[0.85rem] w-6 rounded-full" />
													<Skeleton class="h-2.5 w-12" />
												</div>
												<Skeleton class="h-6 w-6 rounded-md" />
											</div>
											<Skeleton class="mt-1.5 h-[1.9rem] w-full rounded-md" />
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</aside>
				<section class="min-h-0 flex-1 p-8">
					<Skeleton class="mx-auto h-[70vh] w-full max-w-3xl rounded-[28px]" />
				</section>
			</div>
		{:else if !workspaceWaiver}
			<div class="flex flex-1 items-center justify-center p-6">
				<div
					class="w-full max-w-md rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-14 text-center"
				>
					<p class="text-base font-semibold tracking-tight">Setting up waiver</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Every workspace includes one public waiver. This should only take a moment.
					</p>
				</div>
			</div>
		{:else if workspaceWaiver}
			<div class="flex min-h-0 flex-1 flex-col lg:flex-row">
				<!-- Left panel (edit) -->
				<aside
					class="builder-panel w-full shrink-0 border-b border-border/80 bg-card/20 lg:w-96 lg:border-r lg:border-b-0"
				>
					<div class="flex h-full min-h-0 flex-col">
						<!-- Inline editable title row -->
						<div
							class="title-bar flex shrink-0 items-center gap-1.5 border-b border-border/80 bg-card/40 px-4 py-2"
						>
							<span
								class="shrink-0 text-[10px] font-bold tracking-[0.22em] text-muted-foreground/55 uppercase"
							>
								Waiver
							</span>
							<span class="h-3.5 w-px shrink-0 bg-border"></span>
							<div class="title-row group min-w-0 flex-1" class:is-editing={isEditingTitle}>
								{#if isEditingTitle}
									<div class="title-edit-frame">
										<input
											bind:this={titleInputEl}
											type="text"
											bind:value={titleDraft}
											maxlength={120}
											placeholder="Untitled waiver"
											class="title-input"
											onkeydown={handleTitleKeydown}
											onblur={commitTitleEdit}
										/>
										<div class="title-action-cluster">
											<button
												type="button"
												class="title-icon-btn is-confirm"
												onmousedown={(e) => {
													e.preventDefault();
													commitTitleEdit();
												}}
												aria-label="Confirm title"
											>
												<CheckIcon class="size-3" />
											</button>
											<button
												type="button"
												class="title-icon-btn is-cancel"
												onmousedown={(e) => {
													e.preventDefault();
													cancelTitleEdit();
												}}
												aria-label="Cancel edit"
											>
												<XIcon class="size-3" />
											</button>
										</div>
									</div>
								{:else}
									<button
										type="button"
										class="title-display-btn"
										onclick={startTitleEdit}
										title="Rename waiver"
										aria-label="Rename waiver"
									>
										<span class="title-display-text">
											{currentDraft.title || 'Untitled waiver'}
										</span>
										<Pencil class="title-display-icon size-3" />
									</button>
								{/if}
							</div>
						</div>

						<div class="min-h-0 flex-1 overflow-hidden">
							<WaiverBuilderPanel bind:draft />
						</div>
					</div>
				</aside>

				<!-- Right canvas (document) -->
				<div class="builder-canvas flex min-h-0 min-w-0 flex-1">
					{#if draft}
						<WaiverBuilderCanvas
							bind:introCopy={draft.introCopy}
							fields={currentDraft.fields}
							workspaceName={currentWorkspace?.name}
							{saveState}
							{lastSavedAt}
						/>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</TooltipProvider>

<style>
	.builder-shell {
		height: 100%;
	}

	.topbar-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 2rem;
		width: 2rem;
		border-radius: 0.5rem;
		color: var(--muted-foreground);
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.topbar-icon-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--muted) 70%, transparent);
		color: var(--foreground);
	}

	.topbar-icon-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.public-url-copy {
		display: inline-flex;
		max-width: 100%;
		min-width: 0;
		align-items: center;
		gap: 0.5rem;
		height: 1.65rem;
		padding: 0 0.55rem 0 0.5rem;
		border-radius: 9999px;
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		background: color-mix(in srgb, var(--muted) 35%, transparent);
		font-family: var(--font-sans);
		font-size: 0.7rem;
		line-height: 1;
		color: color-mix(in srgb, var(--muted-foreground) 85%, var(--foreground));
		text-align: left;
		transition:
			color 160ms ease,
			background 160ms ease,
			border-color 160ms ease,
			box-shadow 160ms ease;
	}

	.public-url-copy:hover:not(:disabled),
	.public-url-copy:focus-visible {
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted) 65%, transparent);
		border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
		outline: none;
	}

	.public-url-copy:focus-visible {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
	}

	.public-url-copy:disabled {
		cursor: wait;
	}

	.public-url-copy.is-copied {
		color: oklch(0.596 0.145 163.225);
		border-color: color-mix(in srgb, oklch(0.596 0.145 163.225) 45%, var(--border));
		background: color-mix(in srgb, oklch(0.596 0.145 163.225) 10%, transparent);
	}

	.public-url-copy-label {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
		transition: color 160ms ease;
	}

	.public-url-copy:hover .public-url-copy-label,
	.public-url-copy:focus-visible .public-url-copy-label {
		color: color-mix(in srgb, var(--primary) 70%, var(--foreground));
	}

	.public-url-copy.is-copied .public-url-copy-label {
		color: oklch(0.596 0.145 163.225);
	}

	.public-url-copy-divider {
		display: inline-block;
		flex: 0 0 auto;
		width: 1px;
		height: 0.75rem;
		background: color-mix(in srgb, var(--border) 100%, transparent);
		transition: background 160ms ease;
	}

	.public-url-copy:hover .public-url-copy-divider,
	.public-url-copy:focus-visible .public-url-copy-divider {
		background: color-mix(in srgb, var(--primary) 30%, var(--border));
	}

	.public-url-copy.is-copied .public-url-copy-divider {
		background: color-mix(in srgb, oklch(0.596 0.145 163.225) 40%, var(--border));
	}

	.public-url-copy-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.7rem;
		letter-spacing: -0.01em;
	}

	.public-url-copy-icon {
		display: inline-flex;
		flex: 0 0 auto;
		color: color-mix(in srgb, var(--muted-foreground) 80%, transparent);
		transition:
			color 160ms ease,
			transform 240ms cubic-bezier(0.22, 1.2, 0.36, 1);
	}

	.public-url-copy:hover .public-url-copy-icon,
	.public-url-copy:focus-visible .public-url-copy-icon {
		color: color-mix(in srgb, var(--primary) 85%, var(--foreground));
	}

	.public-url-copy.is-copied .public-url-copy-icon {
		color: oklch(0.596 0.145 163.225);
		transform: scale(1.12);
	}

	.public-url-copy-dialog {
		width: 100%;
		justify-content: center;
		padding: 0.5rem 0.75rem;
		height: auto;
		text-align: center;
	}

	.public-url-copy-dialog .public-url-copy-text {
		white-space: normal;
		overflow-wrap: anywhere;
	}

	.title-bar {
		min-height: 2.85rem;
	}

	.title-row {
		min-width: 0;
	}

	.title-edit-frame {
		display: flex;
		height: 1.85rem;
		min-width: 0;
		align-items: center;
		gap: 0.3rem;
	}

	.title-display-btn {
		display: inline-flex;
		height: 1.85rem;
		width: 100%;
		min-width: 0;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.45rem;
		border-radius: 0.4rem;
		text-align: left;
		transition:
			background 160ms ease,
			color 160ms ease;
	}

	.title-display-btn:hover,
	.title-display-btn:focus-visible {
		background: color-mix(in srgb, var(--muted) 55%, transparent);
		outline: none;
	}

	.title-display-btn:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent);
	}

	.title-display-text {
		min-width: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);
	}

	:global(.title-display-icon) {
		flex: 0 0 auto;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
		opacity: 0;
		transform: translateX(-0.15rem);
		transition:
			opacity 160ms ease,
			transform 160ms ease,
			color 160ms ease;
	}

	.title-display-btn:hover :global(.title-display-icon),
	.title-display-btn:focus-visible :global(.title-display-icon) {
		opacity: 1;
		transform: translateX(0);
		color: color-mix(in srgb, var(--primary) 70%, var(--foreground));
	}

	.title-action-cluster {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.2rem;
	}

	.title-input {
		flex: 1;
		min-width: 0;
		height: 1.85rem;
		padding: 0 0.55rem;
		border-radius: 0.4rem;
		border: 1px solid color-mix(in srgb, var(--primary) 45%, var(--border));
		background: var(--background);
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
		outline: none;
	}

	.title-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 1.5rem;
		width: 1.5rem;
		border-radius: 0.3rem;
		color: color-mix(in srgb, var(--muted-foreground) 80%, transparent);
		transition:
			background 150ms ease,
			color 150ms ease,
			opacity 150ms ease;
	}

	.title-icon-btn:hover {
		background: color-mix(in srgb, var(--muted) 70%, transparent);
		color: var(--foreground);
	}

	.title-icon-btn.is-confirm {
		color: color-mix(in srgb, var(--primary) 85%, var(--foreground));
	}

	.title-icon-btn.is-confirm:hover {
		background: color-mix(in srgb, var(--primary) 14%, transparent);
		color: var(--primary);
	}

	.title-icon-btn.is-cancel:hover {
		background: color-mix(in srgb, var(--destructive) 14%, transparent);
		color: var(--destructive);
	}

	:global(.publish-btn) {
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1) inset;
	}
</style>
