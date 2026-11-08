// Pure CSV helpers for Owner-only exports. Kept free of app imports so they can
// be unit tested with `node --test`.

type CsvCell = string | number | null | undefined;

// Spreadsheet apps evaluate cells that start with these characters as
// formulas. Signer-entered text must never run as a formula when an Owner
// opens the export, so such cells are prefixed with a single quote.
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);

export function escapeCsvCell(value: CsvCell): string {
	if (value === null || value === undefined) return '';
	let text = String(value);
	if (typeof value === 'string' && FORMULA_PREFIXES.has(text[0])) {
		text = `'${text}`;
	}
	if (/[",\r\n]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
	return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n';
}

function formatExportTimestamp(timestamp: number): string {
	return new Date(timestamp).toISOString();
}

export type SubmissionExportRow = {
	submissionId: string;
	submittedAt: number;
	signerName: string;
	signerEmail: string;
	signerDateOfBirth: string;
	minors: string[];
	waiverTitle: string;
	waiverVersionNumber: number;
	bookingProvider: string | null;
	providerBookingId: string | null;
	bookingActivityName: string | null;
	bookingStartTime: string | null;
	marketingConsent: boolean;
	answers: Array<{ fieldId: string; label: string; value: string }>;
};

type CustomerExportRow = {
	customerId: string;
	displayName: string;
	primaryEmail: string;
	firstSeenAt: number;
	lastSeenAt: number;
	visitCount: number;
};

const SUBMISSION_BASE_HEADERS = [
	'Submission ID',
	'Signed at (UTC)',
	'Signer name',
	'Signer email',
	'Signer date of birth',
	'Covered minors',
	'Minor count',
	'Waiver title',
	'Waiver version',
	'Booking provider',
	'Booking number',
	'Activity',
	'Booking start',
	'Marketing consent'
];

/**
 * Builds the submissions CSV. Custom field columns are keyed by field id, so a
 * field that kept its id across published versions shares one column, while
 * different fields that happen to share a label stay separate (no implicit
 * cross-version merge by label). Each column is headed by the most recent
 * label seen for that field.
 */
export function buildSubmissionsCsv(rows: SubmissionExportRow[]): string {
	const fieldOrder: string[] = [];
	const fieldLabels = new Map<string, string>();
	for (const row of rows) {
		for (const answer of row.answers) {
			if (!fieldLabels.has(answer.fieldId)) fieldOrder.push(answer.fieldId);
			fieldLabels.set(answer.fieldId, answer.label);
		}
	}

	const usedHeaders = new Map<string, number>();
	for (const header of SUBMISSION_BASE_HEADERS) usedHeaders.set(header, 1);
	const fieldHeaders = fieldOrder.map((fieldId) => {
		const label = fieldLabels.get(fieldId)?.trim() || fieldId;
		const seen = usedHeaders.get(label) ?? 0;
		usedHeaders.set(label, seen + 1);
		return seen === 0 ? label : `${label} (${seen + 1})`;
	});

	const body = rows.map((row) => {
		const answersById = new Map(row.answers.map((answer) => [answer.fieldId, answer.value]));
		return [
			row.submissionId,
			formatExportTimestamp(row.submittedAt),
			row.signerName,
			row.signerEmail,
			row.signerDateOfBirth,
			row.minors.join('; '),
			row.minors.length,
			row.waiverTitle,
			row.waiverVersionNumber,
			row.bookingProvider,
			row.providerBookingId,
			row.bookingActivityName,
			row.bookingStartTime,
			row.marketingConsent ? 'Yes' : 'No',
			...fieldOrder.map((fieldId) => answersById.get(fieldId) ?? '')
		];
	});

	return toCsv([...SUBMISSION_BASE_HEADERS, ...fieldHeaders], body);
}

export function buildCustomersCsv(rows: CustomerExportRow[]): string {
	return toCsv(
		['Customer ID', 'Name', 'Email', 'First seen (UTC)', 'Last seen (UTC)', 'Visits'],
		rows.map((row) => [
			row.customerId,
			row.displayName,
			row.primaryEmail,
			formatExportTimestamp(row.firstSeenAt),
			formatExportTimestamp(row.lastSeenAt),
			row.visitCount
		])
	);
}

type ExportPage<T> = { page: T[]; isDone: boolean; continueCursor: string };

/** Reads every page from a cursor-paginated query, in order. */
export async function collectAllPages<T>(
	fetchPage: (cursor: string | null) => Promise<ExportPage<T>>,
	onProgress?: (rowCount: number) => void,
	maxPages = 10_000
): Promise<T[]> {
	const rows: T[] = [];
	let cursor: string | null = null;
	for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
		const result = await fetchPage(cursor);
		rows.push(...result.page);
		onProgress?.(rows.length);
		if (result.isDone) return rows;
		cursor = result.continueCursor;
	}
	throw new Error('Export stopped: too many pages.');
}

export function exportFilename(workspaceSlug: string, kind: string, now = new Date()): string {
	const date = now.toISOString().slice(0, 10);
	return `${workspaceSlug}-${kind}-${date}.csv`;
}
