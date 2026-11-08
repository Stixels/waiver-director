import { v } from 'convex/values';

/**
 * Owner-controlled photo capture at signing. Each capture kind can be turned
 * off, offered as optional, or required before a signer can submit.
 */
export const PHOTO_CAPTURE_MODES = ['off', 'optional', 'required'] as const;
export type PhotoCaptureMode = (typeof PHOTO_CAPTURE_MODES)[number];

export const PHOTO_CAPTURE_KINDS = ['participant', 'id'] as const;
export type PhotoCaptureKind = (typeof PHOTO_CAPTURE_KINDS)[number];

export const photoCaptureModeValidator = v.union(
	v.literal('off'),
	v.literal('optional'),
	v.literal('required')
);
export const photoCaptureKindValidator = v.union(v.literal('participant'), v.literal('id'));
export const photoCaptureSettingsValidator = v.object({
	participantPhoto: photoCaptureModeValidator,
	idPhoto: photoCaptureModeValidator
});

export type PhotoCaptureSettings = {
	participantPhoto: PhotoCaptureMode;
	idPhoto: PhotoCaptureMode;
};

export const PHOTO_UPLOAD_ALLOWED_CONTENT_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp'
]);
export const PHOTO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
/** How long an uploaded photo waits for its submission before it is pruned. */
export const PHOTO_UPLOAD_TTL_MS = 60 * 60 * 1000;
/** How long a reserved upload may take to reach storage before it is pruned. */
export const PHOTO_UPLOAD_RESERVATION_TTL_MS = 5 * 60 * 1000;
export const PHOTO_UPLOAD_RATE_WINDOW_MS = 10 * 60 * 1000;
/** Uploads one client (hashed IP) may make to one waiver per window. */
export const PHOTO_UPLOAD_CLIENT_RATE_LIMIT = 20;
/** Safety cap on uploads to one waiver per window, across all clients. */
export const PHOTO_UPLOAD_WAIVER_RATE_LIMIT = 1000;
/** How long a staff member's photo view link works. */
export const PHOTO_VIEW_TOKEN_TTL_MS = 10 * 60 * 1000;

export function photoCaptureSettings(workspace: {
	participantPhotoCapture?: PhotoCaptureMode;
	idPhotoCapture?: PhotoCaptureMode;
}): PhotoCaptureSettings {
	return {
		participantPhoto: workspace.participantPhotoCapture ?? 'off',
		idPhoto: workspace.idPhotoCapture ?? 'off'
	};
}

export function photoCaptureModeForKind(
	settings: PhotoCaptureSettings,
	kind: PhotoCaptureKind
): PhotoCaptureMode {
	return kind === 'participant' ? settings.participantPhoto : settings.idPhoto;
}

export function photoCaptureKindLabel(kind: PhotoCaptureKind): string {
	return kind === 'participant' ? 'participant photo' : 'photo ID';
}

/** Returns an error message when a declared upload is not an acceptable photo. */
export function photoUploadRequestError(contentType: string | null, size: number | null) {
	const baseType = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
	if (!PHOTO_UPLOAD_ALLOWED_CONTENT_TYPES.has(baseType)) {
		return 'Photos must be JPEG, PNG, or WebP images.';
	}
	if (size !== null && size > PHOTO_UPLOAD_MAX_BYTES) {
		return 'Photos must be 5MB or smaller.';
	}
	if (size !== null && size <= 0) {
		return 'Uploaded photo is empty. Please try again.';
	}
	return null;
}

/**
 * Picks the client address for rate limiting from X-Forwarded-For. Uses the
 * last entry, the one added by the proxy in front of Convex, because earlier
 * entries can be set by the caller.
 */
export function clientAddressFromForwardedFor(header: string | null): string | null {
	if (!header) return null;
	const parts = header
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	return parts.at(-1) ?? null;
}

/** Returns an error message when the uploaded file is not an acceptable photo. */
export function photoUploadMetadataError(
	metadata: { contentType?: string; size: number } | null
): string | null {
	if (!metadata) {
		return 'Uploaded photo not found. Please try again.';
	}
	if (!metadata.contentType || !PHOTO_UPLOAD_ALLOWED_CONTENT_TYPES.has(metadata.contentType)) {
		return 'Photos must be JPEG, PNG, or WebP images.';
	}
	if (metadata.size <= 0) {
		return 'Uploaded photo is empty. Please try again.';
	}
	if (metadata.size > PHOTO_UPLOAD_MAX_BYTES) {
		return 'Photos must be 5MB or smaller.';
	}
	return null;
}

/**
 * Checks that a submission supplies exactly the photos the workspace allows,
 * and every photo it requires. Returns an error message or null.
 */
export function photoSubmissionError(
	settings: PhotoCaptureSettings,
	provided: { participant: boolean; id: boolean }
): string | null {
	for (const kind of PHOTO_CAPTURE_KINDS) {
		const mode = photoCaptureModeForKind(settings, kind);
		if (mode === 'required' && !provided[kind]) {
			return `A ${photoCaptureKindLabel(kind)} is required to sign this waiver.`;
		}
		if (mode === 'off' && provided[kind]) {
			return `This waiver does not accept a ${photoCaptureKindLabel(kind)}. Reload and try again.`;
		}
	}
	return null;
}
