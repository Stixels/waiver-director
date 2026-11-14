import { ConvexError } from 'convex/values';

// Shared credential helpers for booking provider integrations.

export function requiredEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: `Missing Convex environment variable: ${name}.`
		});
	}
	return value;
}

export function convexSiteUrl(): string {
	return process.env.CONVEX_SITE_URL?.trim() || process.env.PUBLIC_CONVEX_SITE_URL?.trim() || '';
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

export function bytesToHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptionKey(): Promise<CryptoKey> {
	const secret = requiredEnv('BOOKING_CREDENTIALS_ENCRYPTION_KEY');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
	return await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(value: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		await encryptionKey(),
		new TextEncoder().encode(value)
	);

	return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(value: string): Promise<string> {
	const [ivBase64, ciphertextBase64] = value.split('.');
	if (!ivBase64 || !ciphertextBase64) {
		throw new ConvexError({
			code: 'invalid_state',
			message: 'Stored booking credential is invalid.'
		});
	}

	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: base64ToBytes(ivBase64) as unknown as BufferSource },
		await encryptionKey(),
		base64ToBytes(ciphertextBase64) as unknown as BufferSource
	);
	return new TextDecoder().decode(decrypted);
}

export function token(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let index = 0; index < a.length; index += 1) {
		diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}
	return diff === 0;
}
