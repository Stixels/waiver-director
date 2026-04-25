<script lang="ts">
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import type { FunctionReturnType } from 'convex/server';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { escapeHtml } from '$lib/utils/rich-text';

	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import RichTextEditor from '$lib/components/waivers/RichTextEditor.svelte';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';

	const convex = useConvexClient();
	const appContext = useAppContext();
	const MIN_SEND_AFTER_HOURS = 1;
	const MAX_SEND_AFTER_HOURS = 168;

	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	// ─── Queries ───────────────────────────────────────────────────────────────

	const templateQuery = useProtectedQuery(api.emails.getEmailTemplate, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);

	const statsQuery = useProtectedQuery(api.emails.getFollowUpStats, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);

	const PAGE_SIZE = 25;
	const STATUS_OPTIONS = [
		{ value: 'queued', label: 'Queued' },
		{ value: 'paused', label: 'Paused' },
		{ value: 'sent', label: 'Sent' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'failed', label: 'Failed' }
	] as const;

	let statusFilters = $state(new SvelteSet<string>());
	let searchQuery = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let currentPage = $state(0);
	let pageCursors = $state<(string | null)[]>([null]);

	const currentCursor = $derived(pageCursors[currentPage] ?? null);
	const dateFromMillis = $derived(dateFrom ? parseLocalDateStart(dateFrom) : null);
	const dateToMillis = $derived(dateTo ? parseLocalDateEnd(dateTo) : null);

	function parseLocalDateStart(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day).getTime();
	}

	function parseLocalDateEnd(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day + 1).getTime();
	}

	const followUpsQuery = useProtectedQuery(api.emails.listFollowUps, () => {
		if (!currentWorkspace) return 'skip';
		return {
			workspaceId: currentWorkspace.workspaceId,
			paginationOpts: {
				numItems: PAGE_SIZE,
				cursor: currentCursor
			},
			...(statusFilters.size > 0
				? {
						statuses: [...statusFilters] as (
							| 'queued'
							| 'sent'
							| 'cancelled'
							| 'paused'
							| 'failed'
						)[]
					}
				: {}),
			...(searchQuery.trim() ? { searchQuery: searchQuery.trim() } : {}),
			...(dateFromMillis !== null ? { dateFrom: dateFromMillis } : {}),
			...(dateToMillis !== null ? { dateTo: dateToMillis } : {})
		};
	});

	const presetsQuery = useProtectedQuery(api.emails.listTemplatePresets, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);

	type FollowUp = FunctionReturnType<typeof api.emails.listFollowUps>['page'][number];
	type TemplatePreset = FunctionReturnType<typeof api.emails.listTemplatePresets>[number];

	const stats = $derived(statsQuery.data);
	const followUpsPage = $derived(followUpsQuery.data);
	const followUps = $derived((followUpsPage?.page ?? []) as FollowUp[]);
	const presets = $derived((presetsQuery.data ?? []) as TemplatePreset[]);
	const isLoading = $derived(appContext.isLoading || templateQuery.isLoading);
	const pageError = $derived(
		appContext.error ??
			templateQuery.error ??
			statsQuery.error ??
			followUpsQuery.error ??
			presetsQuery.error ??
			null
	);

	// ─── Template editor state ─────────────────────────────────────────────────

	let subject = $state('');
	let body = $state('<p></p>');
	let sendAfterHours = $state(2);
	let templateLoaded = $state(false);
	let savedSubject = $state('');
	let savedBody = $state('<p></p>');
	let savedSendAfterHours = $state(2);
	let isSavingTemplate = $state(false);
	let editorRef = $state<{ insertText: (text: string) => void } | null>(null);
	let loadedTemplateWorkspaceId = $state<Id<'workspaces'> | null>(null);

	const normalizedSendAfterHours = $derived(clampSendAfterHours(sendAfterHours));
	const isSendAfterHoursValid = $derived(
		Number.isInteger(sendAfterHours) &&
			sendAfterHours >= MIN_SEND_AFTER_HOURS &&
			sendAfterHours <= MAX_SEND_AFTER_HOURS
	);

	$effect(() => {
		const workspaceId = currentWorkspace?.workspaceId ?? null;

		if (!workspaceId) {
			subject = '';
			body = '<p></p>';
			sendAfterHours = 2;
			savedSubject = '';
			savedBody = '<p></p>';
			savedSendAfterHours = 2;
			templateLoaded = false;
			loadedTemplateWorkspaceId = null;
			return;
		}

		if (loadedTemplateWorkspaceId !== workspaceId) {
			subject = '';
			body = '<p></p>';
			sendAfterHours = 2;
			savedSubject = '';
			savedBody = '<p></p>';
			savedSendAfterHours = 2;
			templateLoaded = false;
		}

		if (
			templateQuery.data?.workspaceId === workspaceId &&
			loadedTemplateWorkspaceId !== workspaceId
		) {
			const template = templateQuery.data;
			subject = template.subject;
			body = template.body;
			sendAfterHours = template.sendAfterHours;
			savedSubject = template.subject;
			savedBody = template.body;
			savedSendAfterHours = template.sendAfterHours;
			templateLoaded = true;
			loadedTemplateWorkspaceId = workspaceId;
		}
	});

	const isDirty = $derived(
		templateLoaded &&
			(subject !== savedSubject || body !== savedBody || sendAfterHours !== savedSendAfterHours)
	);

	function clampSendAfterHours(value: unknown) {
		return Math.trunc(
			Math.max(MIN_SEND_AFTER_HOURS, Math.min(MAX_SEND_AFTER_HOURS, Number(value) || 1))
		);
	}

	function sanitizeSendAfterHours(e: Event) {
		const input = e.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const nextValue = clampSendAfterHours(input.value);
		sendAfterHours = nextValue;
		input.value = String(nextValue);
	}

	function insertVariable(variable: string) {
		editorRef?.insertText(variable);
	}

	async function persistTemplate(nextTemplate?: {
		subject: string;
		body: string;
		sendAfterHours: number;
		successMessage?: string;
	}) {
		if (!currentWorkspace) return;
		const templateToSave = {
			subject: nextTemplate?.subject ?? subject,
			body: nextTemplate?.body ?? body,
			sendAfterHours: clampSendAfterHours(nextTemplate?.sendAfterHours ?? sendAfterHours)
		};
		isSavingTemplate = true;
		try {
			await convex.mutation(api.emails.upsertEmailTemplate, {
				workspaceId: currentWorkspace.workspaceId,
				subject: templateToSave.subject,
				body: templateToSave.body,
				sendAfterHours: templateToSave.sendAfterHours
			});
			subject = templateToSave.subject;
			body = templateToSave.body;
			sendAfterHours = templateToSave.sendAfterHours;
			savedSubject = templateToSave.subject;
			savedBody = templateToSave.body;
			savedSendAfterHours = templateToSave.sendAfterHours;
			toast.success(nextTemplate?.successMessage ?? 'Email template saved.');
		} catch (err) {
			toast.error(
				getConvexErrorMessage(
					err,
					nextTemplate ? 'Failed to update email template.' : 'Failed to save email template.'
				)
			);
		} finally {
			isSavingTemplate = false;
		}
	}

	async function saveTemplate() {
		if (!isSendAfterHoursValid) return;
		await persistTemplate();
	}

	// ─── Save template preset dialog ───────────────────────────────────────────

	let savePresetOpen = $state(false);
	let presetName = $state('');
	let isSavingPreset = $state(false);

	function openSavePreset() {
		presetName = '';
		savePresetOpen = true;
	}

	async function confirmSavePreset() {
		if (!currentWorkspace || !presetName.trim() || !isSendAfterHoursValid) return;
		isSavingPreset = true;
		try {
			await convex.mutation(api.emails.saveTemplatePreset, {
				workspaceId: currentWorkspace.workspaceId,
				name: presetName.trim(),
				subject,
				body,
				sendAfterHours: normalizedSendAfterHours
			});
			savePresetOpen = false;
			presetName = '';
			toast.success('Template saved as preset.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to save preset.'));
		} finally {
			isSavingPreset = false;
		}
	}

	// ─── Load template preset dialog ───────────────────────────────────────────

	let loadPresetOpen = $state(false);
	let deletingPresetId = $state<TemplatePreset['_id'] | null>(null);
	let selectedPreset = $state<TemplatePreset | null>(null);

	$effect(() => {
		if (loadPresetOpen && presets.length > 0 && !selectedPreset) {
			selectedPreset = presets[0];
		}
	});

	function loadPreset(preset: TemplatePreset) {
		if (
			isDirty &&
			!confirm('Loading this preset will replace your unsaved email template changes. Continue?')
		) {
			return;
		}

		subject = preset.subject;
		body = preset.body;
		sendAfterHours = preset.sendAfterHours;
		loadPresetOpen = false;
		selectedPreset = null;
		toast.success(`Loaded "${preset.name}". Save changes to apply it.`);
	}

	async function deletePreset(presetId: TemplatePreset['_id']) {
		deletingPresetId = presetId;
		try {
			await convex.mutation(api.emails.deleteTemplatePreset, { presetId });
			toast.success('Template deleted.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to delete preset.'));
		} finally {
			deletingPresetId = null;
		}
	}

	// ─── Follow-up preview modal ───────────────────────────────────────────────

	let previewOpen = $state(false);
	let previewFollowUpId = $state<FollowUp['_id'] | null>(null);

	function openPreview(followUp: FollowUp) {
		previewFollowUpId = followUp._id;
		previewOpen = true;
	}

	const lastPreviewFollowUp = $derived.by(
		() => followUps.find((followUp) => followUp._id === previewFollowUpId) ?? null
	);

	function isInteractiveEventTarget(event: Event) {
		const target = event.target;
		return target instanceof HTMLElement
			? Boolean(target.closest('a,button,input,select,textarea'))
			: false;
	}

	const previewVars = $derived.by(() => {
		const f = lastPreviewFollowUp;
		if (!f) return null;
		return {
			signerName: f.signerName,
			signerEmail: f.signerEmail,
			bookingId: `#BK-${f.submissionId.slice(-5).toUpperCase()}`,
			activityDate: new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
				new Date(f.submittedAt)
			),
			scheduledAt: f.scheduledAt,
			status: f.status,
			followUpId: f._id
		};
	});

	function resolveTemplate(template: string, vars: NonNullable<typeof previewVars>) {
		return template
			.replace(/\{customer_name\}/g, vars.signerName)
			.replace(/\{booking_id\}/g, vars.bookingId)
			.replace(/\{activity_date\}/g, vars.activityDate);
	}

	function resolveHtmlTemplate(template: string, vars: NonNullable<typeof previewVars>) {
		return resolveTemplate(template, {
			...vars,
			signerName: escapeHtml(vars.signerName),
			bookingId: escapeHtml(vars.bookingId),
			activityDate: escapeHtml(vars.activityDate)
		});
	}

	const previewSubjectTemplate = $derived(
		lastPreviewFollowUp?.subjectTemplate ?? savedSubject ?? subject
	);
	const previewBodyTemplate = $derived(lastPreviewFollowUp?.bodyTemplate ?? savedBody ?? body);
	const resolvedSubject = $derived.by(() => {
		if (!previewVars) return '';
		if (lastPreviewFollowUp?.sentSubject) return lastPreviewFollowUp.sentSubject;
		return resolveTemplate(previewSubjectTemplate, previewVars);
	});
	const resolvedBodyHtml = $derived.by(() => {
		if (!previewVars) return '';
		if (lastPreviewFollowUp?.sentBodyHtml) return lastPreviewFollowUp.sentBodyHtml;
		return resolveHtmlTemplate(previewBodyTemplate, previewVars);
	});

	// ─── Search/filter/pagination state ───────────────────────────────────────

	const hasNextPage = $derived(Boolean(followUpsPage && !followUpsPage.isDone));
	const pagedFollowUps = $derived(followUps);

	// ─── Selection state ──────────────────────────────────────────────────────

	let selectedIds = $state(new SvelteSet<string>());
	let headerCheckboxEl = $state<HTMLInputElement | null>(null);

	const allVisibleSelected = $derived(
		pagedFollowUps.length > 0 && pagedFollowUps.every((f) => selectedIds.has(f._id))
	);
	const someVisibleSelected = $derived(pagedFollowUps.some((f) => selectedIds.has(f._id)));

	const selectedFollowUps = $derived(followUps.filter((f) => selectedIds.has(f._id)));
	const canSendSelected = $derived(
		selectedFollowUps.some((f) => ['queued', 'paused', 'cancelled', 'failed'].includes(f.status))
	);
	const canCancelSelected = $derived(
		selectedFollowUps.some((f) => ['queued', 'paused'].includes(f.status))
	);

	$effect(() => {
		if (headerCheckboxEl) {
			headerCheckboxEl.indeterminate = someVisibleSelected && !allVisibleSelected;
		}
	});

	$effect(() => {
		// clear selection and reset page when filters change
		void searchQuery;
		void dateFrom;
		void dateTo;
		void statusFilters.size;
		selectedIds = new SvelteSet();
		currentPage = 0;
		pageCursors = [null];
	});

	function toggleRowSelection(id: string) {
		const next = new SvelteSet(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleRow(id: string, e: Event) {
		e.stopPropagation();
		toggleRowSelection(id);
	}

	function handleRowCheckboxKeydown(id: string, e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') {
			e.preventDefault();
			toggleRowSelection(id);
		}
	}

	function toggleAll() {
		if (allVisibleSelected) {
			selectedIds = new SvelteSet();
		} else {
			selectedIds = new SvelteSet(pagedFollowUps.map((f) => f._id));
		}
	}

	function handleHeaderCheckboxKeydown(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') {
			e.preventDefault();
			toggleAll();
		}
	}

	function goToNextPage() {
		if (!followUpsPage || followUpsPage.isDone) return;
		const nextCursors = [...pageCursors];
		nextCursors[currentPage + 1] = followUpsPage.continueCursor;
		pageCursors = nextCursors;
		selectedIds = new SvelteSet();
		currentPage += 1;
	}

	function goToPreviousPage() {
		if (currentPage === 0) return;
		selectedIds = new SvelteSet();
		currentPage -= 1;
	}

	// ─── Bulk / selection actions ──────────────────────────────────────────────

	let selectionLoading = $state<'send' | 'pause' | 'cancel' | null>(null);

	async function handleSendSelected() {
		if (!currentWorkspace || selectedIds.size === 0) return;
		selectionLoading = 'send';
		try {
			await convex.mutation(api.emails.sendSelected, {
				workspaceId: currentWorkspace.workspaceId,
				followUpIds: [...selectedIds] as Id<'email_follow_ups'>[]
			});
			selectedIds = new SvelteSet();
			toast.success('Sending selected follow-ups.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to send selected.'));
		} finally {
			selectionLoading = null;
		}
	}

	async function handleCancelSelected() {
		if (!currentWorkspace || selectedIds.size === 0) return;
		selectionLoading = 'cancel';
		try {
			await convex.mutation(api.emails.cancelSelected, {
				workspaceId: currentWorkspace.workspaceId,
				followUpIds: [...selectedIds] as Id<'email_follow_ups'>[]
			});
			selectedIds = new SvelteSet();
			toast.success('Selected follow-ups cancelled.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to cancel selected.'));
		} finally {
			selectionLoading = null;
		}
	}

	let rowLoading = $state<Id<'email_follow_ups'> | null>(null);

	async function handleRowAction(
		action: 'send' | 'pause' | 'resume' | 'cancel',
		followUpId: Id<'email_follow_ups'>
	) {
		rowLoading = followUpId;
		try {
			if (action === 'send') {
				await convex.mutation(api.emails.sendFollowUpNow, { followUpId });
				toast.success('Sending now.');
			} else if (action === 'pause') {
				await convex.mutation(api.emails.pauseFollowUp, { followUpId });
				toast.success('Follow-up paused.');
			} else if (action === 'resume') {
				await convex.mutation(api.emails.resumeFollowUp, { followUpId });
				toast.success('Follow-up resumed.');
			} else if (action === 'cancel') {
				await convex.mutation(api.emails.cancelFollowUp, { followUpId });
				toast.success('Follow-up cancelled.');
				previewOpen = false;
			}
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Action failed.'));
		} finally {
			rowLoading = null;
		}
	}

	// ─── Formatting helpers ────────────────────────────────────────────────────

	function formatTimestamp(ts: number) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(ts)
		);
	}

	function formatScheduled(ts: number) {
		const now = Date.now();
		const diff = ts - now;
		if (diff <= 0) return 'Sending soon';
		const h = Math.floor(diff / 3600000);
		const m = Math.floor((diff % 3600000) / 60000);
		if (h > 48) return formatTimestamp(ts);
		if (h > 0) return `In ${h}h ${m}m`;
		return `In ${m}m`;
	}

	function displayBookingId(followUp: FollowUp) {
		return `#BK-${followUp.submissionId.slice(-5).toUpperCase()}`;
	}

	function formatFollowUpSchedule(followUp: FollowUp) {
		if (followUp.status === 'sent' && followUp.sentAt)
			return `Sent ${formatTimestamp(followUp.sentAt)}`;
		if (followUp.status === 'failed') {
			return followUp.failedAt ? `Failed ${formatTimestamp(followUp.failedAt)}` : 'Failed';
		}
		if (followUp.status === 'cancelled') return '—';
		return formatScheduled(followUp.scheduledAt);
	}

	const VARIABLES = [
		{ label: '{customer_name}', value: '{customer_name}' },
		{ label: '{booking_id}', value: '{booking_id}' },
		{ label: '{activity_date}', value: '{activity_date}' }
	];

	const STATUS_STYLES: Record<string, string> = {
		queued: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
		sent: 'bg-green-500/10 text-green-400 border-green-500/20',
		paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
		cancelled: 'bg-muted text-muted-foreground border-border',
		failed: 'bg-red-500/10 text-red-400 border-red-500/20'
	};
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Email Follow-ups | Waiver Director</title>
</svelte:head>

