import assert from 'node:assert/strict';
import test from 'node:test';
import {
	canonicalJson,
	clientIpFromHeaders,
	normalizeUserAgent,
	sanitizeClientTimestamp,
	sha256Hex,
	waiverDocumentHash,
	waiverSubmissionHash
} from '../src/convex/lib/audit.ts';
import { isMinorBirthDate, minorBirthDateBounds } from '../src/lib/domain/waiver-constraints.ts';

function headers(values: Record<string, string>) {
	return new Headers(values);
}

test('canonical JSON is independent of key order and drops undefined', () => {
	assert.equal(
		canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } }),
		'{"a":{"d":[1,{"y":2,"z":1}]},"b":1}'
	);
	assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }));
});

test('sha256Hex matches a known vector', async () => {
	assert.equal(
		await sha256Hex('abc'),
		'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
	);
});

test('document hash changes when waiver content changes', async () => {
	const base = { versionId: 'v1', title: 'Waiver', introCopy: '<p>Risk</p>', fields: [] };
	const same = await waiverDocumentHash({ ...base });
	assert.equal(await waiverDocumentHash(base), same);
	assert.notEqual(await waiverDocumentHash({ ...base, introCopy: '<p>Risks</p>' }), same);
	assert.notEqual(await waiverDocumentHash({ ...base, versionId: 'v2' }), same);
});

test('submission hash covers signer data, minors and signature', async () => {
	const base = {
		documentHash: 'doc',
		signerName: 'Ada Lovelace',
		signerEmail: 'ada@example.com',
		signerDateOfBirth: '1990-01-01',
		signatureDataUrl: 'data:image/png;base64,AAA',
		answers: { f1: true },
		minors: [{ fullName: 'Byron', dateOfBirth: '2015-05-05' }],
		consentText: 'I agree',
		submittedAt: 1
	};
	const hash = await waiverSubmissionHash(base);
	assert.match(hash, /^[0-9a-f]{64}$/);
	assert.notEqual(
		await waiverSubmissionHash({ ...base, signatureDataUrl: 'data:image/png;base64,AAB' }),
		hash
	);
	assert.notEqual(
		await waiverSubmissionHash({
			...base,
			minors: [{ fullName: 'Byron', dateOfBirth: '2016-05-05' }]
		}),
		hash
	);
});

test('client IP uses only the last forwarded hop and ignores x-real-ip', () => {
	assert.equal(clientIpFromHeaders(headers({ 'x-real-ip': '203.0.113.9' })), null);
	assert.equal(
		clientIpFromHeaders(
			headers({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '10.0.0.1, 198.51.100.7 ' })
		),
		'198.51.100.7'
	);
	assert.equal(clientIpFromHeaders(headers({})), null);
});

test('user agent is trimmed, truncated and null when empty', () => {
	assert.equal(normalizeUserAgent('  '), null);
	assert.equal(normalizeUserAgent(null), null);
	assert.equal(normalizeUserAgent('x'.repeat(600))?.length, 512);
});

test('client timestamps outside a plausible window are dropped', () => {
	const now = 1_700_000_000_000;
	assert.equal(sanitizeClientTimestamp(now - 60_000, now), now - 60_000);
	assert.equal(sanitizeClientTimestamp(now + 60 * 60 * 1000, now), null);
	assert.equal(sanitizeClientTimestamp(now - 2 * 24 * 60 * 60 * 1000, now), null);
	assert.equal(sanitizeClientTimestamp(Number.NaN, now), null);
	assert.equal(sanitizeClientTimestamp(undefined, now), null);
});

test('minor birth dates must be under 18 on the signing day and not before 1900', () => {
	const today = '2026-11-08';
	assert.deepEqual(minorBirthDateBounds(today), { min: '2008-11-09', max: '2026-11-08' });
	assert.equal(isMinorBirthDate('2015-06-03', today), true);
	assert.equal(isMinorBirthDate('2008-11-09', today), true);
	assert.equal(isMinorBirthDate('2008-11-08', today), false, 'turns 18 today');
	assert.equal(isMinorBirthDate('1975-01-01', today), false);
	assert.equal(isMinorBirthDate('2026-11-09', today), false, 'future');
	assert.equal(isMinorBirthDate('2015-02-30', today), false, 'invalid date');
	assert.equal(minorBirthDateBounds('1910-03-01').min, '1900-01-01');
	// Leap-day birthdays: born 2008-02-29 is still a minor on 2026-02-28.
	assert.equal(isMinorBirthDate('2008-02-29', '2026-02-28'), true);
	assert.equal(isMinorBirthDate('2008-02-29', '2026-03-01'), false);
});
