// Pure helpers for outbound webhooks and the public API. Kept free of Convex imports so they
// can be unit tested with `node --test`.

export const WEBHOOK_EVENT_TYPES = ['submission.created'] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
export const WEBHOOK_TEST_EVENT_TYPE = 'webhook.test';

export const WEBHOOK_SIGNATURE_HEADER = 'Waiver-Director-Signature';
export const WEBHOOK_EVENT_HEADER = 'Waiver-Director-Event';
export const WEBHOOK_DELIVERY_HEADER = 'Waiver-Director-Delivery';

export const WEBHOOK_SIGNING_SECRET_PREFIX = 'whsec_';
export const API_KEY_PREFIX = 'wd_live_';

export const WEBHOOK_URL_MAX_LENGTH = 2048;
export const WEBHOOK_DESCRIPTION_MAX_LENGTH = 200;
export const API_KEY_NAME_MAX_LENGTH = 80;

// Delay before retry N (1-indexed by the attempt that just failed). Six attempts in total.
const RETRY_DELAYS_MS = [
	60 * 1000,
	5 * 60 * 1000,
	30 * 60 * 1000,
	2 * 60 * 60 * 1000,
	8 * 60 * 60 * 1000
];
export const WEBHOOK_MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export function webhookRetryDelayMs(failedAttempt: number): number | null {
	if (failedAttempt < 1 || failedAttempt >= WEBHOOK_MAX_ATTEMPTS) return null;
	return RETRY_DELAYS_MS[failedAttempt - 1] ?? null;
}

export function isWebhookEventType(value: string): value is WebhookEventType {
	return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}

function parseIPv4(hostname: string): number[] | null {
	const parts = hostname.split('.');
	if (parts.length !== 4) return null;
	const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
	if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
	return octets;
}

function isPrivateIPv4([a, b]: number[]): boolean {
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		a >= 224
	);
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/** Rejects hosts that point at loopback, link-local, or private networks. */
export function isBlockedWebhookHostname(rawHostname: string): boolean {
	const hostname = rawHostname.toLowerCase().replace(/\.$/, '');
	if (!hostname || hostname === 'localhost') return true;
	if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;
	// IPv6 literals (URL.hostname keeps the brackets). Endpoints should use a DNS name.
	if (hostname.startsWith('[') || hostname.includes(':')) return true;
	// Hostnames with no dot (e.g. "intranet") are never public.
	if (!hostname.includes('.')) return true;
	// Purely numeric hostnames are IPv4 in some shorthand form; only allow canonical public ones.
	if (/^[\d.]+$/.test(hostname) || /^0x/i.test(hostname)) {
		const octets = parseIPv4(hostname);
		return !octets || isPrivateIPv4(octets);
	}
	return false;
}

export type WebhookUrlResult = { ok: true; url: string } | { ok: false; message: string };

export function normalizeWebhookUrl(raw: string): WebhookUrlResult {
	const value = raw.trim();
	if (!value) return { ok: false, message: 'Enter an endpoint URL.' };
	if (value.length > WEBHOOK_URL_MAX_LENGTH) {
		return { ok: false, message: 'Endpoint URL is too long.' };
	}

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return { ok: false, message: 'Enter a valid URL, starting with https://.' };
	}

	if (url.protocol !== 'https:') {
		return { ok: false, message: 'Webhook endpoints must use https://.' };
	}
	if (url.username || url.password) {
		return { ok: false, message: 'Endpoint URLs cannot contain a username or password.' };
	}
	if (url.port && url.port !== '443') {
		return { ok: false, message: 'Webhook endpoints must use the default HTTPS port.' };
	}
	if (isBlockedWebhookHostname(url.hostname)) {
		return { ok: false, message: 'Webhook endpoints must be on a public hostname.' };
	}

	url.hash = '';
	return { ok: true, url: url.toString() };
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	return [...view].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function randomToken(prefix: string, byteLength = 32): string {
	return `${prefix}${bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)))}`;
}

export async function sha256Hex(value: string): Promise<string> {
	return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/**
 * Signs `${timestamp}.${body}` with HMAC-SHA256. Receivers recompute this with their signing
 * secret and compare it to the `v1` value of the signature header.
 */
export async function signWebhookPayload(input: {
	secret: string;
	timestamp: number;
	body: string;
}): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(input.secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		new TextEncoder().encode(`${input.timestamp}.${input.body}`)
	);
	return bytesToHex(signature);
}

export function webhookSignatureHeaderValue(timestamp: number, signature: string): string {
	return `t=${timestamp},v1=${signature}`;
}

export function parseBearerToken(header: string | null): string | null {
	if (!header) return null;
	const match = header.match(/^Bearer\s+(\S+)\s*$/i);
	return match?.[1] ?? null;
}

export function looksLikeApiKey(value: string): boolean {
	return value.startsWith(API_KEY_PREFIX) && /^[A-Za-z0-9_-]{20,128}$/.test(value);
}

export function secretHint(secret: string): string {
	return secret.slice(-4);
}

export function parsePageLimit(raw: string | null, fallback = 25, max = 100): number | null {
	if (raw === null || raw === '') return fallback;
	if (!/^\d+$/.test(raw)) return null;
	const value = Number(raw);
	if (value < 1 || value > max) return null;
	return value;
}
