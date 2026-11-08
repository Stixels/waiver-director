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

test('client IP prefers x-real-ip, then the last forwarded hop', () => {
	assert.equal(clientIpFromHeaders(headers({ 'x-real-ip': '203.0.113.9' })), '203.0.113.9');
	assert.equal(
		clientIpFromHeaders(headers({ 'x-forwarded-for': '10.0.0.1, 198.51.100.7 ' })),
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
