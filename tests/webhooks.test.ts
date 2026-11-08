import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
	API_KEY_PREFIX,
	WEBHOOK_MAX_ATTEMPTS,
	isBlockedWebhookHostname,
	looksLikeApiKey,
	normalizeWebhookUrl,
	parseBearerToken,
	parsePageLimit,
	randomToken,
	sha256Hex,
	signWebhookPayload,
	webhookRetryDelayMs,
	webhookSignatureHeaderValue
} from '../src/convex/lib/webhooks.ts';

test('accepts public https webhook URLs and strips fragments', () => {
	assert.deepEqual(normalizeWebhookUrl(' https://hooks.zapier.com/hooks/catch/1/abc#x '), {
		ok: true,
		url: 'https://hooks.zapier.com/hooks/catch/1/abc'
	});
	assert.equal(normalizeWebhookUrl('https://example.com:443/hook').ok, true);
	assert.equal(normalizeWebhookUrl('https://8.8.8.8/hook').ok, true);
});

test('rejects non-https, credentialed, custom-port and private webhook URLs', () => {
	for (const url of [
		'http://example.com/hook',
		'ftp://example.com',
		'not a url',
		'',
		'https://user:pass@example.com/hook',
		'https://example.com:8443/hook',
		'https://localhost/hook',
		'https://api.localhost/hook',
		'https://127.0.0.1/hook',
		'https://2130706433/hook',
		'https://0x7f.0.0.1/hook',
		'https://10.0.0.5/hook',
		'https://172.20.1.1/hook',
		'https://192.168.1.1/hook',
		'https://169.254.169.254/latest/meta-data',
		'https://100.64.0.1/hook',
		'https://[::1]/hook',
		'https://[fd00::1]/hook',
		'https://intranet/hook',
		'https://printer.local/hook',
		'https://metadata.google.internal/hook'
	]) {
		assert.equal(normalizeWebhookUrl(url).ok, false, url);
	}
});

test('hostname blocklist allows ordinary public names', () => {
	assert.equal(isBlockedWebhookHostname('hook.eu1.make.com'), false);
	assert.equal(isBlockedWebhookHostname('example.com.'), false);
	assert.equal(isBlockedWebhookHostname('172.32.0.1'), false);
});

test('signs `${timestamp}.${body}` with HMAC-SHA256 hex', async () => {
	const secret = 'whsec_test';
	const body = JSON.stringify({ id: 'evt_1' });
	const timestamp = 1_700_000_000;
	const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
	const signature = await signWebhookPayload({ secret, timestamp, body });
	assert.equal(signature, expected);
	assert.equal(webhookSignatureHeaderValue(timestamp, signature), `t=${timestamp},v1=${expected}`);
});

test('retries with backoff, then stops after the final attempt', () => {
	assert.equal(webhookRetryDelayMs(1), 60_000);
	assert.ok((webhookRetryDelayMs(2) ?? 0) > 60_000);
	assert.equal(webhookRetryDelayMs(WEBHOOK_MAX_ATTEMPTS - 1) !== null, true);
	assert.equal(webhookRetryDelayMs(WEBHOOK_MAX_ATTEMPTS), null);
	assert.equal(webhookRetryDelayMs(0), null);
});

test('generates prefixed, URL-safe API keys that pass the format check', async () => {
	const key = randomToken(API_KEY_PREFIX);
	assert.ok(key.startsWith(API_KEY_PREFIX));
	assert.match(key, /^[A-Za-z0-9_-]+$/);
	assert.notEqual(key, randomToken(API_KEY_PREFIX));
	assert.equal(looksLikeApiKey(key), true);
	assert.equal(looksLikeApiKey('sk_live_abc'), false);
	assert.equal((await sha256Hex(key)).length, 64);
});

test('parses bearer tokens and page limits', () => {
	assert.equal(parseBearerToken('Bearer wd_live_abc'), 'wd_live_abc');
	assert.equal(parseBearerToken('bearer  wd_live_abc '), 'wd_live_abc');
	assert.equal(parseBearerToken('Basic abc'), null);
	assert.equal(parseBearerToken(null), null);
	assert.equal(parsePageLimit(null), 25);
	assert.equal(parsePageLimit('100'), 100);
	assert.equal(parsePageLimit('0'), null);
	assert.equal(parsePageLimit('101'), null);
	assert.equal(parsePageLimit('5.5'), null);
});

test('classifies resolved IP addresses', async () => {
	const { isPrivateIpAddress } = await import('../src/convex/lib/webhooks.ts');
	for (const address of [
		'10.0.0.5',
		'127.0.0.1',
		'169.254.169.254',
		'192.0.0.8',
		'192.0.2.10',
		'198.51.100.7',
		'203.0.113.9',
		'0.0.0.0',
		'::',
		'::1',
		'fd00::1',
		'fe80::1',
		'::ffff:10.0.0.1',
		'::ffff:7f00:1',
		'64:ff9b::a00:1',
		'2001:db8::1',
		'garbage'
	]) {
		assert.equal(isPrivateIpAddress(address), true, address);
	}
	for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
		assert.equal(isPrivateIpAddress(address), false, address);
	}
});

function fakeDns(records: Record<string, Array<{ type: number; data: string }>>, status = 0) {
	return (async (input: string | URL | Request) => {
		const url = new URL(String(input));
		const type = url.searchParams.get('type') ?? 'A';
		return new Response(JSON.stringify({ Status: status, Answer: records[type] ?? [] }), {
			status: 200
		});
	}) as typeof fetch;
}

test('rejects hostnames whose DNS points at private addresses', async () => {
	const { checkWebhookHostResolvesPublic } = await import('../src/convex/lib/webhooks.ts');
	const privateA = await checkWebhookHostResolvesPublic(
		'10.0.0.5.nip.io',
		fakeDns({ A: [{ type: 1, data: '10.0.0.5' }] })
	);
	assert.equal(privateA.ok, false);

	const mixed = await checkWebhookHostResolvesPublic(
		'rebind.example.com',
		fakeDns({ A: [{ type: 1, data: '93.184.216.34' }], AAAA: [{ type: 28, data: '::1' }] })
	);
	assert.equal(mixed.ok, false);

	const none = await checkWebhookHostResolvesPublic('nothing.example.com', fakeDns({}, 3));
	assert.equal(none.ok, false);

	const failing = await checkWebhookHostResolvesPublic('x.example.com', (async () => {
		throw new Error('offline');
	}) as unknown as typeof fetch);
	assert.equal(failing.ok, false);

	const good = await checkWebhookHostResolvesPublic(
		'hooks.zapier.com',
		fakeDns({
			A: [
				{ type: 5, data: 'cname.example.' },
				{ type: 1, data: '54.1.2.3' }
			]
		})
	);
	assert.deepEqual(good, { ok: true, addresses: ['54.1.2.3'] });
});
