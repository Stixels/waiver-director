import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildCustomersCsv,
	buildSubmissionsCsv,
	collectAllPages,
	escapeCsvCell,
	exportFilename,
	toCsv,
	type SubmissionExportRow
} from '../src/lib/domain/csv-export.ts';

test('quotes cells that contain commas, quotes, or newlines', () => {
	assert.equal(escapeCsvCell('plain'), 'plain');
	assert.equal(escapeCsvCell('a,b'), '"a,b"');
	assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
	assert.equal(escapeCsvCell('line\nbreak'), '"line\nbreak"');
	assert.equal(escapeCsvCell(null), '');
	assert.equal(escapeCsvCell(undefined), '');
	assert.equal(escapeCsvCell(3), '3');
});

test('neutralizes spreadsheet formulas in text cells', () => {
	assert.equal(escapeCsvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
	assert.equal(escapeCsvCell('+1 555'), "'+1 555");
	assert.equal(escapeCsvCell('-2'), "'-2");
	assert.equal(escapeCsvCell('@SUM(A1)'), "'@SUM(A1)");
	assert.equal(escapeCsvCell('\n=1+2'), `"'\n=1+2"`);
	assert.equal(escapeCsvCell(-2), '-2');
});

test('joins rows with CRLF and ends with a newline', () => {
	assert.equal(toCsv(['a', 'b'], [[1, 'x']]), 'a,b\r\n1,x\r\n');
});

function submission(overrides: Partial<SubmissionExportRow>): SubmissionExportRow {
	return {
		submissionId: 's1',
		submittedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
		signerName: 'Ana',
		signerEmail: 'ana@example.com',
		signerDateOfBirth: '1990-01-01',
		minors: [],
		waiverTitle: 'Waiver',
		waiverVersionNumber: 1,
		bookingProvider: null,
		providerBookingId: null,
		bookingActivityName: null,
		bookingStartTime: null,
		marketingConsent: false,
		answers: [],
		...overrides
	};
}

test('submissions CSV keys custom field columns by field id across versions', () => {
	const csv = buildSubmissionsCsv([
		submission({
			submissionId: 's1',
			minors: ['Kid One', 'Kid Two'],
			answers: [{ fieldId: 'f1', label: 'Referral', value: 'Google' }]
		}),
		submission({
			submissionId: 's2',
			waiverVersionNumber: 2,
			marketingConsent: true,
			bookingProvider: 'bookeo',
			providerBookingId: 'B-1',
			answers: [
				{ fieldId: 'f1', label: 'How did you hear about us?', value: 'Friend' },
				{ fieldId: 'f2', label: 'Referral', value: 'Yes' }
			]
		})
	]);
	const lines = csv.trimEnd().split('\r\n');
	const header = lines[0].split(',');
	assert.deepEqual(header.slice(-2), ['How did you hear about us?', 'Referral']);
	assert.ok(lines[1].startsWith('s1,2026-01-02T03:04:05.000Z,Ana,'));
	assert.ok(lines[1].includes('Kid One; Kid Two,2,'));
	assert.ok(lines[1].endsWith(',No,Google,'));
	assert.ok(lines[2].endsWith(',bookeo,B-1,,,Yes,Friend,Yes'));
});

test('submissions CSV disambiguates duplicate labels', () => {
	const csv = buildSubmissionsCsv([
		submission({
			answers: [
				{ fieldId: 'a', label: 'Notes', value: '1' },
				{ fieldId: 'b', label: 'Notes', value: '2' },
				{ fieldId: 'c', label: 'Signer name', value: '3' }
			]
		})
	]);
	const header = csv.split('\r\n')[0].split(',');
	assert.deepEqual(header.slice(-3), ['Notes', 'Notes (2)', 'Signer name (2)']);
});

test('submissions CSV never repeats a header, even against generated suffixes', () => {
	const csv = buildSubmissionsCsv([
		submission({
			answers: [
				{ fieldId: 'a', label: 'Notes', value: '1' },
				{ fieldId: 'b', label: 'Notes (2)', value: '2' },
				{ fieldId: 'c', label: 'Notes', value: '3' }
			]
		})
	]);
	const header = csv.split('\r\n')[0].split(',');
	assert.deepEqual(header.slice(-3), ['Notes', 'Notes (2)', 'Notes (3)']);
});

test('submissions CSV keeps headers unique after formula escaping', () => {
	const csv = buildSubmissionsCsv([
		submission({
			answers: [
				{ fieldId: 'a', label: '=Notes', value: '1' },
				{ fieldId: 'b', label: "'=Notes", value: '2' }
			]
		})
	]);
	const header = csv.split('\r\n')[0].split(',');
	assert.deepEqual(header.slice(-2), ["'=Notes", "'=Notes (2)"]);
});

test('customers CSV includes one row per customer', () => {
	const csv = buildCustomersCsv([
		{
			customerId: 'c1',
			displayName: 'Lee, Sam',
			primaryEmail: 'sam@example.com',
			firstSeenAt: 0,
			lastSeenAt: 0,
			visitCount: 4
		}
	]);
	assert.equal(
		csv,
		'Customer ID,Name,Email,First seen (UTC),Last seen (UTC),Visits\r\n' +
			'c1,"Lee, Sam",sam@example.com,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.000Z,4\r\n'
	);
});

test('collects every page in order', async () => {
	const pages: Record<string, { page: number[]; isDone: boolean; continueCursor: string }> = {
		start: { page: [1, 2], isDone: false, continueCursor: 'c1' },
		c1: { page: [3], isDone: true, continueCursor: 'end' }
	};
	const progress: number[] = [];
	const rows = await collectAllPages(
		async (cursor) => pages[cursor ?? 'start'],
		(count) => progress.push(count)
	);
	assert.deepEqual(rows, [1, 2, 3]);
	assert.deepEqual(progress, [2, 3]);
});

test('re-reads a SplitRequired page as two bounded halves', async () => {
	const calls: Array<[string | null, string | null]> = [];
	const rows = await collectAllPages<number>(async (cursor, endCursor) => {
		calls.push([cursor, endCursor]);
		if (cursor === null && endCursor === null) {
			// Possibly incomplete page: must be discarded, not kept.
			return {
				page: [1],
				isDone: false,
				continueCursor: 'c2',
				pageStatus: 'SplitRequired',
				splitCursor: 's1'
			};
		}
		if (cursor === null && endCursor === 's1') {
			return { page: [1, 2], isDone: false, continueCursor: 's1' };
		}
		if (cursor === 's1' && endCursor === null) {
			return { page: [3], isDone: true, continueCursor: 'end' };
		}
		throw new Error(`unexpected range ${cursor}..${endCursor}`);
	});
	assert.deepEqual(rows, [1, 2, 3]);
	assert.deepEqual(calls, [
		[null, null],
		[null, 's1'],
		['s1', null]
	]);
});

test('names export files by workspace, kind, and date', () => {
	assert.equal(
		exportFilename('atlas', 'customers', new Date(Date.UTC(2026, 10, 8))),
		'atlas-customers-2026-11-08.csv'
	);
});
