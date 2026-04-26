<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
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
	import EmailLoadTemplateDialog from '$lib/components/emails/EmailLoadTemplateDialog.svelte';
	import EmailSaveTemplateDialog from '$lib/components/emails/EmailSaveTemplateDialog.svelte';
	import RichTextEditor from '$lib/components/emails/RichTextEditor.svelte';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import CloudCheckIcon from '@lucide/svelte/icons/cloud-check';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import LoaderIcon from '@lucide/svelte/icons/loader';

	const convex = useConvexClient();
	const appContext = useAppContext();
	const SEND_AFTER_UNITS = ['minutes', 'hours', 'days'] as const;
	type SendAfterUnit = (typeof SEND_AFTER_UNITS)[number];
	const DEFAULT_SEND_AFTER_AMOUNT = 2;
	const DEFAULT_SEND_AFTER_UNIT: SendAfterUnit = 'hours';
	const AUTOSAVE_DELAY_MS = 1800;

	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	// ─── Queries ───────────────────────────────────────────────────────────────

	const editorContentQuery = useProtectedQuery(api.emails.getEmailEditorContent, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);

	const statsQuery = useProtectedQuery(api.emails.getFollowUpStats, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);

	const PAGE_SIZE = 25;
	const STATUS_OPTIONS = [
		{ value: 'queued', label: 'Queued' },
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
						statuses: [...statusFilters] as ('queued' | 'sent' | 'cancelled' | 'failed')[]
					}
				: {}),
			...(searchQuery.trim() ? { searchQuery: searchQuery.trim() } : {}),
			...(dateFromMillis !== null ? { dateFrom: dateFromMillis } : {}),
			...(dateToMillis !== null ? { dateTo: dateToMillis } : {})
		};
	});

	const templatesQuery = useProtectedQuery(api.emails.listEmailTemplates, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);

	type FollowUp = FunctionReturnType<typeof api.emails.listFollowUps>['page'][number] & {
		bookingNumber?: string;
	};
	type EmailTemplate = FunctionReturnType<typeof api.emails.listEmailTemplates>[number];

	const stats = $derived(statsQuery.data);
	const followUpsPage = $derived(followUpsQuery.data);
	const followUps = $derived((followUpsPage?.page ?? []) as FollowUp[]);
	const templates = $derived((templatesQuery.data ?? []) as EmailTemplate[]);
	const isLoading = $derived(appContext.isLoading || editorContentQuery.isLoading);
	const pageError = $derived(
		appContext.error ??
			editorContentQuery.error ??
			statsQuery.error ??
			followUpsQuery.error ??
			templatesQuery.error ??
			null
	);

	// ─── Editor content state ──────────────────────────────────────────────────

	let subject = $state('');
	let body = $state('<p></p>');
	let sendAfterAmount = $state(DEFAULT_SEND_AFTER_AMOUNT);
	let sendAfterUnit = $state<SendAfterUnit>(DEFAULT_SEND_AFTER_UNIT);
	let editorContentLoaded = $state(false);
	let savedSubject = $state('');
	let savedBody = $state('<p></p>');
	let savedSendAfterAmount = $state(DEFAULT_SEND_AFTER_AMOUNT);
	let savedSendAfterUnit = $state<SendAfterUnit>(DEFAULT_SEND_AFTER_UNIT);
	let isSavingEditorContent = $state(false);
	let lastSavedAt = $state<number | null>(null);
	let lastSaveError = $state<string | null>(null);
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	let editorRef = $state<{ insertText: (text: string) => void } | null>(null);
	let loadedEditorContentWorkspaceId = $state<Id<'workspaces'> | null>(null);

	const normalizedSendAfterAmount = $derived(clampSendAfterAmount(sendAfterAmount));
	const isSendAfterValid = $derived(Number.isInteger(sendAfterAmount) && sendAfterAmount >= 1);

	function resetEditorContentState() {
		subject = '';
		body = '<p></p>';
		sendAfterAmount = DEFAULT_SEND_AFTER_AMOUNT;
		sendAfterUnit = DEFAULT_SEND_AFTER_UNIT;
		savedSubject = '';
		savedBody = '<p></p>';
		savedSendAfterAmount = DEFAULT_SEND_AFTER_AMOUNT;
		savedSendAfterUnit = DEFAULT_SEND_AFTER_UNIT;
		lastSavedAt = null;
		lastSaveError = null;
		editorContentLoaded = false;
		loadedEditorContentWorkspaceId = null;
	}

	$effect(() => {
		const workspaceId = currentWorkspace?.workspaceId ?? null;

		if (!workspaceId) {
			resetEditorContentState();
			return;
		}

		if (loadedEditorContentWorkspaceId !== workspaceId) {
			resetEditorContentState();
		}

		if (
			editorContentQuery.data?.workspaceId === workspaceId &&
			loadedEditorContentWorkspaceId !== workspaceId
		) {
			const editorContent = editorContentQuery.data;
			subject = editorContent.subject;
			body = editorContent.body;
			sendAfterAmount = editorContent.sendAfterAmount;
			sendAfterUnit = editorContent.sendAfterUnit;
			savedSubject = editorContent.subject;
			savedBody = editorContent.body;
			savedSendAfterAmount = editorContent.sendAfterAmount;
			savedSendAfterUnit = editorContent.sendAfterUnit;
			lastSavedAt = null;
			lastSaveError = null;
			editorContentLoaded = true;
			loadedEditorContentWorkspaceId = workspaceId;
		}
	});

	const isDirty = $derived(
		editorContentLoaded &&
			(subject !== savedSubject ||
				body !== savedBody ||
				sendAfterAmount !== savedSendAfterAmount ||
				sendAfterUnit !== savedSendAfterUnit)
	);
	const editorContentFingerprint = $derived(
		`${subject}\u0000${body}\u0000${sendAfterAmount}\u0000${sendAfterUnit}`
	);
	let lastObservedEditorContentFingerprint = $state('');
	const saveState = $derived<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>(
		(() => {
			if (lastSaveError) return 'error';
			if (isSavingEditorContent) return 'saving';
			if (isDirty) return 'dirty';
			if (lastSavedAt) return 'saved';
			return 'idle';
		})()
	);
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

	$effect(() => {
		const currentFingerprint = editorContentFingerprint;

		untrack(() => {
			if (lastSaveError && currentFingerprint !== lastObservedEditorContentFingerprint) {
				lastSaveError = null;
			}
			lastObservedEditorContentFingerprint = currentFingerprint;
		});
	});

	$effect(() => {
		void editorContentFingerprint;
		void isSavingEditorContent;
		void isSendAfterValid;
		void lastSaveError;

		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
			autosaveTimer = null;
		}

		untrack(() => {
			if (!currentWorkspace) return;
			if (!isDirty) return;
			if (!isSendAfterValid) return;
			if (isSavingEditorContent) return;
			if (lastSaveError) return;

			autosaveTimer = setTimeout(() => {
				void persistEditorContent({ showToast: false });
			}, AUTOSAVE_DELAY_MS);
		});

		return () => {
			if (autosaveTimer) {
				clearTimeout(autosaveTimer);
				autosaveTimer = null;
			}
		};
	});

	function clampSendAfterAmount(value: unknown) {
		return Math.trunc(Math.max(1, Number(value) || 1));
	}

	function sanitizeSendAfterAmount(e: Event) {
		const input = e.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const nextValue = clampSendAfterAmount(input.value);
		sendAfterAmount = nextValue;
		input.value = String(nextValue);
	}

	function updateSendAfterUnit(e: Event) {
		const select = e.currentTarget;
		if (!(select instanceof HTMLSelectElement)) return;
		if (!SEND_AFTER_UNITS.includes(select.value as SendAfterUnit)) return;
		const nextUnit = select.value as SendAfterUnit;
		sendAfterUnit = nextUnit;
		sendAfterAmount = clampSendAfterAmount(sendAfterAmount);
	}

	function insertVariable(variable: string) {
		editorRef?.insertText(variable);
	}

	async function persistEditorContent(options: { showToast?: boolean } = {}) {
		if (!currentWorkspace) return;
		const showToast = options.showToast ?? true;
		const workspaceId = currentWorkspace.workspaceId;
		const editorContentToSave = {
			subject,
			body,
			sendAfterAmount: clampSendAfterAmount(sendAfterAmount),
			sendAfterUnit
		};
		isSavingEditorContent = true;
		lastSaveError = null;
		try {
			await convex.mutation(api.emails.upsertEmailEditorContent, {
				workspaceId,
				subject: editorContentToSave.subject,
				body: editorContentToSave.body,
				sendAfterAmount: editorContentToSave.sendAfterAmount,
				sendAfterUnit: editorContentToSave.sendAfterUnit
			});

			if (currentWorkspace?.workspaceId === workspaceId) {
				savedSubject = editorContentToSave.subject;
				savedBody = editorContentToSave.body;
				savedSendAfterAmount = editorContentToSave.sendAfterAmount;
				savedSendAfterUnit = editorContentToSave.sendAfterUnit;
				lastSavedAt = Date.now();
			}
			if (showToast) toast.success('Email content saved.');
		} catch (err) {
			const message = getConvexErrorMessage(err, 'Failed to save email content.');
			lastSaveError = message;
			if (showToast) toast.error(message);
		} finally {
			isSavingEditorContent = false;
		}
	}

	// ─── Save template dialog ──────────────────────────────────────────────────

	let saveTemplateOpen = $state(false);
	let templateName = $state('');
	let isSavingReusableTemplate = $state(false);

	function openSaveTemplate() {
		templateName = '';
		saveTemplateOpen = true;
	}

	async function confirmSaveTemplate() {
		if (!currentWorkspace || !templateName.trim() || !isSendAfterValid) return;
		isSavingReusableTemplate = true;
		try {
			await convex.mutation(api.emails.saveEmailTemplate, {
				workspaceId: currentWorkspace.workspaceId,
				name: templateName.trim(),
				subject,
				body,
				sendAfterAmount: normalizedSendAfterAmount,
				sendAfterUnit
			});
			saveTemplateOpen = false;
			templateName = '';
			toast.success('Template saved.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to save template.'));
		} finally {
			isSavingReusableTemplate = false;
		}
	}

	// ─── Load template dialog ──────────────────────────────────────────────────

	let loadTemplateOpen = $state(false);
	let deletingTemplateId = $state<EmailTemplate['_id'] | null>(null);
	let selectedTemplate = $state<EmailTemplate | null>(null);

	$effect(() => {
		if (loadTemplateOpen && templates.length > 0 && !selectedTemplate) {
			selectedTemplate = templates[0];
		}
	});

	function loadTemplate(template: EmailTemplate) {
		if (
			isDirty &&
			!confirm('Loading this template will replace your unsaved email content changes. Continue?')
		) {
			return;
		}

		subject = template.subject;
		body = template.body;
		sendAfterAmount = template.sendAfterAmount;
		sendAfterUnit = template.sendAfterUnit;
		lastSavedAt = null;
		lastSaveError = null;
		loadTemplateOpen = false;
		selectedTemplate = null;
		toast.success(`Loaded "${template.name}". Autosave will update the editor content.`);
	}

	async function deleteTemplate(template: EmailTemplate) {
		deletingTemplateId = template._id;
		try {
			await convex.mutation(api.emails.deleteEmailTemplate, { templateId: template._id });
			if (selectedTemplate?._id === template._id) {
				selectedTemplate = null;
			}
			toast.success('Template deleted.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to delete template.'));
		} finally {
			deletingTemplateId = null;
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
			bookingId: f.bookingNumber ? `#${f.bookingNumber}` : null,
			businessName: currentWorkspace?.name ?? '',
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
			.replace(/\{\{customer_name\}\}|\{customer_name\}/g, vars.signerName)
			.replace(/\{\{booking_id\}\}|\{booking_id\}/g, vars.bookingId ?? '')
			.replace(/\{\{business_name\}\}|\{business_name\}/g, vars.businessName)
			.replace(/\{\{activity_date\}\}|\{activity_date\}/g, vars.activityDate);
	}

	function resolveHtmlTemplate(template: string, vars: NonNullable<typeof previewVars>) {
		return resolveTemplate(template, {
			...vars,
			signerName: escapeHtml(vars.signerName),
			bookingId: escapeHtml(vars.bookingId ?? ''),
			businessName: escapeHtml(vars.businessName),
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

	// ─── Selection state ──────────────────────────────────────────────────────

	let selectedIds = $state(new SvelteSet<string>());
	let headerCheckboxEl = $state<HTMLInputElement | null>(null);

	const allVisibleSelected = $derived(
		followUps.length > 0 && followUps.every((f) => selectedIds.has(f._id))
	);
	const someVisibleSelected = $derived(followUps.some((f) => selectedIds.has(f._id)));

	const selectedFollowUps = $derived(followUps.filter((f) => selectedIds.has(f._id)));
	const canSendSelected = $derived(
		selectedFollowUps.some((f) => ['queued', 'paused', 'cancelled', 'failed'].includes(f.status))
	);
	const canCancelSelected = $derived(selectedFollowUps.some((f) => f.status === 'queued'));

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
			selectedIds = new SvelteSet(followUps.map((f) => f._id));
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

	let selectionLoading = $state<'send' | 'cancel' | null>(null);

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

	async function handleRowAction(action: 'send' | 'cancel', followUpId: Id<'email_follow_ups'>) {
		rowLoading = followUpId;
		try {
			if (action === 'send') {
				await convex.mutation(api.emails.sendFollowUpNow, { followUpId });
				toast.success('Sending now.');
			} else if (action === 'cancel') {
				await convex.mutation(api.emails.cancelFollowUp, { followUpId });
				toast.success('Follow-up cancelled.');
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
		return followUp.bookingNumber ? `#${followUp.bookingNumber}` : '—';
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
		{ label: '{{customer_name}}', value: '{{customer_name}}' },
		{ label: '{{booking_id}}', value: '{{booking_id}}' },
		{ label: '{{business_name}}', value: '{{business_name}}' },
		{ label: '{{activity_date}}', value: '{{activity_date}}' }
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
					{#if previewVars.bookingId}
						<span
							><span class="font-medium text-foreground">Booking</span>
							{previewVars.bookingId}</span
						>
					{/if}
					<span
						><span class="font-medium text-foreground">Signed</span>
						{previewVars.activityDate}</span
					>
					{#if previewVars.status === 'queued'}
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
			{#if ['queued', 'cancelled', 'failed', 'paused'].includes(previewVars.status)}
				<div class="flex items-center justify-between border-t border-border px-6 py-4">
					{#if previewVars.status === 'queued'}
						<Button
							variant="destructive"
							size="sm"
							onclick={() => handleRowAction('cancel', previewVars!.followUpId)}
							disabled={rowLoading === previewVars.followUpId}
						>
							Cancel follow-up
						</Button>
					{:else}
						<span></span>
					{/if}
					<div class="flex gap-2">
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

<EmailSaveTemplateDialog
	bind:open={saveTemplateOpen}
	bind:templateName
	isSaving={isSavingReusableTemplate}
	canSave={isSendAfterValid}
	onConfirm={confirmSaveTemplate}
/>

<EmailLoadTemplateDialog
	bind:open={loadTemplateOpen}
	bind:selectedTemplate
	{templates}
	isLoading={templatesQuery.isLoading}
	{deletingTemplateId}
	onLoad={loadTemplate}
	onDelete={deleteTemplate}
/>

<div class="w-full min-w-0 p-4 sm:p-6">
	<div class="mx-auto w-full max-w-5xl min-w-0 space-y-6 sm:space-y-8">
		<!-- Page header -->
		<div class="space-y-1">
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
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<div class="rounded-xl border border-border bg-card/30 p-4">
				<p class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
					Emails sent today
				</p>
				{#if statsQuery.isLoading}
					<Skeleton class="mt-2 h-8 w-16" />
				{:else}
					<p class="mt-1 text-3xl font-semibold tabular-nums">{stats?.sentToday ?? 0}</p>
				{/if}
			</div>
			<div class="rounded-xl border border-border bg-card/30 p-4">
				<p class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
					Pending queue
				</p>
				{#if statsQuery.isLoading}
					<Skeleton class="mt-2 h-8 w-10" />
				{:else}
					<p class="mt-1 text-3xl font-semibold tabular-nums">{stats?.pendingCount ?? 0}</p>
				{/if}
			</div>
			<div class="rounded-xl border border-border bg-card/30 p-4">
				<p class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
					Total sent
				</p>
				{#if statsQuery.isLoading}
					<Skeleton class="mt-2 h-8 w-14" />
				{:else}
					<p class="mt-1 text-3xl font-semibold tabular-nums">{stats?.totalSent ?? 0}</p>
				{/if}
			</div>
		</div>

		<!-- Editor content -->
		{#if isLoading}
			<div class="space-y-4">
				<!-- Editor section header skeleton -->
				<div class="space-y-1.5">
					<div class="flex items-center justify-between gap-3">
						<Skeleton class="h-7 w-44" />
						<Skeleton class="h-5 w-36 rounded-full" />
					</div>
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<Skeleton class="h-5 w-64" />
						<div class="flex shrink-0 items-center gap-1.5">
							<Skeleton class="h-8 flex-1 sm:w-32 sm:flex-none" />
							<Skeleton class="h-8 flex-1 sm:w-28 sm:flex-none" />
						</div>
					</div>
				</div>

				<!-- Fields skeleton -->
				<div class="space-y-5">
					<!-- Subject -->
					<div class="space-y-3">
						<Skeleton class="h-3 w-24" />
						<Skeleton class="h-9 w-full" />
					</div>

					<!-- Body -->
					<div class="space-y-2">
						<div
							class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
						>
							<Skeleton class="h-3 w-20" />
							<div class="flex gap-1.5">
								<Skeleton class="h-9 w-32" />
								<Skeleton class="h-9 w-24" />
								<Skeleton class="h-9 w-32" />
							</div>
						</div>
						<div class="overflow-hidden rounded-xl border border-border bg-background">
							<div class="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
								<Skeleton class="h-7 w-20" />
								<Skeleton class="h-7 w-9" />
								<Skeleton class="h-7 w-24" />
								<Skeleton class="h-7 w-14" />
								<Skeleton class="h-7 w-32" />
								<Skeleton class="h-7 w-16" />
								<Skeleton class="h-7 w-7" />
								<Skeleton class="h-7 w-7" />
							</div>
							<div class="min-h-[260px] space-y-3 p-4">
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
					<div class="flex items-center justify-between gap-3">
						<div class="min-w-0">
							<h2 class="text-xl font-semibold tracking-tight">Follow-up email</h2>
						</div>
						<span class="save-indicator shrink-0" data-state={saveState}>
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
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="space-y-1">
							<div class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
								<span>Sent to every signer</span>
								<Input
									type="number"
									min="1"
									value={sendAfterAmount}
									oninput={sanitizeSendAfterAmount}
									onblur={sanitizeSendAfterAmount}
									class="h-7 w-16 px-2 text-center text-sm tabular-nums"
									aria-invalid={!isSendAfterValid}
									aria-describedby="send-after-error"
								/>
								<select
									value={sendAfterUnit}
									onchange={updateSendAfterUnit}
									class="h-7 rounded-md border border-input bg-input/20 px-2 py-0.5 text-sm text-muted-foreground shadow-xs transition-colors outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 md:text-xs/relaxed dark:bg-input/30"
									aria-label="Send after unit"
								>
									{#each SEND_AFTER_UNITS as unit (unit)}
										<option value={unit}>{unit}</option>
									{/each}
								</select>
								<span>after they sign.</span>
							</div>
							{#if !isSendAfterValid}
								<p id="send-after-error" class="text-xs text-destructive">
									Enter a positive whole number.
								</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onclick={openSaveTemplate}
								disabled={isSavingEditorContent || !isSendAfterValid}
								class="flex-1 sm:flex-none"
							>
								Save as template
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => (loadTemplateOpen = true)}
								class="flex-1 sm:flex-none"
							>
								Load template
							</Button>
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
							placeholder="Thank you for visiting, {'{{customer_name}}'}!"
						/>
					</div>

					<!-- Body -->
					<div class="space-y-2">
						<div
							class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
						>
							<label
								for="email-body"
								class="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase"
							>
								Email body
							</label>
							<!-- Variable chips -->
							<div
								class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-x-visible sm:px-0 sm:pb-0"
							>
								{#each VARIABLES as variable (variable.value)}
									<button
										onclick={() => insertVariable(variable.value)}
										class="flex h-9 shrink-0 items-center rounded-md border border-border bg-muted/30 px-2.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/60 hover:text-foreground"
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
			<div
				class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-x-visible sm:px-0 sm:pb-0"
			>
				{#each STATUS_OPTIONS as opt (opt.value)}
					{@const active = statusFilters.has(opt.value)}
					<button
						onclick={() => {
							if (active) statusFilters.delete(opt.value);
							else statusFilters.add(opt.value);
						}}
						class="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors {active
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground'}"
					>
						{opt.label}
						{#if active}<span class="pl-1 opacity-70">×</span>{/if}
					</button>
				{/each}
			</div>

			<!-- Filters + actions -->
			<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
				<Input
					type="search"
					placeholder="Search by name, email or booking…"
					bind:value={searchQuery}
					class="h-9 w-full text-sm sm:h-8 sm:min-w-48 sm:flex-1"
				/>
				<div class="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<label for="date-from" class="shrink-0">From</label>
						<Input
							id="date-from"
							type="date"
							bind:value={dateFrom}
							class="h-9 w-full text-sm sm:h-8 sm:w-36"
						/>
					</div>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<label for="date-to" class="shrink-0">To</label>
						<Input
							id="date-to"
							type="date"
							bind:value={dateTo}
							class="h-9 w-full text-sm sm:h-8 sm:w-36"
						/>
					</div>
				</div>
				<div class="flex gap-1.5 sm:ml-auto">
					<span
						class="inline-block flex-1 sm:flex-none"
						title={!canSendSelected
							? 'Select queued, cancelled, or failed rows to send'
							: undefined}
					>
						<Button
							size="lg"
							onclick={handleSendSelected}
							disabled={selectionLoading !== null || !canSendSelected}
							class="h-9 w-full sm:h-8 sm:w-auto"
						>
							{selectionLoading === 'send' ? 'Sending…' : 'Send'}
						</Button>
					</span>
					<span
						class="inline-block flex-1 sm:flex-none"
						title={!canCancelSelected ? 'Select queued rows to cancel' : undefined}
					>
						<Button
							size="lg"
							variant="outline"
							onclick={handleCancelSelected}
							disabled={selectionLoading !== null || !canCancelSelected}
							class="h-9 w-full sm:h-8 sm:w-auto"
						>
							{selectionLoading === 'cancel' ? 'Cancelling…' : 'Cancel'}
						</Button>
					</span>
				</div>
			</div>

			<!-- List -->
			<div class="flex flex-col md:min-h-[520px]">
				{#snippet paginationFooter(border: boolean)}
					<div
						class="flex items-center justify-between {border
							? 'border-t border-border'
							: ''} px-4 py-3 sm:px-5"
					>
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
				{/snippet}

				{#if followUpsQuery.isLoading || appContext.isLoading}
					<!-- Desktop skeleton -->
					<div class="hidden flex-1 rounded-xl border border-border md:block">
						<Table class="table-fixed">
							<colgroup>
								<col class="w-[4%]" /><col class="w-[24%]" /><col class="w-[20%]" />
								<col class="w-[20%]" /><col class="w-[18%]" /><col class="w-[14%]" />
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
					<!-- Mobile skeleton -->
					<div class="space-y-3 md:hidden">
						{#each [0, 1, 2] as i (i)}
							<div class="space-y-2 rounded-xl border border-border bg-card/30 p-4">
								<Skeleton class="h-4 w-32" />
								<Skeleton class="h-3 w-48" />
								<Skeleton class="h-4 w-20" />
							</div>
						{/each}
					</div>
				{:else if followUps.length === 0}
					<div
						class="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground"
					>
						{searchQuery || dateFrom || dateTo || statusFilters.size > 0
							? 'No follow-ups match your filters.'
							: `No follow-ups yet for ${currentWorkspace?.name ?? 'this workspace'}. They appear here after guests sign a waiver.`}
					</div>
				{:else}
					<!-- Desktop table -->
					<div class="hidden rounded-xl border border-border md:block">
						<Table class="table-fixed">
							<colgroup>
								<col class="w-[4%]" /><col class="w-[24%]" /><col class="w-[20%]" />
								<col class="w-[20%]" /><col class="w-[18%]" /><col class="w-[14%]" />
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
								{#each followUps as followUp (followUp._id)}
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
										<TableCell class="min-w-0 font-mono text-sm text-muted-foreground">
											<span class="block truncate" title={displayBookingId(followUp)}>
												{displayBookingId(followUp)}
											</span>
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

						{@render paginationFooter(true)}
					</div>

					<!-- Mobile cards -->
					<div class="space-y-3 md:hidden">
						{#each followUps as followUp (followUp._id)}
							<div
								class="overflow-hidden rounded-xl border border-border bg-card/30 transition-colors {selectedIds.has(
									followUp._id
								)
									? 'ring-1 ring-ring/50'
									: ''}"
							>
								<div class="flex items-stretch">
									<label class="flex shrink-0 cursor-pointer items-center px-3">
										<span class="sr-only">Select follow-up</span>
										<input
											type="checkbox"
											class="size-4 cursor-pointer rounded accent-primary"
											checked={selectedIds.has(followUp._id)}
											onchange={() => toggleRowSelection(followUp._id)}
										/>
									</label>
									<button
										type="button"
										class="min-w-0 flex-1 px-1 py-3 pr-4 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
										onclick={() => openPreview(followUp)}
									>
										<div class="flex items-start justify-between gap-2">
											<div class="min-w-0 flex-1 space-y-0.5">
												<p class="truncate text-sm font-medium">{followUp.signerName}</p>
												<p class="truncate text-xs text-muted-foreground">
													{followUp.signerEmail}
												</p>
											</div>
											<span
												class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize {STATUS_STYLES[
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
										</div>
										<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
											<span class="max-w-full truncate font-mono" title={displayBookingId(followUp)}
												>{displayBookingId(followUp)}</span
											>
											<span>·</span>
											<span>{formatFollowUpSchedule(followUp)}</span>
										</div>
									</button>
								</div>
							</div>
						{/each}

						{@render paginationFooter(false)}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.save-indicator {
		display: inline-flex;
		max-width: 100%;
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
</style>
