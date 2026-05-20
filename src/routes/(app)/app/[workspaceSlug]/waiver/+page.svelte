<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount, tick, untrack } from 'svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { publicEnv } from '$lib/config/public';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import QrCodeDialog from '$lib/components/waivers/QrCodeDialog.svelte';
	import WaiverVersionHistorySheet from '$lib/components/waivers/WaiverVersionHistorySheet.svelte';
	import WaiverBuilderCanvas, {
		type SaveState
	} from '$lib/components/waivers/WaiverBuilderCanvas.svelte';
	import WaiverBuilderPanel from '$lib/components/waivers/WaiverBuilderPanel.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
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
		isWaiverDefinitionAutosaveable,
		normalizeDefinitionForCompare,
		type WaiverDefinition
	} from '$lib/domain/waivers';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import Code2Icon from '@lucide/svelte/icons/code-xml';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CheckIcon from '@lucide/svelte/icons/check';
	import QrCodeIcon from '@lucide/svelte/icons/qr-code';
	import UploadCloudIcon from '@lucide/svelte/icons/cloud-upload';
	import Pencil from '@lucide/svelte/icons/pencil';
	import XIcon from '@lucide/svelte/icons/x';

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((workspace) => workspace.slug === page.params.workspaceSlug) ?? null
	);

	type WorkspaceWaiverSummary = FunctionReturnType<typeof api.waivers.getWorkspaceWaiver>;
	type ConfirmKind = 'publish';

	const convex = useConvexClient();

	const waiverQuery = useProtectedQuery(
		api.waivers.getWorkspaceWaiver,
		() => (currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);

	const workspaceWaiver = $derived((waiverQuery.data ?? null) as WorkspaceWaiverSummary | null);
	const isLoadingProtectedData = $derived(appContext.isLoading || waiverQuery.isLoading);

	let draft = $state<WaiverDefinition | null>(null);
	let baselineDraft = $state<WaiverDefinition | null>(null);
	let hydratedWaiverId = $state<WorkspaceWaiverSummary['waiverId'] | null>(null);
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
	let lastSaveError = $state<string | null>(null);
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
	const AUTOSAVE_DELAY_MS = 800;

	let isPublishing = $state(false);

	let confirmKind = $state<ConfirmKind | null>(null);
	let confirmOpen = $state(false);

	const activePublicHref = $derived.by(() => {
		if (!workspaceWaiver?.publishedVersionId) return null;
		return resolve(`/w/${workspaceWaiver.publicSlug}` as `/w/${string}`);
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
	const currentDraft = $derived(draft ?? createBlankDefinition());
	const isDirty = $derived(!definitionsEqual(draft, baselineDraft));
	// Fingerprint that changes on every deep mutation of the draft. We read it
	// inside the autosave effect so each keystroke resets the debounce timer.
	const draftFingerprint = $derived(
		draft ? JSON.stringify(normalizeDefinitionForCompare(draft)) : ''
	);
	let lastObservedDraftFingerprint = $state('');
	const draftCanAutosave = $derived(isWaiverDefinitionAutosaveable(draft));
	const publishDisabled = $derived(
		isPublishing ||
			isDirty ||
			isSaving ||
			!workspaceWaiver ||
			(!!workspaceWaiver.publishedVersionId && !workspaceWaiver.hasUnpublishedChanges)
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

		if (saveState === 'error' || lastSaveError) {
			toast.message('Autosave failed - your changes may not be saved.');
			return;
		}

		navigation.cancel();
		toast.message('Still saving your latest changes. Give it a moment and try again.');
	});

	$effect(() => {
		if (!workspaceWaiver) {
			draft = null;
			baselineDraft = null;
			hydratedWaiverId = null;
			return;
		}

		const isNewWaiver = workspaceWaiver.waiverId !== hydratedWaiverId;
		if (!isNewWaiver) return;

		const nextDraft = cloneDefinition(workspaceWaiver);
		draft = nextDraft;
		baselineDraft = cloneDefinition(nextDraft);
		hydratedWaiverId = workspaceWaiver.waiverId;
		lastSavedAt = null;
		lastSaveError = null;
	});

	$effect(() => {
		const currentFingerprint = draftFingerprint;

		untrack(() => {
			if (lastSaveError && currentFingerprint !== lastObservedDraftFingerprint) {
				lastSaveError = null;
			}
			lastObservedDraftFingerprint = currentFingerprint;
		});
	});

	// Debounced autosave: whenever the draft diverges from baseline, schedule a
	// save. Re-triggers on every deep change via `draftFingerprint`; only the
	// trailing call runs.
	$effect(() => {
		// Subscribe to every deep mutation of the draft AND to the save cycle, so that
		// if the user keeps editing while a save is in flight, we re-schedule an
		// autosave the moment the in-flight save completes.
		void draftFingerprint;
		void draftCanAutosave;
		void isSaving;
		void lastSaveError;

		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
			autosaveTimer = null;
		}

		// Gate the save scheduling outside of reactive tracking so we don't subscribe
		// to unrelated state like workspaceWaiver metadata or the convex client flag.
		untrack(() => {
			if (!workspaceWaiver || !currentWorkspace) return;
			if (!isDirty) return;
			if (!draftCanAutosave) return;
			if (isSaving) return;
			if (lastSaveError) return;
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
	}

	async function runAutosave() {
		if (!draft || !workspaceWaiver || !currentWorkspace || convex.disabled) return;
		if (isSaving) return;
		if (definitionsEqual(draft, baselineDraft)) return;
		if (!isWaiverDefinitionAutosaveable(draft)) return;

		const snapshot = cloneDefinition(draft);
		const targetWaiverId = workspaceWaiver.waiverId;
		const workspaceId = currentWorkspace.workspaceId;

		isSaving = true;
		lastSaveError = null;

		try {
			await convex.mutation(api.waivers.updateWorkspaceWaiver, {
				workspaceId,
				waiverId: targetWaiverId,
				definition: snapshot
			});

			// If the user continued editing while we saved, the current draft may
			// have moved on. Only re-baseline if the saved snapshot is still the
			// visible draft; otherwise leave the newer local edits dirty so the next
			// autosave persists them.
			if (
				workspaceWaiver &&
				workspaceWaiver.waiverId === targetWaiverId &&
				definitionsEqual(draft, snapshot)
			) {
				syncBaseline(snapshot);
				lastSavedAt = Date.now();
			}
		} catch (error) {
			const message = getConvexErrorMessage(error, 'We could not save your latest changes.');
			lastSaveError = message;
			toast.error(message);
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

	async function startTitleEdit() {
		if (!draft) return;
		titleDraft = draft.title;
		isEditingTitle = true;
		await tick();
		titleInputEl?.focus();
		titleInputEl?.select();
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
		if (waiver.publishedVersionId && !waiver.hasUnpublishedChanges) return 'Live';
		if (waiver.publishedVersionId && waiver.hasUnpublishedChanges) return 'Publish changes';
		if (waiver.publishedVersionId) return 'Republish';
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

	async function handlePublish() {
		if (convex.disabled || !currentWorkspace || !workspaceWaiver) return;

		isPublishing = true;

		// Ensure any pending edits are persisted before publishing.
		await flushAutosave();
		if (lastSaveError || isDirty) {
			isPublishing = false;
			toast.error(
				lastSaveError ??
					'Your latest changes have not finished saving. Wait a moment and try again.'
			);
			return;
		}

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
				await handlePublish();
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
	<QrCodeDialog
		bind:open={qrDialogOpen}
		title="Waiver QR code"
		description="Scan to open the live waiver form."
		url={activePublicUrl}
		copySuccessMessage="Waiver link copied."
		copyErrorMessage="Unable to copy waiver link."
		logContext="waiver/qr-dialog"
	/>
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
						<Skeleton class="h-8 w-20 rounded-md" />
						<Skeleton class="h-8 w-24 rounded-md" />
					</div>
				</div>
			{:else if activePublicUrl && workspaceWaiver}
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
								<TooltipTrigger
									class="topbar-icon-btn"
									onclick={() => copyText('link', activePublicUrl)}
									disabled={copyingKey === 'link'}
									aria-label="Copy link"
								>
									{#snippet child({ props })}
										<button {...props}>
											{#if copiedKey === 'link'}
												<CheckIcon class="size-3.5 text-emerald-500" />
											{:else}
												<ClipboardIcon class="size-3.5" />
											{/if}
										</button>
									{/snippet}
								</TooltipTrigger>
								<TooltipContent side="bottom" sideOffset={4}>
									{copiedKey === 'link' ? 'Copied!' : 'Copy link'}
								</TooltipContent>
							</Tooltip>
						</div>

						<Tooltip>
							<TooltipTrigger
								class="topbar-icon-btn"
								onclick={() => copyText('embed', activeEmbedSnippet)}
								disabled={copyingKey === 'embed'}
								aria-label="Copy embed code"
							>
								{#snippet child({ props })}
									<button {...props}>
										{#if copiedKey === 'embed'}
											<CheckIcon class="size-3.5 text-emerald-500" />
										{:else}
											<Code2Icon class="size-3.5" />
										{/if}
									</button>
								{/snippet}
							</TooltipTrigger>
							<TooltipContent side="bottom" sideOffset={4}>
								{copiedKey === 'embed' ? 'Copied!' : 'Copy embed code'}
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger class="topbar-icon-btn" aria-label="Open live waiver">
								{#snippet child({ props })}
									<a
										href={resolve(`/w/${workspaceWaiver.publicSlug}` as `/w/${string}`)}
										target="_blank"
										rel="noopener noreferrer"
										{...props}
									>
										<ExternalLinkIcon class="size-3.5" />
									</a>
								{/snippet}
							</TooltipTrigger>
							<TooltipContent side="bottom" sideOffset={4}>Open live waiver</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger
								class="topbar-icon-btn"
								onclick={() => (qrDialogOpen = true)}
								aria-label="Show QR code"
							>
								{#snippet child({ props })}
									<button {...props}>
										<QrCodeIcon class="size-3.5" />
									</button>
								{/snippet}
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
						<DropdownMenuTrigger
							class="topbar-icon-btn"
							aria-label="More actions"
							title="More actions"
						>
							{#snippet child({ props })}
								<button {...props}>
									<EllipsisIcon class="size-4" />
								</button>
							{/snippet}
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
										class="flex min-w-0 overflow-hidden rounded-lg border border-border bg-card/20"
									>
										<Skeleton class="w-6 shrink-0 rounded-none bg-muted/30" />
										<div class="min-w-0 flex-1 px-2.5 py-1.5">
											<div class="flex items-center justify-between gap-2">
												<div class="flex min-w-0 items-center gap-1.5">
													<Skeleton class="h-[1.2rem] w-20 rounded-full" />
													<Skeleton class="h-[0.85rem] w-6 rounded-full" />
													<Skeleton class="h-2.5 w-12" />
												</div>
												<Skeleton class="h-6 w-6 rounded-sm" />
											</div>
											<Skeleton class="mt-1.5 h-[1.9rem] w-full rounded-md" />
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</aside>
				<section class="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
					<div
						class="canvas-toolbar flex shrink-0 items-center gap-2 border-b border-border/80 bg-card/40 px-4 py-2 backdrop-blur-sm"
					>
						<div class="flex min-w-0 flex-1 items-center gap-2">
							<Skeleton class="h-[1.7rem] w-36 rounded-full" />
						</div>

						<div class="flex items-center gap-1">
							<Skeleton class="h-[1.85rem] w-16 rounded-md" />
							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />

							<span class="mx-1 h-5 w-px shrink-0 bg-border/80"></span>

							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />
							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />
							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />
							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />

							<span class="mx-1 h-5 w-px shrink-0 bg-border/80"></span>

							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />
							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />

							<span class="mx-1 h-5 w-px shrink-0 bg-border/80"></span>

							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />
							<Skeleton class="h-[1.85rem] w-[1.85rem] rounded-md" />
						</div>
					</div>

					<div class="flex-1 overflow-y-auto overscroll-y-contain">
						<div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
							<div class="space-y-6">
								<section class="rounded-4xl border border-border bg-card p-6 shadow-sm sm:p-8">
									<div class="space-y-3">
										<Skeleton class="h-4 w-11/12" />
										<Skeleton class="h-4 w-full" />
										<Skeleton class="h-4 w-5/6" />
										<Skeleton class="h-4 w-2/3" />
									</div>
								</section>

								<section class="rounded-4xl border border-border bg-card p-6 shadow-sm sm:p-8">
									<Skeleton class="h-6 w-36" />
									<div class="mt-8 space-y-6">
										<div class="space-y-2">
											<Skeleton class="h-3 w-20" />
											<Skeleton class="h-8 w-full rounded-none" />
										</div>
										<div class="space-y-2">
											<Skeleton class="h-3 w-12" />
											<Skeleton class="h-8 w-full rounded-none" />
										</div>
										<div class="space-y-2">
											<Skeleton class="h-3 w-24" />
											<Skeleton class="h-8 w-full rounded-none" />
										</div>
										<div class="border-t border-border pt-8">
											<Skeleton class="h-6 w-24" />
											<Skeleton class="mt-7 h-[180px] w-full rounded-2xl" />
										</div>
									</div>
								</section>
							</div>
						</div>
					</div>
				</section>
			</div>
		{:else if !workspaceWaiver}
			<div class="flex flex-1 items-center justify-center p-6">
				<div
					class="w-full max-w-md rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-14 text-center"
				>
					<p class="text-base font-semibold tracking-tight">Waiver unavailable</p>
					<p class="mt-1 text-sm text-muted-foreground">
						This workspace is missing its waiver record.
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
							workspaceId={currentWorkspace?.workspaceId ?? null}
							canEditBranding={currentWorkspace?.role === 'owner'}
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
		border-radius: var(--radius-md);
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
		border-radius: var(--radius-full);
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
		border-radius: var(--radius-md);
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
		border-radius: var(--radius-md);
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
		border-radius: var(--radius-sm);
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
