import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
	formatSignedAnswer,
	renderSignedWaiverPdf,
	signedRecordFingerprint,
	signedWaiverPdfFileName,
	toPdfSafeText,
	type SignedWaiverPdfInput
} from '../src/lib/domain/signed-waiver-pdf.ts';

// 1x1 transparent PNG.
const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function input(overrides: Partial<SignedWaiverPdfInput> = {}): SignedWaiverPdfInput {
	return {
		submissionId: 'sub_123',
		workspaceName: 'Summit Adventures',
		waiverTitle: 'Release of liability',
		versionNumber: 3,
		introText: 'I understand the risks.\n\nI agree to follow all safety instructions.',
		fields: [
			{ id: 'agree', type: 'checkbox', label: 'I accept the terms' },
			{
				id: 'level',
				type: 'select',
				label: 'Experience',
				options: [{ id: 'beg', label: 'Beginner' }]
			},
			{ id: 'notes', type: 'text', label: 'Medical notes' }
		],
		answers: { agree: true, level: 'beg', notes: '' },
		signerName: 'Zoë Ångström',
		signerEmail: 'zoe@example.com',
		signerDateOfBirth: '1990-04-02',
		minors: ['Kid One'],
		booking: { providerBookingId: '1024', activityName: 'Rafting', startTime: '2026-11-08T10:00' },
		marketingConsentLabel: null,
		marketingConsent: false,
		signatureDataUrl: PNG_DATA_URL,
		submittedAt: Date.UTC(2026, 10, 8, 12, 30, 0),
		fingerprint: 'a'.repeat(64),
		generatedAt: Date.UTC(2026, 10, 9, 0, 0, 0),
		...overrides
	};
}

test('renders a loadable PDF with metadata', async () => {
	const bytes = await renderSignedWaiverPdf(input());
	assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
	const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
	assert.ok(loaded.getPageCount() >= 1);
	assert.equal(loaded.getTitle(), 'Release of liability - Zoë Ångström');
	assert.equal(loaded.getProducer(), 'Waiver Director');
});

test('paginates long waiver text and tolerates characters outside WinAnsi', async () => {
	const introText = Array.from(
		{ length: 200 },
		(_, i) => `Clause ${i}: 安全第一 → keep calm.`
	).join('\n\n');
	const bytes = await renderSignedWaiverPdf(
		input({ introText, signatureDataUrl: 'data:image/svg+xml;base64,AAAA' })
	);
	const loaded = await PDFDocument.load(bytes);
	assert.ok(loaded.getPageCount() > 3);
});

test('maps unsupported characters for the built-in fonts', () => {
	assert.equal(toPdfSafeText('Zoë “quoted” – ok'), 'Zoë “quoted” – ok');
	assert.equal(toPdfSafeText('Łukasz ő 安'), 'Lukasz o ?');
});

test('formats answers by field type', () => {
	const select = {
		id: 's',
		type: 'select' as const,
		label: 'S',
		options: [{ id: 'a', label: 'Option A' }]
	};
	assert.equal(formatSignedAnswer(select, 'a'), 'Option A');
	assert.equal(formatSignedAnswer(select, null), 'No answer');
	assert.equal(
		formatSignedAnswer({ id: 'c', type: 'checkbox', label: 'C' }, true),
		'Yes (checked)'
	);
	assert.equal(
		formatSignedAnswer({ id: 'c', type: 'checkbox', label: 'C' }, null),
		'No (not checked)'
	);
	assert.equal(
		formatSignedAnswer({ id: 'd', type: 'date', label: 'D' }, '2026-01-02'),
		'2026-01-02'
	);
});

test('fingerprint is stable across answer key order and changes with content', async () => {
	const base = {
		submissionId: 's1',
		versionId: 'v1',
		signerName: 'A',
		signerEmail: 'a@example.com',
		signerDateOfBirth: '1990-01-01',
		answers: { b: true, a: 'x' },
		minors: [],
		signatureDataUrl: PNG_DATA_URL,
		submittedAt: 1
	};
	const first = await signedRecordFingerprint(base);
	const reordered = await signedRecordFingerprint({ ...base, answers: { a: 'x', b: true } });
	const changed = await signedRecordFingerprint({ ...base, signerName: 'B' });
	assert.match(first, /^[0-9a-f]{64}$/);
	assert.equal(first, reordered);
	assert.notEqual(first, changed);
});

test('builds a safe file name', () => {
	assert.equal(
		signedWaiverPdfFileName({ signerName: 'Zoë O’Brien / Jr.', submittedAt: Date.UTC(2026, 0, 5) }),
		'signed-waiver-zoe-o-brien-jr-2026-01-05.pdf'
	);
	assert.equal(
		signedWaiverPdfFileName({ signerName: '安', submittedAt: 0 }),
		'signed-waiver-signer-1970-01-01.pdf'
	);
});
