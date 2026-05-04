<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteSet, SvelteURLSearchParams } from 'svelte/reactivity';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import type { FunctionReturnType } from 'convex/server';
	import type { DateValue } from '@internationalized/date';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import PageShell from '$lib/components/app/PageShell.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { escapeHtml } from '$lib/utils/rich-text-client';
	import { parseConvexId, queryString } from '$lib/utils/url';

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
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { RangeCalendar } from '$lib/components/ui/range-calendar';
	import FollowUpPreviewDialog from '$lib/components/emails/FollowUpPreviewDialog.svelte';
	import EmailLoadTemplateDialog from '$lib/components/emails/EmailLoadTemplateDialog.svelte';
	import EmailSaveTemplateDialog from '$lib/components/emails/EmailSaveTemplateDialog.svelte';
	import RichTextEditor from '$lib/components/emails/RichTextEditor.svelte';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import WorkspaceLogoUploader from '$lib/components/workspaces/WorkspaceLogoUploader.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import CloudCheckIcon from '@lucide/svelte/icons/cloud-check';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import MailIcon from '@lucide/svelte/icons/mail';
	import MailCheckIcon from '@lucide/svelte/icons/mail-check';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import XIcon from '@lucide/svelte/icons/x';

	const convex = useConvexClient();
	const appContext = useAppContext();
	const SEND_AFTER_UNITS = ['minutes', 'hours', 'days'] as const;
	type SendAfterUnit = (typeof SEND_AFTER_UNITS)[number];
	type EditorContentSnapshot = {
		subject: string;
		body: string;
		sendAfterAmount: number;
		sendAfterUnit: SendAfterUnit;
	};
	const DEFAULT_SEND_AFTER_AMOUNT = 2;
	const DEFAULT_SEND_AFTER_UNIT: SendAfterUnit = 'hours';
	const AUTOSAVE_DELAY_MS = 800;
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
		{ value: 'unscheduled', label: 'Unscheduled' },
		{ value: 'blocked', label: 'Blocked' },
		{ value: 'sent', label: 'Sent' },
		{ value: 'failed', label: 'Failed' }
	] as const;

	let statusFilters = $state(new SvelteSet<string>());
	let searchQuery = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let dateRangeValue = $state<{ start: DateValue | undefined; end: DateValue | undefined }>();
	let dateCalendarOpen = $state(false);
	let currentPage = $state(0);
	let pageCursors = $state<(string | null)[]>([null]);

	const currentCursor = $derived(pageCursors[currentPage] ?? null);
	const dateFromMillis = $derived(dateFrom ? parseLocalDateStart(dateFrom) : null);
	const dateToMillis = $derived(dateTo ? parseLocalDateEnd(dateTo) : null);
	const selectedStatusOptions = $derived(
		STATUS_OPTIONS.filter((opt) => statusFilters.has(opt.value))
	);
	const statusFilterLabel = $derived.by(() => {
		if (selectedStatusOptions.length === 0) return 'Status';
		if (selectedStatusOptions.length === 1) return selectedStatusOptions[0]?.label ?? 'Status';
		return `Status (${selectedStatusOptions.length})`;
	});
	const dateRangeLabel = $derived(formatDateRangeLabel(dateFrom, dateTo));
	const dateFilterLabel = $derived(dateFrom || dateTo ? dateRangeLabel : 'Date range');

	function parseLocalDateStart(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day).getTime();
	}

	function parseLocalDateEnd(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day + 1).getTime();
	}

	function dateValueKey(value: DateValue | undefined) {
		return value?.toString() ?? '';
	}

	function formatFilterDate(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		if (!year || !month || !day) return value;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(year, month - 1, day));
	}

	function formatDateRangeLabel(from: string, to: string) {
		if (from && to) return `${formatFilterDate(from)} - ${formatFilterDate(to)}`;
		if (from) return `From ${formatFilterDate(from)}`;
		if (to) return `Until ${formatFilterDate(to)}`;
		return 'All dates';
	}

	function setStatusFilter(value: string, selected: boolean) {
		if (selected) statusFilters.add(value);
		else statusFilters.delete(value);
	}

	function clearSearch() {
		searchQuery = '';
	}

	function clearDateRange() {
		dateFrom = '';
		dateTo = '';
		dateRangeValue = undefined;
		dateCalendarOpen = false;
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
							| 'unscheduled'
							| 'blocked'
							| 'sent'
							| 'failed'
						)[]
					}
				: {}),
			...(searchQuery.trim() ? { searchQuery: searchQuery.trim() } : {}),
			...(dateFromMillis !== null ? { dateFrom: dateFromMillis } : {}),
			...(dateToMillis !== null ? { dateTo: dateToMillis } : {})
		};
	});

	$effect(() => {
		const nextFrom = dateValueKey(dateRangeValue?.start);
		const nextTo = dateValueKey(dateRangeValue?.end);
		if (dateFrom !== nextFrom) dateFrom = nextFrom;
		if (dateTo !== nextTo) dateTo = nextTo;
	});

	const followUpIdParam = $derived(
		parseConvexId<'email_follow_ups'>(page.url.searchParams.get('followUpId'))
	);

	const templatesQuery = useProtectedQuery(api.emails.listEmailTemplates, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);

	const senderSettingsQuery = useProtectedQuery(api.emails.getWorkspaceEmailSenderSettings, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);

	type FollowUp = FunctionReturnType<typeof api.emails.listFollowUps>['page'][number];
	type EmailTemplate = FunctionReturnType<typeof api.emails.listEmailTemplates>[number];

	const stats = $derived(statsQuery.data);
	const followUpsPage = $derived(followUpsQuery.data);
	const followUps = $derived((followUpsPage?.page ?? []) as FollowUp[]);
	const templates = $derived((templatesQuery.data ?? []) as EmailTemplate[]);
	const senderSettings = $derived(senderSettingsQuery.data);
	const isLoading = $derived(
		appContext.isLoading || editorContentQuery.isLoading || senderSettingsQuery.isLoading
	);
	const pageError = $derived(
		appContext.error ??
			editorContentQuery.error ??
			senderSettingsQuery.error ??
			statsQuery.error ??
			followUpsQuery.error ??
			templatesQuery.error ??
			null
	);

	// ─── Sender summary (read-only on this page) ──────────────────────────────

	const businessName = $derived(currentWorkspace?.name ?? 'Your business');
	const isOwner = $derived(currentWorkspace?.role === 'owner');

	const brandingQuery = useProtectedQuery(api.workspaces.getWorkspaceBranding, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);
	const workspaceLogoUrl = $derived(brandingQuery.data?.logoUrl ?? null);
	const hasPlatformFromEmail = $derived(Boolean(senderSettings?.platformFromEmail));
	const workspaceCanSendEmail = $derived(Boolean(senderSettings?.canSendEmails));
	const replyToPendingVerification = $derived(Boolean(senderSettings?.pendingReplyToEmail));
	const senderUnavailableMessage = $derived(
		hasPlatformFromEmail
			? 'Verify a reply-to email before sending follow-ups.'
			: 'Sender domain is not configured. Set RESEND_FROM_EMAIL before sending follow-ups.'
	);
	const sendSelectionTooltip = $derived.by(() => {
		if (canSendSelected) return undefined;
		if (!workspaceCanSendEmail) return senderUnavailableMessage;
		return 'Select queued, unscheduled, blocked, or failed rows to send';
	});

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
	let editorRef = $state<{
		insertText: (text: string) => void;
		insertWorkspaceLogo: (logoUrl?: string | null) => void;
	} | null>(null);
	let subjectInputRef = $state<HTMLInputElement | null>(null);
	let insertTarget = $state<'subject' | 'body'>('body');
	let subjectSelectionStart = $state(0);
	let subjectSelectionEnd = $state(0);
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
		isSavingEditorContent = false;
		lastSavedAt = null;
		lastSaveError = null;
		editorContentLoaded = false;
		loadedEditorContentWorkspaceId = null;
	}

	function currentEditorContentSnapshot(): EditorContentSnapshot {
		return {
			subject,
			body,
			sendAfterAmount: clampSendAfterAmount(sendAfterAmount),
			sendAfterUnit
		};
	}

	function editorContentMatchesSnapshot(snapshot: EditorContentSnapshot) {
		return (
			subject === snapshot.subject &&
			body === snapshot.body &&
			clampSendAfterAmount(sendAfterAmount) === snapshot.sendAfterAmount &&
			sendAfterUnit === snapshot.sendAfterUnit
		);
	}

	function syncSavedEditorContent(snapshot: EditorContentSnapshot) {
		savedSubject = snapshot.subject;
		savedBody = snapshot.body;
		savedSendAfterAmount = snapshot.sendAfterAmount;
		savedSendAfterUnit = snapshot.sendAfterUnit;
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

	beforeNavigate((navigation) => {
		if (!isDirty && !isSavingEditorContent) return;
		if (navigation.willUnload) return;

		if (saveState === 'error' || lastSaveError) {
			if (
				confirm('Autosave failed and your latest email changes may not be saved. Leave anyway?')
			) {
				return;
			}
			navigation.cancel();
			return;
		}

		if (isSavingEditorContent) {
			navigation.cancel();
			toast.message('Still saving your latest changes. Give it a moment and try again.');
			return;
		}

		if (convex.disabled) {
			navigation.cancel();
			toast.message('Email autosave is unavailable right now.');
		}
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
			if (convex.disabled) return;

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

	onMount(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!isDirty && !isSavingEditorContent) return;
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
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

	function captureSubjectSelection() {
		if (!subjectInputRef) return;
		insertTarget = 'subject';
		subjectSelectionStart = subjectInputRef.selectionStart ?? subject.length;
		subjectSelectionEnd = subjectInputRef.selectionEnd ?? subjectSelectionStart;
	}

	async function insertSubjectVariable(variable: string) {
		const start = Math.max(0, Math.min(subjectSelectionStart, subject.length));
		const end = Math.max(start, Math.min(subjectSelectionEnd, subject.length));
		subject = `${subject.slice(0, start)}${variable}${subject.slice(end)}`;
		const nextCursor = start + variable.length;
		subjectSelectionStart = nextCursor;
		subjectSelectionEnd = nextCursor;
		await tick();
		subjectInputRef?.focus();
		subjectInputRef?.setSelectionRange(nextCursor, nextCursor);
	}

	function markBodyInsertTarget() {
		insertTarget = 'body';
	}

	function insertVariable(variable: string) {
		if (insertTarget === 'subject') {
			void insertSubjectVariable(variable);
			return;
		}
		editorRef?.insertText(variable);
	}

	async function persistEditorContent(options: { showToast?: boolean } = {}) {
		if (!currentWorkspace || convex.disabled) return;
		if (isSavingEditorContent) return;
		const showToast = options.showToast ?? true;
		const workspaceId = currentWorkspace.workspaceId;
		const snapshot = currentEditorContentSnapshot();
		isSavingEditorContent = true;
		lastSaveError = null;
		try {
			await convex.mutation(api.emails.upsertEmailEditorContent, {
				workspaceId,
				subject: snapshot.subject,
				body: snapshot.body,
				sendAfterAmount: snapshot.sendAfterAmount,
				sendAfterUnit: snapshot.sendAfterUnit
			});

			if (currentWorkspace?.workspaceId === workspaceId && editorContentMatchesSnapshot(snapshot)) {
				syncSavedEditorContent(snapshot);
				lastSavedAt = Date.now();
				if (showToast) toast.success('Email content saved.');
			}
		} catch (err) {
			const message = getConvexErrorMessage(err, 'Failed to save email content.');
			if (currentWorkspace?.workspaceId === workspaceId) {
				lastSaveError = message;
				if (showToast) toast.error(message);
			}
		} finally {
			if (currentWorkspace?.workspaceId === workspaceId) {
				isSavingEditorContent = false;
			}
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
	let isClosingPreview = $state(false);

	function openPreview(followUp: FollowUp) {
		isClosingPreview = false;
		previewFollowUpId = followUp._id;
		previewOpen = true;
		void updateFollowUpUrl(followUp._id, false);
	}

	function handlePreviewOpenChange(isOpen: boolean) {
		previewOpen = isOpen;
		if (isOpen) {
			isClosingPreview = false;
			return;
		}

		isClosingPreview = true;
		previewFollowUpId = null;
		void updateFollowUpUrl(null, true).finally(() => {
			isClosingPreview = false;
		});
	}

	async function updateFollowUpUrl(followUpId: Id<'email_follow_ups'> | null, replaceState = true) {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (followUpId) {
			params.set('followUpId', followUpId);
		} else {
			params.delete('followUpId');
		}

		const query = queryString([...params.entries()]);
		const pathname = `/app/${page.params.workspaceSlug}/emails` as `/app/${string}/emails`;
		const href = (query ? `${pathname}?${query}` : pathname) as
			| `/app/${string}/emails`
			| `/app/${string}/emails?${string}`;

		await goto(resolve(href), {
			replaceState,
			noScroll: true,
			keepFocus: true
		});
	}

	$effect(() => {
		if (isClosingPreview) return;
		if (!followUpIdParam) {
			if (previewOpen) {
				previewFollowUpId = null;
				previewOpen = false;
			}
			return;
		}
		if (previewFollowUpId === followUpIdParam && previewOpen) return;
		previewFollowUpId = followUpIdParam;
		previewOpen = true;
	});

	function isInteractiveEventTarget(event: Event) {
		const target = event.target;
		return target instanceof HTMLElement
			? Boolean(target.closest('a,button,input,select,textarea'))
			: false;
	}

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
		workspaceCanSendEmail &&
			selectedFollowUps.some((f) =>
				['queued', 'unscheduled', 'blocked', 'failed'].includes(f.status)
			)
	);
	const canUnscheduleSelected = $derived(selectedFollowUps.some((f) => f.status === 'queued'));

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

	let selectionLoading = $state<'send' | 'unschedule' | null>(null);

	async function handleSendSelected() {
		if (!currentWorkspace || selectedIds.size === 0) return;
		if (!workspaceCanSendEmail) {
			toast.error(senderUnavailableMessage);
			return;
		}
		selectionLoading = 'send';
		try {
			await convex.mutation(api.emails.sendSelected, {
				workspaceId: currentWorkspace.workspaceId,
				followUpIds: [...selectedIds] as Id<'email_follow_ups'>[]
			});
			selectedIds = new SvelteSet();
			toast.message('Selected follow-ups queued for delivery.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to send selected.'));
		} finally {
			selectionLoading = null;
		}
	}

	async function handleUnscheduleSelected() {
		if (!currentWorkspace || selectedIds.size === 0) return;
		selectionLoading = 'unschedule';
		try {
			await convex.mutation(api.emails.unscheduleSelected, {
				workspaceId: currentWorkspace.workspaceId,
				followUpIds: [...selectedIds] as Id<'email_follow_ups'>[]
			});
			selectedIds = new SvelteSet();
			toast.success('Selected follow-ups unscheduled.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to unschedule selected.'));
		} finally {
			selectionLoading = null;
		}
	}

	// ─── Formatting helpers ────────────────────────────────────────────────────

	function formatTimestamp(ts: number) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(ts)
		);
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
		if (followUp.status === 'unscheduled') return '—';
		if (followUp.status === 'blocked') {
			return followUp.scheduledAt === undefined
				? 'Blocked'
				: `Blocked · ${formatTimestamp(followUp.scheduledAt)}`;
		}
		if (followUp.scheduledAt === undefined) return 'Sending soon';
		return formatTimestamp(followUp.scheduledAt);
	}

	function statusLabel(status: FollowUp['status']) {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}

	function followUpSelectionLabel(followUp: FollowUp) {
		const subject = followUp.sentSubject ?? followUp.subjectTemplate ?? 'no subject';
		return `Select follow-up email for ${followUp.signerName} with subject ${subject}`;
	}

	const VARIABLES = [
		{ label: '{{customer_name}}', description: 'Customer name', value: '{{customer_name}}' },
		{ label: '{{booking_id}}', description: 'Booking number', value: '{{booking_id}}' },
		{ label: '{{business_name}}', description: 'Business name', value: '{{business_name}}' },
		{ label: '{{activity_date}}', description: 'Visit date', value: '{{activity_date}}' }
	];

	const STATUS_STYLES: Record<string, string> = {
		queued: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
		unscheduled: 'bg-muted text-muted-foreground border-border',
		sent: 'bg-green-500/10 text-green-400 border-green-500/20',
		blocked: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
		failed: 'bg-red-500/10 text-red-400 border-red-500/20'
	};

	const activeTab = $derived<'queue' | 'email'>(
		page.url.searchParams.get('tab') === 'email' || page.url.pathname.endsWith('/emails/editor')
			? 'email'
			: 'queue'
	);

	let emailPreviewMode = $state(false);

	const emailPreviewSubject = $derived(
		(subject || savedSubject)
			.replace(/\{\{customer_name\}\}|\{customer_name\}/g, 'Jane Smith')
			.replace(/\{\{booking_id\}\}|\{booking_id\}/g, '#4821')
			.replace(/\{\{business_name\}\}|\{business_name\}/g, businessName)
			.replace(/\{\{activity_date\}\}|\{activity_date\}/g, 'April 27, 2026')
	);

	const emailPreviewBody = $derived(
		(body || savedBody)
			.replace(/\{\{customer_name\}\}|\{customer_name\}/g, escapeHtml('Jane Smith'))
			.replace(/\{\{booking_id\}\}|\{booking_id\}/g, escapeHtml('#4821'))
			.replace(/\{\{business_name\}\}|\{business_name\}/g, escapeHtml(businessName))
			.replace(/\{\{activity_date\}\}|\{activity_date\}/g, escapeHtml('April 27, 2026'))
	);
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Email Follow-ups | Waiver Director</title>
</svelte:head>

