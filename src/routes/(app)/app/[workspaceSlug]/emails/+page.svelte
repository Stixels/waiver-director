<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
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
	import { escapeHtml } from '$lib/utils/rich-text';
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
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import {
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuContent,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { RangeCalendar } from '$lib/components/ui/range-calendar';
	import EmailLoadTemplateDialog from '$lib/components/emails/EmailLoadTemplateDialog.svelte';
	import EmailSaveTemplateDialog from '$lib/components/emails/EmailSaveTemplateDialog.svelte';
	import RichTextEditor from '$lib/components/emails/RichTextEditor.svelte';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import CloudCheckIcon from '@lucide/svelte/icons/cloud-check';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import MailIcon from '@lucide/svelte/icons/mail';
	import MailCheckIcon from '@lucide/svelte/icons/mail-check';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import TicketIcon from '@lucide/svelte/icons/ticket';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';
	import XIcon from '@lucide/svelte/icons/x';

	const convex = useConvexClient();
	const appContext = useAppContext();
	const SEND_AFTER_UNITS = ['minutes', 'hours', 'days'] as const;
	type SendAfterUnit = (typeof SEND_AFTER_UNITS)[number];
	const DEFAULT_SEND_AFTER_AMOUNT = 2;
	const DEFAULT_SEND_AFTER_UNIT: SendAfterUnit = 'hours';
	const AUTOSAVE_DELAY_MS = 1800;
	const previewMetaLinkClass =
		'group/link inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-foreground/30 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none';
	const previewMetaItemClass =
		'min-w-0 border-t border-border pt-2 first:border-t-0 first:pt-0 sm:border-t-0 sm:border-l sm:px-3 sm:pt-0 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0';
	const previewMetaLabelClass =
		'mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase';

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

	const selectedFollowUpQuery = useProtectedQuery(
		api.emails.getFollowUp,
		() =>
			currentWorkspace && followUpIdParam
				? {
						workspaceId: currentWorkspace.workspaceId,
						followUpId: followUpIdParam
					}
				: 'skip',
		() => ({ keepPreviousData: false })
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
			selectedFollowUpQuery.error ??
			templatesQuery.error ??
			null
	);

	// ─── Sender summary (read-only on this page) ──────────────────────────────

	const businessName = $derived(currentWorkspace?.name ?? 'Your business');
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
	let previewSnapshot = $state<FollowUp | null>(null);
	let isClosingPreview = $state(false);

	function openPreview(followUp: FollowUp) {
		isClosingPreview = false;
		previewSnapshot = followUp;
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
		previewSnapshot = null;
		void updateFollowUpUrl(null, true).finally(() => {
			isClosingPreview = false;
		});
	}

	async function updateFollowUpUrl(followUpId: Id<'email_follow_ups'> | null, replaceState = true) {
		const query = queryString([['followUpId', followUpId]]);
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
		const selectedFollowUp = selectedFollowUpQuery.data as FollowUp | null | undefined;
		if (isClosingPreview) return;
		if (!followUpIdParam || !selectedFollowUp) return;
		if (previewFollowUpId === followUpIdParam && previewOpen) return;
		previewSnapshot = selectedFollowUp;
		previewFollowUpId = followUpIdParam;
		previewOpen = true;
	});

	const lastPreviewFollowUp = $derived.by(() => {
		if (!previewFollowUpId) return null;
		const visibleFollowUp = followUps.find((followUp) => followUp._id === previewFollowUpId);
		return visibleFollowUp ?? (previewSnapshot?._id === previewFollowUpId ? previewSnapshot : null);
	});

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
			customerId: f.customerId,
			bookingRecordId: f.bookingId,
			bookingNumber: f.bookingNumber,
			bookingActivityName: f.bookingActivityName,
			bookingStartTime: f.bookingStartTime,
			businessName: currentWorkspace?.name ?? '',
			activityDate: formatActivityDate(f),
			scheduledAt: f.scheduledAt ?? null,
			status: f.status,
			followUpId: f._id
		};
	});

	function submissionPath(submissionId: Id<'waiver_submissions'>) {
		const query = queryString([['submissionId', submissionId]]);
		return `/app/${page.params.workspaceSlug}/submissions?${query}` as `/app/${string}/submissions?${string}`;
	}

	function bookingDateParam(startTime: string | null | undefined) {
		if (!startTime) return null;
		const dateOnly = startTime.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/)?.[1];
		if (dateOnly) return dateOnly;
		const parsedDate = new Date(startTime);
		if (Number.isNaN(parsedDate.getTime())) return null;
		const year = parsedDate.getFullYear();
		const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
		const day = String(parsedDate.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function bookingPath(bookingId: Id<'bookings'>, startTime: string | null | undefined) {
		const query = queryString([
			['date', bookingDateParam(startTime)],
			['bookingId', bookingId]
		]);
		return `/app/${page.params.workspaceSlug}/bookings?${query}` as `/app/${string}/bookings?${string}`;
	}

	function customerPath(customerId: Id<'customers'>) {
		const query = queryString([['customerId', customerId]]);
		return `/app/${page.params.workspaceSlug}/customers?${query}` as `/app/${string}/customers?${string}`;
	}

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

	let rowLoading = $state<Id<'email_follow_ups'> | null>(null);

	async function handleRowAction(
		action: 'send' | 'unschedule',
		followUpId: Id<'email_follow_ups'>
	) {
		if (action === 'send' && !workspaceCanSendEmail) {
			toast.error(senderUnavailableMessage);
			return;
		}
		rowLoading = followUpId;
		try {
			if (action === 'send') {
				await convex.mutation(api.emails.sendFollowUpNow, { followUpId });
				toast.message('Follow-up queued for delivery.');
			} else if (action === 'unschedule') {
				await convex.mutation(api.emails.unscheduleFollowUp, { followUpId });
				toast.success('Follow-up unscheduled.');
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

	function parseTimestamp(value: string | null | undefined) {
		if (!value) return null;
		const timestamp = Date.parse(value);
		return Number.isNaN(timestamp) ? null : timestamp;
	}

	function formatActivityDate(followUp: FollowUp) {
		const bookingStartAt = parseTimestamp(followUp.bookingStartTime);
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
			new Date(bookingStartAt ?? followUp.submittedAt)
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

	const VARIABLES = [
		{ label: '{{customer_name}}', value: '{{customer_name}}' },
		{ label: '{{booking_id}}', value: '{{booking_id}}' },
		{ label: '{{business_name}}', value: '{{business_name}}' },
		{ label: '{{activity_date}}', value: '{{activity_date}}' }
	];

	const STATUS_STYLES: Record<string, string> = {
		queued: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
		unscheduled: 'bg-muted text-muted-foreground border-border',
		sent: 'bg-green-500/10 text-green-400 border-green-500/20',
		blocked: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
		failed: 'bg-red-500/10 text-red-400 border-red-500/20'
	};
</script>

<svelte:head>
	<title>{currentWorkspace?.name ?? 'Workspace'} Email Follow-ups | Waiver Director</title>
</svelte:head>

<!-- Follow-up preview modal -->
<Dialog bind:open={previewOpen} onOpenChange={handlePreviewOpenChange}>
	<DialogContent class="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-[860px]">
		{#if previewVars}
			<DialogHeader class="shrink-0 border-b border-border px-4 py-4 sm:px-6">
				<div class="space-y-3">
					<div class="min-w-0 pr-8 sm:pr-10">
						<DialogTitle class="truncate text-base font-semibold">
							{previewVars.signerName}
						</DialogTitle>
						<DialogDescription class="mt-0.5 truncate text-xs text-muted-foreground">
							{previewVars.signerEmail}
						</DialogDescription>
					</div>

					<div
						class="grid gap-2 border-y border-border py-2 sm:grid-cols-[1fr_1.05fr_1.35fr_1.05fr] sm:gap-0"
					>
						<div class={previewMetaItemClass}>
							<div class={previewMetaLabelClass}>
								<CalendarClockIcon class="size-3" aria-hidden="true" />
								Signed
							</div>
							<p class="min-w-0 truncate text-xs font-medium text-foreground tabular-nums">
								{previewVars.activityDate}
							</p>
							{#if previewVars.status === 'queued' && previewVars.scheduledAt !== null}
								<p class="shrink-0 text-[11px] text-muted-foreground tabular-nums">
									Scheduled for {formatTimestamp(previewVars.scheduledAt)}
								</p>
							{/if}
						</div>

						<div class={previewMetaItemClass}>
							<div class={previewMetaLabelClass}>
								<UsersRoundIcon class="size-3" aria-hidden="true" />
								Customer
							</div>
							{#if previewVars.customerId}
								<a
									href={resolve(customerPath(previewVars.customerId))}
									class={previewMetaLinkClass}
								>
									<span class="truncate">{previewVars.signerName}</span>
									<span
										class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
									>
										<ArrowRightIcon class="size-2.5" aria-hidden="true" />
									</span>
								</a>
							{:else}
								<p class="min-w-0 truncate text-xs text-muted-foreground">No link</p>
							{/if}
						</div>

						<div class={previewMetaItemClass}>
							<div class={previewMetaLabelClass}>
								<TicketIcon class="size-3" aria-hidden="true" />
								Booking
							</div>
							{#if previewVars.bookingRecordId && previewVars.bookingNumber}
								<a
									href={resolve(
										bookingPath(previewVars.bookingRecordId, previewVars.bookingStartTime)
									)}
									class={previewMetaLinkClass}
								>
									<span class="shrink-0">#{previewVars.bookingNumber}</span>
									{#if previewVars.bookingActivityName}
										<span class="truncate font-normal text-foreground/70">
											{previewVars.bookingActivityName}
										</span>
									{/if}
									<span
										class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
									>
										<ArrowRightIcon class="size-2.5" aria-hidden="true" />
									</span>
								</a>
							{:else if previewVars.bookingNumber}
								<p class="min-w-0 truncate text-xs font-medium text-foreground">
									#{previewVars.bookingNumber}
									{#if previewVars.bookingActivityName}
										<span class="font-normal text-muted-foreground">
											{previewVars.bookingActivityName}
										</span>
									{/if}
								</p>
							{:else}
								<p class="min-w-0 truncate text-xs text-muted-foreground">No booking</p>
							{/if}
						</div>

						<div class={previewMetaItemClass}>
							<div class={previewMetaLabelClass}>
								<FileTextIcon class="size-3" aria-hidden="true" />
								Submission
							</div>
							{#if lastPreviewFollowUp}
								<a
									href={resolve(submissionPath(lastPreviewFollowUp.submissionId))}
									class={previewMetaLinkClass}
								>
									<span class="truncate">Waiver</span>
									<span
										class="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/link:border-foreground/30 group-hover/link:text-foreground"
									>
										<ArrowRightIcon class="size-2.5" aria-hidden="true" />
									</span>
								</a>
							{:else}
								<p class="min-w-0 truncate text-xs text-muted-foreground">No link</p>
							{/if}
						</div>
					</div>
				</div>
			</DialogHeader>

			<div class="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-5 sm:px-6">
				<div class="space-y-5">
					<section class="space-y-1.5">
						<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
							Subject
						</p>
						<p class="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
							{resolvedSubject}
						</p>
					</section>

					<section class="space-y-1.5">
						<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
							Body
						</p>
						<WaiverRichText
							html={resolvedBodyHtml}
							class="overflow-hidden rounded-xl border border-border bg-background px-4 py-3 text-sm leading-7 wrap-break-word text-foreground shadow-sm"
						/>
					</section>
				</div>
			</div>

			<!-- Footer actions -->
			{#if ['queued', 'unscheduled', 'failed', 'blocked'].includes(previewVars.status)}
				<div class="flex items-center justify-between border-t border-border px-6 py-4">
					{#if previewVars.status === 'queued'}
						<Button
							variant="destructive"
							size="sm"
							onclick={() => handleRowAction('unschedule', previewVars!.followUpId)}
							disabled={rowLoading === previewVars.followUpId}
						>
							Unschedule follow-up
						</Button>
					{:else}
						<span></span>
					{/if}
					<div class="flex gap-2">
						<span title={!workspaceCanSendEmail ? senderUnavailableMessage : undefined}>
							<Button
								size="sm"
								onclick={() => handleRowAction('send', previewVars!.followUpId)}
								disabled={rowLoading === previewVars.followUpId || !workspaceCanSendEmail}
							>
								{rowLoading === previewVars.followUpId ? 'Sending…' : 'Send now'}
							</Button>
						</span>
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

<PageHeader
	title="Email follow-ups"
	subtitle="Automatically send thank-you emails after booking-linked waiver submissions."
/>

<PageShell>
	<!-- Sender status strip / blocking banner -->
	{#if isLoading}
		<Skeleton class="h-12 w-full rounded-xl" />
	{:else if currentWorkspace}
		{@const settingsHref = resolve(`/app/${currentWorkspace.slug}/settings/email` as const)}
		{#if workspaceCanSendEmail}
			<a class="sender-strip" data-state="ready" href={settingsHref}>
				<span class="sender-strip-mark">
					<ShieldCheckIcon class="size-3.5" />
				</span>
				<span class="sender-strip-text">
					Sending as
					<strong class="font-semibold text-foreground">{businessName}</strong>
					· replies route to
					<span class="sender-strip-mono">{senderSettings?.replyToEmail}</span>
				</span>
				<span class="sender-strip-cta">
					Edit
					<ChevronRightIcon class="size-3" />
				</span>
			</a>
		{:else}
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
				<a class="sender-banner-cta" href={settingsHref}>
					{replyToPendingVerification && hasPlatformFromEmail ? 'Continue' : 'Set up'}
					<ChevronRightIcon class="size-3.5" />
				</a>
			</div>
		{/if}
	{/if}

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

	<!-- Follow-ups table -->
	<div class="space-y-4">
		<div class="space-y-1.5">
			<h2 class="text-xl font-semibold tracking-tight">Follow-ups</h2>
			<p class="text-sm text-muted-foreground">
				Select rows to act on them, or click a row to preview the email.
			</p>
		</div>

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
				<div class="hidden h-full flex-col overflow-hidden rounded-xl border border-border md:flex">
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
				<div class="flex h-full flex-col overflow-hidden rounded-xl border border-border md:hidden">
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
				<div class="hidden h-full flex-col overflow-hidden rounded-xl border border-border md:flex">
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
					</div>

					{@render paginationFooter(false)}
				</div>
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
					<Skeleton class="h-7 w-full" />
				</div>

				<!-- Body -->
				<div class="space-y-2">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
							<span>Sent to booking-linked signers</span>
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
							<span>after booking time.</span>
						</div>
						<p class="text-xs text-muted-foreground">
							General waivers appear as unscheduled follow-ups.
						</p>
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
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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

	/* ─── Sender status strip + blocking banner ─────────────────────────────── */

	.sender-strip {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 0.85rem 0.55rem 0.65rem;
		border-radius: var(--radius-xl);
		border: 1px solid color-mix(in srgb, oklch(0.65 0.18 152) 25%, var(--border));
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, oklch(0.6 0.16 152) 8%, transparent),
				color-mix(in srgb, oklch(0.6 0.16 152) 3%, transparent)
			),
			color-mix(in srgb, var(--card) 60%, transparent);
		text-decoration: none;
		color: var(--foreground);
		transition: all 150ms ease;
		min-width: 0;
	}

	.sender-strip:hover {
		border-color: color-mix(in srgb, oklch(0.6 0.16 152) 45%, var(--border));
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, oklch(0.6 0.16 152) 12%, transparent),
				color-mix(in srgb, oklch(0.6 0.16 152) 5%, transparent)
			),
			var(--card);
	}

	.sender-strip-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.65rem;
		height: 1.65rem;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, oklch(0.6 0.16 152) 18%, transparent);
		color: oklch(0.78 0.18 152);
		flex-shrink: 0;
	}

	.sender-strip-text {
		font-size: 0.78rem;
		color: var(--muted-foreground);
		min-width: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sender-strip-mono {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		padding: 0.05rem 0.4rem;
		background: color-mix(in srgb, var(--muted) 50%, transparent);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--foreground);
		font-weight: 500;
	}

	.sender-strip-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--muted-foreground);
		flex-shrink: 0;
		transition: color 150ms ease;
	}

	.sender-strip:hover .sender-strip-cta {
		color: var(--foreground);
	}

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
</style>
