import { ConvexError } from 'convex/values';

// AES-GCM encryption for workspace-owned integration secrets (webhook signing secrets).
// Reuses the deployment's existing credential encryption key, with a purpose-specific
// derivation so ciphertext from one purpose can never be decrypted as another.
const ENCRYPTION_KEY_ENV = 'BOOKING_CREDENTIALS_ENCRYPTION_KEY';

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

async function purposeKey(purpose: string): Promise<CryptoKey> {
	const secret = process.env[ENCRYPTION_KEY_ENV]?.trim();
	if (!secret) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: `${ENCRYPTION_KEY_ENV} is required to store integration secrets.`
		});
	}
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`waiver-director:${purpose}:v1:${secret}`)
	);
	return await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptPurposeSecret(purpose: string, value: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		await purposeKey(purpose),
		new TextEncoder().encode(value)
	);
	return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptPurposeSecret(purpose: string, value: string): Promise<string> {
	const [ivBase64, ciphertextBase64] = value.split('.');
	if (!ivBase64 || !ciphertextBase64) {
		throw new ConvexError({ code: 'invalid_state', message: 'Stored secret is invalid.' });
	}
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: base64ToBytes(ivBase64) as unknown as BufferSource },
		await purposeKey(purpose),
		base64ToBytes(ciphertextBase64) as unknown as BufferSource
	);
	return new TextDecoder().decode(decrypted);
}
