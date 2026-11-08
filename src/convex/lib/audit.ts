/**
 * Signature audit trail helpers.
 *
 * These are pure functions (no Convex imports) so they can be unit tested with
 * `node --test`. They run inside the default Convex runtime, which provides
 * Web Crypto (`crypto.subtle`).
 */

export const ELECTRONIC_SIGNATURE_CONSENT_TEXT =
	'I agree to sign this waiver electronically. I understand my electronic signature is legally binding, the same as a handwritten signature.';

export const AUDIT_HASH_ALGORITHM = 'SHA-256' as const;

const MAX_USER_AGENT_LENGTH = 512;
const MAX_IP_LENGTH = 64;
const MAX_FORWARDED_FOR_LENGTH = 512;
/** Allowed clock skew for client-reported timestamps that land after the server time. */
const MAX_CLIENT_FUTURE_SKEW_MS = 5 * 60 * 1000;
/** Client-reported timestamps older than this before submission are discarded. */
const MAX_CLIENT_TIMESTAMP_AGE_MS = 24 * 60 * 60 * 1000;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Deterministic JSON: object keys sorted, `undefined` properties dropped.
 * Two structurally equal values always produce the same string.
 */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(toCanonical(value));
}

function toCanonical(value: unknown): JsonValue {
	if (value === null || value === undefined) return null;
	if (Array.isArray(value)) return value.map((item) => toCanonical(item));
	if (typeof value === 'object') {
		const result: { [key: string]: JsonValue } = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			const item = (value as Record<string, unknown>)[key];
			if (item === undefined) continue;
			result[key] = toCanonical(item);
		}
		return result;
	}
	if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
		return value;
	}
	return String(value);
}

export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type AuditDocumentInput = {
	versionId: string;
	title: string;
	introCopy: string;
	fields: unknown[];
};

/** Hash of exactly what the signer was shown: the published waiver version content. */
export async function waiverDocumentHash(document: AuditDocumentInput): Promise<string> {
	return await sha256Hex(
		canonicalJson({
			versionId: document.versionId,
			title: document.title,
			introCopy: document.introCopy,
			fields: document.fields
		})
	);
}

export type AuditSubmissionInput = {
	documentHash: string;
	signerName: string;
	signerEmail: string;
	signerDateOfBirth: string;
	signatureDataUrl: string;
	answers: Record<string, string | boolean | null>;
	minors: Array<{ fullName: string; dateOfBirth?: string }>;
	consentText: string;
	submittedAt: number;
};

/** Tamper-evidence hash over the signed record. Recompute and compare to verify. */
export async function waiverSubmissionHash(submission: AuditSubmissionInput): Promise<string> {
	return await sha256Hex(canonicalJson(submission));
}

function truncate(value: string, maxLength: number) {
	return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function normalizeUserAgent(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? truncate(trimmed, MAX_USER_AGENT_LENGTH) : null;
}

export function normalizeForwardedFor(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? truncate(trimmed, MAX_FORWARDED_FOR_LENGTH) : null;
}

/**
 * Best-effort client IP from request headers: the last `x-forwarded-for` hop,
 * which is the address appended by the nearest proxy. Earlier hops, and headers
 * such as `x-real-ip`, can be set by the client and are ignored.
 *
 * Convex does not document whether its HTTP edge sets or overwrites
 * `x-forwarded-for`, so this value is stored and shown as reported by request
 * headers, not as independently verified. The raw chain is stored separately.
 */
export function clientIpFromHeaders(headers: { get(name: string): string | null }): string | null {
	const forwardedFor = headers.get('x-forwarded-for');
	if (!forwardedFor) return null;
	const last = forwardedFor
		.split(',')
		.map((hop) => hop.trim())
		.filter(Boolean)
		.at(-1);
	return last ? truncate(last, MAX_IP_LENGTH) : null;
}

/**
 * Accept a client-reported timestamp only when it is plausible relative to the
 * server time: not meaningfully in the future and not older than a day.
 */
export function sanitizeClientTimestamp(
	value: number | null | undefined,
	serverNow: number
): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	if (value > serverNow + MAX_CLIENT_FUTURE_SKEW_MS) return null;
	if (value < serverNow - MAX_CLIENT_TIMESTAMP_AGE_MS) return null;
	return Math.round(value);
}