<!-- Follow-up preview modal -->
<Dialog bind:open={previewOpen}>
	<DialogContent class="gap-0 overflow-hidden p-0 sm:max-w-2xl">
		<DialogHeader class="border-b border-border px-6 py-4">
			<DialogTitle>Email preview</DialogTitle>
			<DialogDescription>
				{#if previewVars}
					Sending to <span class="font-medium text-foreground">{previewVars.signerName}</span>
					— {previewVars.signerEmail}
				{/if}
			</DialogDescription>
		</DialogHeader>

		{#if previewVars}
			<div class="max-h-[75vh] overflow-y-auto px-6 py-6">
				<!-- Meta -->
				<div class="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
					<span
						><span class="font-medium text-foreground">Booking</span> {previewVars.bookingId}</span
					>
					<span
						><span class="font-medium text-foreground">Signed</span>
						{previewVars.activityDate}</span
					>
					{#if previewVars.status === 'queued' || previewVars.status === 'paused'}
						<span
							><span class="font-medium text-foreground">Sends</span>
							{formatScheduled(previewVars.scheduledAt)}</span
						>
					{/if}
				</div>

				<!-- Subject -->
				<div class="mb-4 space-y-1">
					<p class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
						Subject
					</p>
					<p class="text-sm font-medium">{resolvedSubject}</p>
				</div>

				<!-- Body rendered as HTML -->
				<div class="space-y-1">
					<p class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
						Body
					</p>
					<WaiverRichText
						html={resolvedBodyHtml}
						class="overflow-hidden rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm leading-7 wrap-break-word text-foreground"
					/>
				</div>
			</div>

			<!-- Footer actions -->
			{#if previewVars.status === 'queued' || previewVars.status === 'paused'}
				<div class="flex items-center justify-between border-t border-border px-6 py-4">
					<Button
						variant="destructive"
						size="sm"
						onclick={() => handleRowAction('cancel', previewVars!.followUpId)}
						disabled={rowLoading === previewVars.followUpId}
					>
						Cancel follow-up
					</Button>
					<div class="flex gap-2">
						{#if previewVars.status === 'queued'}
							<Button
								variant="outline"
								size="sm"
								onclick={() => handleRowAction('pause', previewVars!.followUpId)}
								disabled={rowLoading === previewVars.followUpId}
							>
								Pause
							</Button>
						{:else}
							<Button
								variant="outline"
								size="sm"
								onclick={() => handleRowAction('resume', previewVars!.followUpId)}
								disabled={rowLoading === previewVars.followUpId}
							>
								Resume
							</Button>
						{/if}
						<Button
							size="sm"
							onclick={() => handleRowAction('send', previewVars!.followUpId)}
							disabled={rowLoading === previewVars.followUpId}
						>
							{rowLoading === previewVars.followUpId ? 'Sending…' : 'Send now'}
						</Button>
					</div>
				</div>
			{/if}
		{/if}
	</DialogContent>
</Dialog>

<!-- Save template preset dialog -->
<Dialog bind:open={savePresetOpen}>
	<DialogContent class="max-w-sm gap-0 overflow-hidden p-0">
		<DialogHeader class="border-b border-border px-6 py-4">
			<DialogTitle>Save as template</DialogTitle>
			<DialogDescription>Give this template a name so you can load it later.</DialogDescription>
		</DialogHeader>
		<div class="px-6 py-5">
			<label
				for="preset-name"
				class="block pb-1 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
			>
				Template name
			</label>
			<Input
				id="preset-name"
				bind:value={presetName}
				placeholder="e.g. Summer promotion, Default thank-you…"
				onkeydown={(e) => {
					if (e.key === 'Enter' && presetName.trim() && isSendAfterHoursValid) {
						confirmSavePreset();
					}
				}}
			/>
		</div>
		<div class="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
			<Button variant="outline" onclick={() => (savePresetOpen = false)} disabled={isSavingPreset}>
				Cancel
			</Button>
			<Button
				onclick={confirmSavePreset}
				disabled={isSavingPreset || !presetName.trim() || !isSendAfterHoursValid}
			>
				{isSavingPreset ? 'Saving…' : 'Save template'}
			</Button>
		</div>
	</DialogContent>
</Dialog>

<!-- Load template preset dialog -->
<Dialog
	bind:open={loadPresetOpen}
	onOpenChange={(open) => {
		if (!open) selectedPreset = null;
	}}
>
	<DialogContent class="gap-0 overflow-hidden p-0 sm:max-w-4xl">
		<DialogHeader class="border-b border-border px-6 py-4">
			<DialogTitle>Load template</DialogTitle>
			<DialogDescription>Select a saved template to preview it, then click Load.</DialogDescription>
		</DialogHeader>
		<div class="flex min-h-0" style="height: 60vh">
			<!-- Template list -->
			<div class="w-72 shrink-0 overflow-y-auto border-r border-border">
				{#if presetsQuery.isLoading}
					<div class="space-y-2 px-4 py-4">
						{#each [0, 1, 2] as i (i)}
							<Skeleton class="h-16 w-full rounded-lg" />
						{/each}
					</div>
				{:else if presets.length === 0}
					<div class="px-4 py-10 text-center text-sm text-muted-foreground">
						No saved templates yet. Use "Save template" to create one.
					</div>
				{:else}
					<div class="divide-y divide-border">
						{#each presets as preset (preset._id)}
							{@const isSelected = selectedPreset?._id === preset._id}
							<div
								class="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/30 {isSelected
									? 'bg-muted/40'
									: ''}"
							>
								<button class="min-w-0 flex-1 text-left" onclick={() => (selectedPreset = preset)}>
									<p class="truncate text-sm font-medium">{preset.name}</p>
									<p class="mt-0.5 truncate text-xs text-muted-foreground">
										{preset.sendAfterHours}h delay
									</p>
								</button>
								<div class="flex shrink-0 items-center gap-1">
									<Button size="sm" class="h-6 px-2 text-xs" onclick={() => loadPreset(preset)}>
										Load
									</Button>
									<button
										class="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
										onclick={() => deletePreset(preset._id)}
										disabled={deletingPresetId === preset._id}
										title="Delete preset"
									>
										<TrashIcon class="size-3.5" />
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Preview panel -->
			<div class="min-w-0 flex-1 overflow-y-auto px-6 py-5">
				{#if selectedPreset}
					<div class="space-y-4">
						<div class="space-y-1">
							<p
								class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
							>
								Subject
							</p>
							<p class="text-sm font-medium wrap-break-word">{selectedPreset.subject}</p>
						</div>
						<div class="space-y-1">
							<p
								class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
							>
								Body
							</p>
							<WaiverRichText
								html={selectedPreset.body}
								class="overflow-hidden rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm leading-7 wrap-break-word text-foreground"
							/>
						</div>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
						Select a template to preview it.
					</div>
				{/if}
			</div>
		</div>
		<div class="flex justify-end border-t border-border px-6 py-4">
			<Button variant="outline" onclick={() => (loadPresetOpen = false)}>Close</Button>
		</div>
	</DialogContent>
</Dialog>

<div class="w-full min-w-0 p-6">
	<div class="mx-auto w-full max-w-5xl min-w-0 space-y-8">
		<!-- Page header -->
		<div class="space-y-1">
			<p class="text-xs font-bold tracking-[0.16em] text-primary uppercase">Automation</p>
			<h1 class="text-2xl font-semibold tracking-tight">Email Follow-ups</h1>
			<p class="text-sm text-muted-foreground">
				Automatically send thank-you emails after guests sign a waiver.
			</p>
		</div>

		{#if pageError}
			<div
				class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
			>
				{getConvexErrorMessage(pageError, 'Unable to load email follow-ups.')}
			</div>
		{:else if !appContext.isLoading && !currentWorkspace}
			<div
				class="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
			>
				No workspace was found for <span class="font-medium text-foreground"
					>{page.params.workspaceSlug}</span
				>.
			</div>
		{/if}

		<!-- Stats cards -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-xl border border-border bg-card p-5">
				<p class="text-[10px] font-bold tracking-[0.18em] text-muted-foreground/50 uppercase">
					Emails sent today
				</p>
				{#if statsQuery.isLoading}
					<Skeleton class="mt-2 h-8 w-16" />
				{:else}
					<p class="mt-1 text-3xl font-bold tabular-nums">{stats?.sentToday ?? 0}</p>
				{/if}
			</div>
			<div class="rounded-xl border border-border bg-card p-5">
				<p class="text-[10px] font-bold tracking-[0.18em] text-muted-foreground/50 uppercase">
					Pending queue
				</p>
				{#if statsQuery.isLoading}
					<Skeleton class="mt-2 h-8 w-10" />
				{:else}
					<p class="mt-1 text-3xl font-bold tabular-nums">{stats?.pendingCount ?? 0}</p>
				{/if}
			</div>
			<div class="rounded-xl border border-border bg-card p-5">
				<p class="text-[10px] font-bold tracking-[0.18em] text-muted-foreground/50 uppercase">
					Total sent
				</p>
				{#if statsQuery.isLoading}
					<Skeleton class="mt-2 h-8 w-14" />
				{:else}
					<p class="mt-1 text-3xl font-bold tabular-nums">{stats?.totalSent ?? 0}</p>
				{/if}
			</div>
		</div>

		<!-- Template editor -->
		{#if isLoading}
			<div class="space-y-4">
				<div class="space-y-2">
					<Skeleton class="h-7 w-44" />
					<div class="flex items-center gap-2">
						<Skeleton class="h-5 w-52" />
						<Skeleton class="h-8 w-28" />
						<Skeleton class="h-8 w-8" />
					</div>
				</div>
				<div class="space-y-4">
					<div class="space-y-2">
						<Skeleton class="h-3 w-24" />
						<Skeleton class="h-9 w-full" />
					</div>
					<div class="space-y-2">
						<Skeleton class="h-3 w-20" />
						<div class="overflow-hidden rounded-xl border border-border bg-background">
							<div class="flex h-10 items-center gap-1 border-b border-border px-3">
								<Skeleton class="h-7 w-7" />
								<Skeleton class="h-7 w-7" />
								<Skeleton class="h-7 w-7" />
							</div>
							<div class="min-h-56 space-y-3 p-4">
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-10/12" />
								<Skeleton class="h-4 w-3/4" />
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				<!-- Editor section header -->
				<div class="space-y-1.5">
					<h2 class="text-xl font-semibold tracking-tight">Follow-up email</h2>
					<div class="flex items-center justify-between gap-4">
						<div class="space-y-1">
							<div class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
								<span>Sent to every signer</span>
								<Input
									type="number"
									min="1"
									max="168"
									value={sendAfterHours}
									oninput={sanitizeSendAfterHours}
									onblur={sanitizeSendAfterHours}
									class="h-6 w-12 px-1 text-center text-sm"
									aria-invalid={!isSendAfterHoursValid}
									aria-describedby="send-after-hours-error"
								/>
								<span>hours after they sign.</span>
							</div>
							{#if !isSendAfterHoursValid}
								<p id="send-after-hours-error" class="text-xs text-destructive">
									Enter a whole number from {MIN_SEND_AFTER_HOURS} to {MAX_SEND_AFTER_HOURS}.
								</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-1.5">
							<Button
								size="sm"
								onclick={saveTemplate}
								disabled={!isDirty || isSavingTemplate || !isSendAfterHoursValid}
							>
								{isSavingTemplate ? 'Saving…' : 'Save changes'}
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger>
									{#snippet child({ props })}
										<Button variant="outline" size="sm" {...props}>
											<EllipsisVerticalIcon class="size-4" />
										</Button>
									{/snippet}
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onclick={openSavePreset}>Save as template</DropdownMenuItem>
									<DropdownMenuItem onclick={() => (loadPresetOpen = true)}
										>Load template</DropdownMenuItem
									>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</div>

				<!-- Fields -->
				<div class="space-y-5">
					<!-- Subject -->
					<div class="space-y-3">
						<label
							for="email-subject"
							class="block pb-1 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
						>
							Email subject
						</label>
						<Input
							id="email-subject"
							bind:value={subject}
							placeholder="Thank you for visiting, {'{customer_name}'}!"
						/>
					</div>

					<!-- Body -->
					<div class="space-y-2">
						<div class="flex items-center justify-between gap-3">
							<label
								for="email-body"
								class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
							>
								Email body
							</label>
							<!-- Variable chips -->
							<div class="flex flex-wrap gap-1.5">
								{#each VARIABLES as variable (variable.value)}
									<button
										onclick={() => insertVariable(variable.value)}
										class="flex h-9 items-center rounded-md border border-border bg-muted/30 px-2.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/60 hover:text-foreground"
									>
										{variable.label}
									</button>
								{/each}
							</div>
						</div>
						<RichTextEditor id="email-body" bind:value={body} bind:this={editorRef} />
					</div>
				</div>
			</div>
		{/if}

		<!-- Follow-ups table -->
		<div class="space-y-4">
			<div class="space-y-1.5">
				<h2 class="text-xl font-semibold tracking-tight">Follow-ups</h2>
				<p class="text-sm text-muted-foreground">
					Select rows to act on them, or click a row to preview the email.
				</p>
			</div>

			<!-- Status filter pills (multi-select) -->
			<div class="flex flex-wrap gap-1.5">
				{#each STATUS_OPTIONS as opt (opt.value)}
					{@const active = statusFilters.has(opt.value)}
					<button
						onclick={() => {
							if (active) statusFilters.delete(opt.value);
							else statusFilters.add(opt.value);
						}}
						class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors {active
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground'}"
					>
						{opt.label}
						{#if active}<span class="pl-1 opacity-70">×</span>{/if}
					</button>
				{/each}
			</div>

			<!-- Filters + actions -->
			<div class="flex flex-wrap items-center gap-3">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<label for="date-from" class="shrink-0">From</label>
					<Input id="date-from" type="date" bind:value={dateFrom} class="h-8 w-36 text-sm" />
				</div>
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<label for="date-to" class="shrink-0">To</label>
					<Input id="date-to" type="date" bind:value={dateTo} class="h-8 w-36 text-sm" />
				</div>
				<Input
					type="search"
					placeholder="Search by name, email or booking…"
					bind:value={searchQuery}
					class="h-8 min-w-48 flex-1 text-sm"
				/>
				<div class="flex gap-1.5">
					<span
						class="inline-block"
						title={!canSendSelected
							? 'Select queued, paused, cancelled, or failed rows to send'
							: undefined}
					>
						<Button
							size="sm"
							onclick={handleSendSelected}
							disabled={selectionLoading !== null || !canSendSelected}
						>
							{selectionLoading === 'send' ? 'Sending…' : 'Send'}
						</Button>
					</span>
					<span
						class="inline-block"
						title={!canCancelSelected ? 'Select queued or paused rows to cancel' : undefined}
					>
						<Button
							size="sm"
							variant="outline"
							onclick={handleCancelSelected}
							disabled={selectionLoading !== null || !canCancelSelected}
						>
							{selectionLoading === 'cancel' ? 'Cancelling…' : 'Cancel'}
						</Button>
					</span>
				</div>
			</div>

			<!-- Table -->
			<div class="flex min-h-[520px] flex-col">
				{#if followUpsQuery.isLoading || appContext.isLoading}
					<div class="flex-1 rounded-xl border border-border">
						<Table class="table-fixed">
							<colgroup>
								<col class="w-[4%]" /><col class="w-[28%]" /><col class="w-[13%]" />
								<col class="w-[18%]" /><col class="w-[22%]" /><col class="w-[15%]" />
							</colgroup>
							<TableHeader>
								<TableRow class="border-border hover:bg-transparent">
									{#each ['', 'Customer', 'Booking', 'Waiver signed', 'Scheduled for', 'Status'] as col (col)}
										<TableHead
											class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
											>{col}</TableHead
										>
									{/each}
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each [0, 1, 2, 3] as i (i)}
									<TableRow class="border-border hover:bg-transparent">
										{#each [0, 1, 2, 3, 4, 5] as j (j)}
											<TableCell><Skeleton class="h-4 w-full max-w-28" /></TableCell>
										{/each}
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>
				{:else if followUps.length === 0}
					<div
						class="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground"
					>
						{searchQuery || dateFrom || dateTo || statusFilters.size > 0
							? 'No follow-ups match your filters.'
							: `No follow-ups yet for ${currentWorkspace?.name ?? 'this workspace'}. They appear here after guests sign a waiver.`}
					</div>
				{:else}
					<div class="rounded-xl border border-border">
						<Table class="table-fixed">
							<colgroup>
								<col class="w-[4%]" /><col class="w-[28%]" /><col class="w-[13%]" />
								<col class="w-[18%]" /><col class="w-[22%]" /><col class="w-[15%]" />
							</colgroup>
							<TableHeader>
								<TableRow class="border-border hover:bg-transparent">
									<TableHead class="pl-4">
										<input
											bind:this={headerCheckboxEl}
											type="checkbox"
											class="size-4 cursor-pointer rounded accent-primary"
											checked={allVisibleSelected}
											onchange={toggleAll}
											onkeydown={handleHeaderCheckboxKeydown}
										/>
									</TableHead>
									<TableHead
										class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
										>Customer</TableHead
									>
									<TableHead
										class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
										>Booking</TableHead
									>
									<TableHead
										class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
										>Waiver signed</TableHead
									>
									<TableHead
										class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
										>Scheduled for</TableHead
									>
									<TableHead
										class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
										>Status</TableHead
									>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each pagedFollowUps as followUp (followUp._id)}
									<TableRow
										class="cursor-pointer border-border transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none {selectedIds.has(
											followUp._id
										)
											? 'bg-muted/20'
											: ''}"
										role="button"
										tabindex={0}
										onclick={(e) => {
											if (isInteractiveEventTarget(e)) return;
											openPreview(followUp);
										}}
										onkeydown={(e) => {
											if (isInteractiveEventTarget(e)) return;
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												openPreview(followUp);
											}
										}}
									>
										<TableCell
											class="pl-4"
											onclick={(e) => e.stopPropagation()}
											onkeydown={(e) => e.stopPropagation()}
										>
											<input
												type="checkbox"
												class="size-4 cursor-pointer rounded accent-primary"
												checked={selectedIds.has(followUp._id)}
												onchange={(e) => toggleRow(followUp._id, e)}
												onkeydown={(e) => handleRowCheckboxKeydown(followUp._id, e)}
											/>
										</TableCell>
										<TableCell>
											<p class="truncate text-sm font-medium">{followUp.signerName}</p>
											<p class="truncate text-xs text-muted-foreground">{followUp.signerEmail}</p>
										</TableCell>
										<TableCell class="font-mono text-sm text-muted-foreground">
											{displayBookingId(followUp)}
										</TableCell>
										<TableCell class="text-xs text-muted-foreground">
											{formatTimestamp(followUp.submittedAt)}
										</TableCell>
										<TableCell class="text-xs text-muted-foreground">
											{formatFollowUpSchedule(followUp)}
										</TableCell>
										<TableCell>
											<span
												class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize {STATUS_STYLES[
													followUp.status
												] ?? ''}"
											>
												<span
													class="size-1.5 rounded-full {followUp.status === 'queued'
														? 'bg-blue-400'
														: followUp.status === 'sent'
															? 'bg-green-400'
															: followUp.status === 'paused'
																? 'bg-yellow-400'
																: followUp.status === 'failed'
																	? 'bg-red-400'
																	: 'bg-muted-foreground'}"
												></span>
												{followUp.status}
											</span>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>

						<div class="flex items-center justify-between border-t border-border px-5 py-3">
							<p class="text-xs text-muted-foreground">
								{#if followUps.length === 0}
									No entries
								{:else}
									Page {currentPage + 1} · Showing {followUps.length}
									{followUps.length === 1 ? 'entry' : 'entries'}
								{/if}
							</p>
							<div class="flex items-center gap-1">
								<button
									class="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
									disabled={currentPage === 0}
									onclick={goToPreviousPage}
								>
									← Prev
								</button>
								<span class="min-w-[64px] px-2 py-1 text-center text-xs text-muted-foreground">
									Page {currentPage + 1}
								</span>
								<button
									class="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
									disabled={!hasNextPage}
									onclick={goToNextPage}
								>
									Next →
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
