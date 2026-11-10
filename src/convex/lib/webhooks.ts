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

function isPrivateIPv4([a, b, c]: number[]): boolean {
	return (
		a === 0 || // "this" network
		a === 10 || // private
		a === 127 || // loopback
		(a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
		(a === 169 && b === 254) || // link-local / cloud metadata
		(a === 172 && b >= 16 && b <= 31) || // private
		(a === 192 && b === 0 && c === 0) || // IETF protocol assignments
		(a === 192 && b === 0 && c === 2) || // TEST-NET-1
		(a === 192 && b === 88 && c === 99) || // 6to4 relay anycast
		(a === 192 && b === 168) || // private
		(a === 198 && (b === 18 || b === 19)) || // benchmarking
		(a === 198 && b === 51 && c === 100) || // TEST-NET-2
		(a === 203 && b === 0 && c === 113) || // TEST-NET-3
		a >= 224 // multicast and reserved
	);
}

function parseIPv6(address: string): number[] | null {
	let value = address.toLowerCase().replace(/^\[|\]$/g, '');
	const zone = value.indexOf('%');
	if (zone !== -1) value = value.slice(0, zone);
	// Embedded IPv4 tail (e.g. ::ffff:10.0.0.1).
	const v4 = value.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
	if (v4) {
		const octets = parseIPv4(v4[2]);
		if (!octets) return null;
		value = `${v4[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
	}
	const halves = value.split('::');
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(':') : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
	const missing = 8 - head.length - tail.length;
	if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
	const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
	if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
	return groups.map((group) => parseInt(group, 16));
}

function isPrivateIPv6(groups: number[]): boolean {
	const [g0, g1, , , , g5, g6, g7] = groups;
	const allZeroPrefix = groups.slice(0, 5).every((group) => group === 0);
	if (allZeroPrefix && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true; // :: and ::1
	if (allZeroPrefix && (g5 === 0xffff || g5 === 0)) {
		// IPv4-mapped / IPv4-compatible
		return isPrivateIPv4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff]);
	}
	if (g0 === 0x64 && g1 === 0xff9b) return true; // NAT64
	if ((g0 & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
	if ((g0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
	if ((g0 & 0xff00) === 0xff00) return true; // multicast
	if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
	if (g0 === 0x2002) return true; // 6to4 can tunnel to private IPv4
	if (g0 === 0x2001 && g1 === 0) return true; // Teredo
	return false;
}

/**
 * True when a resolved IP address (v4 or v6) is loopback, private, link-local, or otherwise
 * not a public unicast address. Unparseable input is treated as private.
 */
export function isPrivateIpAddress(address: string): boolean {
	const v4 = parseIPv4(address);
	if (v4) return isPrivateIPv4(v4);
	const v6 = parseIPv6(address);
	if (v6) return isPrivateIPv6(v6);
	return true;
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

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const DNS_TYPE_A = 1;
const DNS_TYPE_AAAA = 28;

export type HostCheckResult = { ok: true; addresses: string[] } | { ok: false; message: string };

/**
 * Resolves a webhook hostname with DNS-over-HTTPS and rejects it if any A/AAAA record points at
 * a private or reserved address. Run right before each delivery so a DNS name such as
 * `10.0.0.5.nip.io`, or one re-pointed after it was saved, cannot reach internal services.
 * A small DNS-rebinding window between this lookup and the fetch's own lookup remains.
 */
export async function checkWebhookHostResolvesPublic(
	hostname: string,
	fetchImpl: typeof fetch = fetch
): Promise<HostCheckResult> {
	if (isBlockedWebhookHostname(hostname)) {
		return { ok: false, message: 'Webhook endpoints must be on a public hostname.' };
	}
	// Canonical public IPv4 literals were already validated above; nothing to resolve.
	if (parseIPv4(hostname)) return { ok: true, addresses: [hostname] };

	const addresses: string[] = [];
	for (const type of ['A', 'AAAA'] as const) {
		let body: { Status?: number; Answer?: Array<{ type?: number; data?: string }> };
		try {
			const response = await fetchImpl(
				`${DOH_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${type}`,
				{ headers: { Accept: 'application/dns-json' } }
			);
			if (!response.ok) throw new Error(`DNS lookup failed (${response.status})`);
			body = await response.json();
		} catch {
			return { ok: false, message: 'Could not resolve the endpoint hostname.' };
		}
		if (body.Status !== 0 && body.Status !== 3) {
			return { ok: false, message: 'Could not resolve the endpoint hostname.' };
		}
		for (const answer of body.Answer ?? []) {
			if ((answer.type === DNS_TYPE_A || answer.type === DNS_TYPE_AAAA) && answer.data) {
				addresses.push(answer.data.trim());
			}
		}
	}

	if (addresses.length === 0) {
		return { ok: false, message: 'The endpoint hostname does not resolve to an address.' };
	}
	if (addresses.some(isPrivateIpAddress)) {
		return { ok: false, message: 'The endpoint hostname resolves to a private address.' };
	}
	return { ok: true, addresses };
}