{#if currentWorkspace}
	<FollowUpPreviewDialog
		bind:open={previewOpen}
		workspaceId={currentWorkspace.workspaceId}
		workspaceSlug={currentWorkspace.slug}
		workspaceName={currentWorkspace.name}
		followUpId={previewFollowUpId}
		onOpenChange={handlePreviewOpenChange}
	/>
{/if}

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

<PageHeader
	title="Email follow-ups"
	subtitle="Automatically send thank-you emails after booking-linked waiver submissions."
>
	{#snippet actions()}
		{#if !isLoading && currentWorkspace}
			{#if workspaceCanSendEmail}
				<a
					href={resolve(`/app/${currentWorkspace.slug}/settings/email` as const)}
					class="sender-chip"
					data-state="ready"
				>
					<ShieldCheckIcon class="size-3" aria-hidden="true" />
					<span class="sender-chip-label">Sending as {businessName}</span>
					{#if senderSettings?.replyToEmail}
						<span class="sender-chip-reply">
							<span class="sender-chip-reply-label">Reply-to</span>
							<span class="sender-chip-reply-email">{senderSettings.replyToEmail}</span>
						</span>
					{/if}
				</a>
			{:else if replyToPendingVerification && hasPlatformFromEmail}
				<a
					href={resolve(`/app/${currentWorkspace.slug}/settings/email` as const)}
					class="sender-chip"
					data-state="pending"
				>
					<MailCheckIcon class="size-3" aria-hidden="true" />
					<span>Verify reply-to</span>
				</a>
			{:else if hasPlatformFromEmail}
				<a
					href={resolve(`/app/${currentWorkspace.slug}/settings/email` as const)}
					class="sender-chip"
					data-state="unset"
				>
					<MailIcon class="size-3" aria-hidden="true" />
					<span>Configure reply-to</span>
				</a>
			{:else}
				<a
					href={resolve(`/app/${currentWorkspace.slug}/settings/email` as const)}
					class="sender-chip"
					data-state="unset"
				>
					<MailIcon class="size-3" aria-hidden="true" />
					<span>Sender not configured</span>
				</a>
			{/if}
		{/if}
	{/snippet}
	{#snippet meta()}
		<nav class="header-tabs" aria-label="Email follow-up sections">
			<a
				href={resolve(`/app/${page.params.workspaceSlug}/emails` as const)}
				aria-current={activeTab === 'queue' ? 'page' : undefined}
				class="header-tab-btn"
			>
				Queue
				{#if !statsQuery.isLoading}
					<span class="tab-badge">{stats?.pendingCount ?? 0}</span>
				{/if}
			</a>
			<a
				href={resolve(`/app/${page.params.workspaceSlug}/emails?tab=email` as const)}
				aria-current={activeTab === 'email' ? 'page' : undefined}
				class="header-tab-btn"
			>
				Email
			</a>
		</nav>
	{/snippet}
</PageHeader>

<PageShell>
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

	{#if activeTab === 'queue'}
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

		<!-- Follow-ups table -->
		<div class="space-y-4">
			<!-- Filters + actions -->
			<div class="space-y-2">
				<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
					<div class="relative w-full lg:max-w-md">
						<SearchIcon
							class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<input
							type="search"
							placeholder="Search by name, email, or booking number"
							bind:value={searchQuery}
							class="h-9 w-full rounded-lg border border-input bg-background/60 pr-10 pl-11 text-sm shadow-xs transition-all placeholder:text-muted-foreground/70 hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
							aria-label="Search follow-ups"
						/>
						{#if searchQuery}
							<button
								type="button"
								onclick={clearSearch}
								class="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
								aria-label="Clear search"
							>
								<XIcon class="size-3.5" aria-hidden="true" />
							</button>
						{/if}
					</div>

					<div class="flex flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto">
						<DropdownMenu>
							<DropdownMenuTrigger>
								{#snippet child({ props })}
									<Button
										{...props}
										type="button"
										size="lg"
										variant={statusFilters.size > 0 ? 'secondary' : 'outline'}
										class="h-9 w-full justify-between gap-2 sm:w-auto sm:min-w-32"
									>
										<span class="inline-flex min-w-0 items-center gap-1.5">
											<SlidersHorizontalIcon class="size-3.5 shrink-0" aria-hidden="true" />
											<span class="truncate">{statusFilterLabel}</span>
										</span>
										<ChevronDownIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
									</Button>
								{/snippet}
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" class="w-48">
								{#each STATUS_OPTIONS as opt (opt.value)}
									{@const active = statusFilters.has(opt.value)}
									<DropdownMenuCheckboxItem
										checked={active}
										closeOnSelect={false}
										onCheckedChange={(checked) => setStatusFilter(opt.value, checked)}
									>
										{opt.label}
									</DropdownMenuCheckboxItem>
								{/each}
								{#if statusFilters.size > 0}
									<div class="mt-1 border-t border-foreground/5 pt-1">
										<button
											type="button"
											onclick={() => statusFilters.clear()}
											class="flex min-h-7 w-full items-center rounded-md px-2 text-left text-xs text-muted-foreground outline-hidden transition-colors hover:bg-foreground/10 hover:text-foreground focus:bg-foreground/10 focus:text-foreground"
										>
											Clear status
										</button>
									</div>
								{/if}
							</DropdownMenuContent>
						</DropdownMenu>

						<Popover bind:open={dateCalendarOpen}>
							<PopoverTrigger>
								{#snippet child({ props })}
									<Button
										{...props}
										type="button"
										size="lg"
										variant={dateFrom || dateTo ? 'secondary' : 'outline'}
										class="h-9 w-full justify-between gap-2 sm:w-auto sm:max-w-64"
									>
										<span class="inline-flex min-w-0 items-center gap-1.5">
											<CalendarClockIcon class="size-3.5 shrink-0" aria-hidden="true" />
											<span class="truncate">{dateFilterLabel}</span>
										</span>
										<ChevronDownIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
									</Button>
								{/snippet}
							</PopoverTrigger>
							<PopoverContent align="end" class="w-auto p-2">
								<RangeCalendar bind:value={dateRangeValue} class="w-fit" />
								{#if dateFrom || dateTo}
									<div class="flex justify-end border-t border-border px-1 pt-2">
										<button
											type="button"
											onclick={clearDateRange}
											class="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
										>
											Clear dates
										</button>
									</div>
								{/if}
							</PopoverContent>
						</Popover>
					</div>

					<div class="flex gap-1.5">
						<span class="inline-block flex-1 sm:flex-none" title={sendSelectionTooltip}>
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
							title={!canUnscheduleSelected ? 'Select queued rows to unschedule' : undefined}
						>
							<Button
								size="lg"
								variant="outline"
								onclick={handleUnscheduleSelected}
								disabled={selectionLoading !== null || !canUnscheduleSelected}
								class="h-9 w-full sm:h-8 sm:w-auto"
							>
								{selectionLoading === 'unschedule' ? 'Unscheduling…' : 'Unschedule'}
							</Button>
						</span>
					</div>
				</div>
			</div>

			<!-- List -->
			<div class="flex h-[440px] min-h-0 flex-col md:h-[520px]">
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
					<div class="hidden h-full rounded-xl border border-border md:block">
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
					<div class="h-full space-y-3 overflow-hidden md:hidden">
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
						class="hidden h-full flex-col overflow-hidden rounded-xl border border-border md:flex"
					>
						<div class="min-h-0 flex-1 overflow-auto">
							<Table class="table-fixed">
								<colgroup>
									<col class="w-[4%]" /><col class="w-[24%]" /><col class="w-[20%]" />
									<col class="w-[18%]" /><col class="w-[20%]" /><col class="w-[14%]" />
								</colgroup>
								<TableHeader>
									<TableRow class="border-border hover:bg-transparent">
										<TableHead class="pl-4">
											<input
												type="checkbox"
												class="size-4 rounded accent-primary opacity-40"
												disabled
												aria-label="Select all follow-ups"
											/>
										</TableHead>
										{#each ['Customer', 'Booking', 'Waiver signed', 'Scheduled for', 'Status'] as col (col)}
											<TableHead
												class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
												>{col}</TableHead
											>
										{/each}
									</TableRow>
								</TableHeader>
							</Table>
							<div
								class="flex min-h-[320px] items-center justify-center border-t border-border px-4 text-center text-sm text-muted-foreground"
							>
								{searchQuery || dateFrom || dateTo || statusFilters.size > 0
									? 'No follow-ups match your filters.'
									: `No follow-ups yet for ${currentWorkspace?.name ?? 'this workspace'}. They appear here after guests sign a waiver.`}
							</div>
						</div>

						{@render paginationFooter(true)}
					</div>
					<div
						class="flex h-full flex-col overflow-hidden rounded-xl border border-border md:hidden"
					>
						<div
							class="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground"
						>
							{searchQuery || dateFrom || dateTo || statusFilters.size > 0
								? 'No follow-ups match your filters.'
								: `No follow-ups yet for ${currentWorkspace?.name ?? 'this workspace'}. They appear here after guests sign a waiver.`}
						</div>
						{@render paginationFooter(true)}
					</div>
				{:else}
					<!-- Desktop table -->
					<div
						class="hidden h-full flex-col overflow-hidden rounded-xl border border-border md:flex"
					>
						<div class="min-h-0 flex-1 overflow-auto">
							<Table class="table-fixed">
								<colgroup>
									<col class="w-[4%]" /><col class="w-[24%]" /><col class="w-[20%]" />
									<col class="w-[18%]" /><col class="w-[20%]" /><col class="w-[14%]" />
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
												aria-label="Select all visible emails"
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
													aria-label={followUpSelectionLabel(followUp)}
												/>
											</TableCell>
											<TableCell>
												<p class="truncate text-sm font-medium">{followUp.signerName}</p>
												<p class="truncate text-xs text-muted-foreground">
													{followUp.signerEmail}
												</p>
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
																: followUp.status === 'blocked'
																	? 'bg-yellow-400'
																	: followUp.status === 'failed'
																		? 'bg-red-400'
																		: 'bg-muted-foreground'}"
													></span>
													{statusLabel(followUp.status)}
												</span>
											</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						</div>

						{@render paginationFooter(true)}
					</div>

					<!-- Mobile cards -->
					<div class="flex h-full flex-col md:hidden">
						<div class="min-h-0 flex-1 space-y-3 overflow-auto">
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
												aria-label={followUpSelectionLabel(followUp)}
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
																: followUp.status === 'blocked'
																	? 'bg-yellow-400'
																	: followUp.status === 'failed'
																		? 'bg-red-400'
																		: 'bg-muted-foreground'}"
													></span>
													{statusLabel(followUp.status)}
												</span>
											</div>
											<div
												class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
											>
												<span
													class="max-w-full truncate font-mono"
													title={displayBookingId(followUp)}>{displayBookingId(followUp)}</span
												>
												<span>·</span>
												<span>{formatFollowUpSchedule(followUp)}</span>
											</div>
										</button>
									</div>
								</div>
							{/each}
						</div>

						{@render paginationFooter(false)}
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Email tab: sender context + editor -->
		{#if !isLoading && currentWorkspace && !workspaceCanSendEmail}
			<div
				class="sender-banner"
				data-state={replyToPendingVerification && hasPlatformFromEmail ? 'pending' : 'unset'}
			>
				<div class="sender-banner-mark">
					{#if replyToPendingVerification && hasPlatformFromEmail}
						<MailCheckIcon class="size-[18px]" />
					{:else}
						<MailIcon class="size-[18px]" />
					{/if}
				</div>
				<div class="sender-banner-body">
					<p class="sender-banner-title">
						{#if !hasPlatformFromEmail}
							Sender domain is not configured
						{:else if replyToPendingVerification}
							Almost there — verify your reply-to email
						{:else}
							Set up your sender to start sending follow-ups
						{/if}
					</p>
					<p class="sender-banner-desc">
						{#if !hasPlatformFromEmail}
							Ask an admin to set
							<code>RESEND_FROM_EMAIL</code>
							before follow-ups can be queued for delivery.
						{:else if replyToPendingVerification}
							We sent a code to
							<strong class="font-medium text-foreground"
								>{senderSettings?.pendingReplyToEmail}</strong
							>. Paste it on the email settings page to finish.
						{:else}
							Follow-ups can't go out until you verify a reply-to inbox. Takes about a minute.
						{/if}
					</p>
				</div>
				<a
					class="sender-banner-cta"
					href={resolve(`/app/${currentWorkspace.slug}/settings/email` as const)}
				>
					{replyToPendingVerification && hasPlatformFromEmail ? 'Continue' : 'Set up'}
					<ChevronRightIcon class="size-3.5" />
				</a>
			</div>
		{/if}
		<!-- Editor content -->
		{#if isLoading}
			<div class="email-layout">
				<div class="composer">
					<div class="compose-meta">
						<div class="compose-meta-row">
							<Skeleton class="h-4 w-60" />
							<Skeleton class="h-4 w-28 rounded-full" />
						</div>
					</div>
					<div class="compose-subject-row">
						<Skeleton class="h-5 w-full" />
					</div>
					<div class="compose-body-section">
						<div class="border-t border-border/70 bg-background">
							<div
								class="flex flex-col gap-2 border-b border-border/70 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
							>
								<Skeleton class="h-2.5 w-10" />
								<div class="flex flex-wrap gap-1 sm:justify-end">
									<Skeleton class="h-7 w-16" />
									<Skeleton class="h-7 w-7" />
									<Skeleton class="h-7 w-24" />
									<Skeleton class="h-7 w-14" />
									<Skeleton class="size-7" />
									<Skeleton class="size-7" />
									<Skeleton class="size-7" />
									<Skeleton class="size-7" />
								</div>
							</div>
							<div class="min-h-[300px] space-y-3 p-4">
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-10/12" />
								<Skeleton class="h-4 w-3/4" />
							</div>
						</div>
					</div>
				</div>
				<div class="email-rail">
					<div class="rail-section">
						<Skeleton class="mb-2 h-2 w-16" />
						<Skeleton class="mb-3 h-3 w-32" />
						{#each [0, 1, 2, 3] as i (i)}
							<Skeleton class="mb-1.5 h-9 w-full rounded" />
						{/each}
					</div>
					<div class="rail-section">
						<Skeleton class="mb-3 h-2 w-20" />
						<Skeleton class="mb-2 h-8 w-full rounded-md" />
						<Skeleton class="h-8 w-full rounded-md" />
					</div>
				</div>
			</div>
		{:else}
			<div class="email-layout">
				<!-- Composer (left column) -->
				<div class="composer">
					<!-- Timing / metadata card -->
					<div class="compose-meta">
						<div class="compose-meta-row">
							<span class="compose-key">Delay</span>
							<div class="compose-meta-controls">
								<Input
									type="number"
									min="1"
									value={sendAfterAmount}
									oninput={sanitizeSendAfterAmount}
									onblur={sanitizeSendAfterAmount}
									class="compose-num h-[26px] w-14 px-1.5 text-center text-sm tabular-nums"
									aria-invalid={!isSendAfterValid}
									aria-describedby="send-after-error"
								/>
								<select
									value={sendAfterUnit}
									onchange={updateSendAfterUnit}
									class="compose-select"
									aria-label="Send after unit"
								>
									{#each SEND_AFTER_UNITS as unit (unit)}
										<option value={unit}>{unit}</option>
									{/each}
								</select>
								<span class="compose-meta-prose">
									after booking · unlinked waivers unscheduled
								</span>
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
							{#if currentWorkspace && (isOwner || workspaceLogoUrl)}
								<WorkspaceLogoUploader
									workspaceId={currentWorkspace.workspaceId}
									variant="inline"
									canEdit={isOwner}
									inlineLabel="Add logo"
									inlineLabelWithLogo={emailPreviewMode ? 'Change logo' : 'Insert logo'}
									onClickWhenSet={emailPreviewMode ? null : () => editorRef?.insertWorkspaceLogo()}
									onUploadComplete={emailPreviewMode
										? null
										: (logoUrl) => editorRef?.insertWorkspaceLogo(logoUrl)}
								/>
							{/if}
							<button
								type="button"
								onclick={() => (emailPreviewMode = !emailPreviewMode)}
								class="preview-toggle"
								data-active={emailPreviewMode}
							>
								<EyeIcon class="size-3" />
								{emailPreviewMode ? 'Edit' : 'Preview'}
							</button>
						</div>
						{#if !isSendAfterValid}
							<p id="send-after-error" class="compose-error">Enter a positive whole number.</p>
						{/if}
					</div>

					{#if emailPreviewMode}
						<!-- Email preview -->
						<div class="email-preview-shell">
							<div class="email-preview-card">
								<div class="email-preview-from-row">
									<div class="email-preview-avatar">
										{businessName[0]?.toUpperCase() ?? 'B'}
									</div>
									<div class="email-preview-from-info">
										<span class="email-preview-from-name">{businessName}</span>
										<span class="email-preview-from-to">to Jane Smith</span>
									</div>
								</div>
								<div class="email-preview-subject-line">
									{emailPreviewSubject || '(no subject)'}
								</div>
								<WaiverRichText html={emailPreviewBody} class="email-preview-body-wrap" />
							</div>
							<p class="preview-sample-notice">
								Preview uses sample data — Jane Smith, #4821, April 27, 2026.
							</p>
						</div>
					{:else}
						<!-- Subject row -->
						<div class="compose-subject-row">
							<label for="email-subject" class="compose-key compose-key--subject">Subject</label>
							<input
								id="email-subject"
								bind:this={subjectInputRef}
								type="text"
								bind:value={subject}
								placeholder="Thank you for visiting {'{{business_name}}'}!"
								spellcheck="true"
								autocomplete="off"
								class="compose-subject-input"
								onfocus={captureSubjectSelection}
								onclick={captureSubjectSelection}
								onkeyup={captureSubjectSelection}
								onselect={captureSubjectSelection}
								oninput={captureSubjectSelection}
							/>
						</div>

						<!-- Body -->
						<div class="compose-body-section" onfocusin={markBodyInsertTarget}>
							<RichTextEditor
								id="email-body"
								label="Body"
								class="email-rich-editor"
								bind:value={body}
								bind:this={editorRef}
								{workspaceLogoUrl}
								workspaceName={businessName}
							/>
						</div>
					{/if}
				</div>

				<!-- Tool rail (right column) -->
				<div class="email-rail">
					<div class="rail-section">
						<p class="rail-label">Variables</p>
						<p class="rail-hint">Click to insert at cursor.</p>
						<div class="var-list">
							{#each VARIABLES as variable (variable.value)}
								<button
									type="button"
									onclick={() => insertVariable(variable.value)}
									class="var-item"
								>
									<div class="var-item-text">
										<span class="var-tag">{variable.label}</span>
										<span class="var-desc">{variable.description}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>

					<div class="rail-section">
						<p class="rail-label">Templates</p>
						<div class="rail-template-btns">
							<Button
								variant="outline"
								size="sm"
								onclick={() => (loadTemplateOpen = true)}
								class="w-full justify-start text-xs"
							>
								Load template
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={openSaveTemplate}
								disabled={isSavingEditorContent || !isSendAfterValid}
								class="w-full justify-start text-xs"
							>
								Save as template
							</Button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</PageShell>

<style>
	.save-indicator {
		display: inline-flex;
		max-width: 100%;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.55rem;
		border-radius: var(--radius-full);
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

	/* ─── Sender status chip (header) ───────────────────────────────────────── */

	.sender-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.65rem 0.25rem 0.5rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border);
		font-size: 0.72rem;
		font-weight: 500;
		text-decoration: none;
		color: var(--muted-foreground);
		background: color-mix(in srgb, var(--muted) 30%, transparent);
		transition: all 150ms ease;
		white-space: nowrap;
		max-width: calc(100vw - 3rem);
	}

	.sender-chip:hover {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--border) 150%, transparent);
		background: color-mix(in srgb, var(--muted) 50%, transparent);
	}

	.sender-chip[data-state='ready'] {
		border-color: color-mix(in srgb, oklch(0.65 0.18 152) 30%, var(--border));
		color: oklch(0.72 0.16 152);
		background: color-mix(in srgb, oklch(0.6 0.16 152) 10%, transparent);
	}

	.sender-chip[data-state='ready']:hover {
		border-color: color-mix(in srgb, oklch(0.65 0.18 152) 50%, var(--border));
		background: color-mix(in srgb, oklch(0.6 0.16 152) 16%, transparent);
		color: oklch(0.8 0.18 152);
	}

	.sender-chip[data-state='pending'] {
		border-color: color-mix(in srgb, var(--destructive) 22%, var(--border));
		color: color-mix(in srgb, var(--destructive) 80%, var(--foreground));
		background: color-mix(in srgb, var(--destructive) 8%, transparent);
	}

	.sender-chip[data-state='unset'] {
		border-color: color-mix(in srgb, var(--destructive) 22%, var(--border));
		color: color-mix(in srgb, var(--destructive) 80%, var(--foreground));
		background: color-mix(in srgb, var(--destructive) 8%, transparent);
	}

	.sender-chip-label,
	.sender-chip-reply,
	.sender-chip-reply-email {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sender-chip-label {
		max-width: 14rem;
	}

	.sender-chip-reply {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		max-width: 20rem;
		margin-left: 0.15rem;
		padding-left: 0.6rem;
		border-left: 1px solid color-mix(in srgb, currentColor 32%, transparent);
		color: color-mix(in srgb, currentColor 86%, var(--muted-foreground));
	}

	.sender-chip-reply-label {
		flex-shrink: 0;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.72;
	}

	.sender-chip-reply-email {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.68rem;
	}

	/* ─── Header tab strip ───────────────────────────────────────────────────── */

	.header-tabs {
		display: flex;
		align-items: flex-end;
		gap: 0;
	}

	.header-tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 0.1rem;
		margin-right: 1.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted-foreground);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		cursor: pointer;
		transition:
			color 150ms ease,
			border-color 150ms ease;
		outline: none;
	}

	.header-tab-btn:hover {
		color: var(--foreground);
	}

	.header-tab-btn[aria-current='page'] {
		color: var(--foreground);
		border-bottom-color: var(--primary);
	}

	.header-tab-btn:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--ring) 50%, transparent);
		outline-offset: 2px;
		border-radius: 2px;
	}

	.tab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.3rem;
		border-radius: var(--radius-full);
		font-size: 0.65rem;
		font-weight: 600;
		line-height: 1;
		background: color-mix(in srgb, var(--muted) 70%, transparent);
		color: var(--foreground);
		border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
	}

	/* ─── Email tab two-column layout ────────────────────────────────────────── */

	.email-layout {
		display: grid;
		grid-template-columns: 1fr 220px;
		gap: 1.25rem;
		align-items: stretch;
		min-height: calc(100svh - 14rem);
	}

	@media (max-width: 720px) {
		.email-layout {
			grid-template-columns: 1fr;
			min-height: auto;
		}
	}

	/* ─── Composer column ────────────────────────────────────────────────────── */

	.composer {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 0;
		min-height: inherit;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--background) 72%, var(--card));
		overflow: hidden;
	}

	/* Shared key label */
	.compose-key {
		flex-shrink: 0;
		width: 52px;
		font-size: 0.63rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
		padding-top: 1px;
		user-select: none;
	}

	/* Metadata card (timing + save indicator) */
	.compose-meta {
		padding: 0.7rem 1rem;
		background: color-mix(in srgb, var(--card) 60%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
	}

	.compose-meta-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.compose-meta-controls {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
		flex-wrap: wrap;
		min-width: 0;
	}

	.compose-select {
		height: 26px;
		background: color-mix(in srgb, var(--input) 20%, transparent);
		border: 1px solid var(--input);
		border-radius: var(--radius-sm);
		padding: 0 0.45rem;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		font-family: inherit;
		outline: none;
		cursor: pointer;
		transition:
			color 130ms ease,
			border-color 130ms ease;
	}

	.compose-select:hover {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--border) 150%, transparent);
	}

	.compose-select:focus-visible {
		border-color: var(--ring);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 30%, transparent);
	}

	.compose-meta-prose {
		font-size: 0.775rem;
		color: color-mix(in srgb, var(--muted-foreground) 65%, transparent);
		white-space: nowrap;
	}

	.compose-error {
		margin-top: 0.35rem;
		font-size: 0.75rem;
		color: var(--destructive);
	}

	/* Subject row */
	.compose-subject-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.8rem 1rem;
		background: color-mix(in srgb, var(--background) 30%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}

	.compose-key--subject {
		padding-top: 0;
	}

	.compose-subject-input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		font-family: inherit;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--foreground);
		padding: 0;
		line-height: 1.4;
	}

	.compose-subject-input::placeholder {
		color: color-mix(in srgb, var(--muted-foreground) 45%, transparent);
		font-weight: 400;
	}

	/* Body section */
	.compose-body-section {
		display: flex;
		flex-direction: column;
		gap: 0;
		flex: 1;
		min-height: 0;
	}

	/* ─── Tool rail (right column) ───────────────────────────────────────────── */

	.email-rail {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-height: inherit;
		background: color-mix(in srgb, var(--background) 60%, var(--card));
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	:global(.email-rich-editor) {
		flex: 1;
		min-height: 0;
	}

	:global(.email-rich-editor .rich-text-editor-viewport) {
		display: flex;
		flex: 1;
		max-height: none;
		min-height: 0;
	}

	:global(.email-rich-editor .rich-text-editor-viewport > div),
	:global(.email-rich-editor .rich-text-editor-body) {
		flex: 1;
		min-height: 100%;
		width: 100%;
	}

	.rail-section {
		padding: 0.8rem 0.875rem;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
	}

	.rail-section:last-child {
		border-bottom: none;
	}

	.rail-label {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 65%, transparent);
		margin-bottom: 0.25rem;
	}

	.rail-hint {
		font-size: 0.7rem;
		color: color-mix(in srgb, var(--muted-foreground) 55%, transparent);
		line-height: 1.4;
		margin-bottom: 0.55rem;
	}

	.var-list {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.var-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		padding: 0.4rem 0.5rem;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
		width: 100%;
		transition:
			background 130ms ease,
			border-color 130ms ease;
	}

	.var-item:hover {
		background: color-mix(in srgb, var(--muted) 60%, transparent);
		border-color: color-mix(in srgb, var(--border) 140%, transparent);
	}

	.var-item::after {
		content: '+';
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
		opacity: 0;
		transition: opacity 130ms ease;
		flex-shrink: 0;
	}

	.var-item:hover::after {
		opacity: 1;
	}

	.var-item-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.var-tag {
		width: fit-content;
		border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--muted) 55%, transparent);
		padding: 0.05rem 0.25rem;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.67rem;
		color: color-mix(in srgb, var(--foreground) 88%, var(--muted-foreground));
	}

	.var-desc {
		font-size: 0.67rem;
		color: color-mix(in srgb, var(--muted-foreground) 75%, transparent);
	}

	.rail-template-btns {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	/* ─── Sender blocking banner (email tab) ─────────────────────────────────── */

	.sender-banner {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.95rem 1rem;
		border-radius: var(--radius-xl);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--card) 70%, transparent);
		min-width: 0;
	}

	.sender-banner[data-state='unset'] {
		border-color: color-mix(in srgb, var(--destructive) 20%, var(--border));
		background: color-mix(in srgb, var(--destructive) 6%, transparent);
		color: color-mix(in srgb, var(--destructive) 70%, var(--foreground));
	}

	.sender-banner[data-state='pending'] {
		border-color: color-mix(in srgb, var(--destructive) 20%, var(--border));
		background: color-mix(in srgb, var(--destructive) 6%, transparent);
		color: color-mix(in srgb, var(--destructive) 70%, var(--foreground));
	}

	.sender-banner-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-xl);
		flex-shrink: 0;
	}

	.sender-banner[data-state='unset'] .sender-banner-mark {
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
		color: var(--destructive);
		border: 1px solid color-mix(in srgb, var(--destructive) 20%, transparent);
	}

	.sender-banner[data-state='pending'] .sender-banner-mark {
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
		color: var(--destructive);
		border: 1px solid color-mix(in srgb, var(--destructive) 20%, transparent);
		animation: banner-pulse 1.8s ease-in-out infinite;
	}

	@keyframes banner-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--destructive) 20%, transparent);
		}
		50% {
			box-shadow: 0 0 0 5px color-mix(in srgb, var(--destructive) 0%, transparent);
		}
	}

	.sender-banner-body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.sender-banner-title {
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);
	}

	.sender-banner[data-state='unset'] .sender-banner-title,
	.sender-banner[data-state='pending'] .sender-banner-title {
		color: color-mix(in srgb, var(--destructive) 70%, var(--foreground));
	}

	.sender-banner-desc {
		font-size: 0.74rem;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.sender-banner[data-state='unset'] .sender-banner-desc,
	.sender-banner[data-state='pending'] .sender-banner-desc {
		color: color-mix(in srgb, var(--destructive) 48%, var(--muted-foreground));
	}

	.sender-banner-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.45rem 0.85rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--primary-foreground);
		background: var(--primary);
		border-radius: var(--radius-md);
		text-decoration: none;
		flex-shrink: 0;
		transition: all 150ms ease;
		box-shadow: 0 1px 0 color-mix(in srgb, var(--foreground) 8%, transparent);
	}

	.sender-banner-cta:hover {
		background: color-mix(in srgb, var(--primary) 90%, var(--foreground) 10%);
	}

	/* ─── Preview toggle button ──────────────────────────────────────────────── */

	.preview-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.22rem 0.6rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border);
		background: transparent;
		font-size: 0.7rem;
		font-weight: 500;
		font-family: inherit;
		color: var(--muted-foreground);
		cursor: pointer;
		flex-shrink: 0;
		transition: all 130ms ease;
		white-space: nowrap;
	}

	.preview-toggle:hover:not(:disabled) {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--border) 150%, transparent);
		background: color-mix(in srgb, var(--muted) 50%, transparent);
	}

	.preview-toggle:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.preview-toggle[data-active='true'] {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--border) 140%, transparent);
		background: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	/* ─── Email preview panel ────────────────────────────────────────────────── */

	.email-preview-shell {
		background: #eef0f3;
		padding: 1.5rem 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 320px;
	}

	.email-preview-card {
		background: #ffffff;
		border-radius: 8px;
		box-shadow:
			0 1px 4px rgba(0, 0, 0, 0.08),
			0 0 0 1px rgba(0, 0, 0, 0.06);
		overflow: hidden;
		color: #1a1a1a;
	}

	.email-preview-from-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.9rem 1.1rem 0.75rem;
		border-bottom: 1px solid #e8eaed;
	}

	.email-preview-avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: #4b5563;
		color: #ffffff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: 600;
		flex-shrink: 0;
		overflow: hidden;
	}

	.email-preview-from-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.email-preview-from-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #111827;
		line-height: 1.3;
	}

	.email-preview-from-to {
		font-size: 0.7rem;
		color: #6b7280;
	}

	.email-preview-subject-line {
		padding: 0.7rem 1.1rem 0.55rem;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #111827;
		border-bottom: 1px solid #e8eaed;
		line-height: 1.4;
	}

	:global(.email-preview-body-wrap) {
		padding: 1rem 1.1rem 1.25rem;
		font-size: 0.875rem;
		line-height: 1.7;
		color: #374151;
	}

	:global(.email-preview-body-wrap p) {
		margin: 0 0 0.75em;
		color: #374151;
	}

	:global(.email-preview-body-wrap p:last-child) {
		margin-bottom: 0;
	}

	:global(.email-preview-body-wrap a) {
		color: #2563eb;
		text-decoration: underline;
	}

	:global(.email-preview-body-wrap strong),
	:global(.email-preview-body-wrap b) {
		color: #111827;
	}

	:global(.email-preview-body-wrap span) {
		color: inherit;
	}

	:global(.email-preview-body-wrap h1),
	:global(.email-preview-body-wrap h2),
	:global(.email-preview-body-wrap h3),
	:global(.email-preview-body-wrap h4),
	:global(.email-preview-body-wrap h5),
	:global(.email-preview-body-wrap h6) {
		color: #111827;
	}

	:global(.email-preview-body-wrap ul),
	:global(.email-preview-body-wrap ol) {
		color: #374151;
	}

	.preview-sample-notice {
		font-size: 0.68rem;
		color: color-mix(in srgb, var(--muted-foreground) 60%, transparent);
		text-align: center;
		padding: 0 0.5rem;
	}
</style>
