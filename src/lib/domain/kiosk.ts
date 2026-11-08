/**
 * Shared kiosk rules for the public kiosk entry (see docs/adr/0001-public-kiosk-entry.md).
 * Used by both the Convex lookup and the kiosk page so the window and timers stay in sync.
 */

/** Bookings that started up to this long ago can still be found at the kiosk. */
export const KIOSK_LOOKBACK_MS = 3 * 60 * 60 * 1000;
/** Bookings starting up to this far ahead can be found at the kiosk. */
export const KIOSK_LOOKAHEAD_MS = 36 * 60 * 60 * 1000;
/** Maximum lookup results shown on the kiosk. */
export const KIOSK_MAX_RESULTS = 5;

export const KIOSK_MIN_BOOKING_NUMBER_LENGTH = 3;
export const KIOSK_MAX_QUERY_LENGTH = 120;

/** Per-device lookup cap. Each kiosk device has its own budget, so one device can't starve another. */
export const KIOSK_DEVICE_LOOKUP_LIMIT = 30;
export const KIOSK_DEVICE_LOOKUP_WINDOW_MS = 5 * 60 * 1000;
/** Workspace-wide backstop across all of a workspace's kiosk devices. */
export const KIOSK_WORKSPACE_LOOKUP_LIMIT = 600;
export const KIOSK_WORKSPACE_LOOKUP_WINDOW_MS = 5 * 60 * 1000;

/** Query parameter that carries a kiosk device token the first time a kiosk opens. */
export const KIOSK_DEVICE_PARAM = 'device';

export function kioskDeviceStorageKey(slug: string) {
	return `waiver-director:kiosk-device:${slug}`;
}
/** Per-identifier cap so one email or booking number cannot be probed repeatedly. */
export const KIOSK_IDENTIFIER_LOOKUP_LIMIT = 6;
export const KIOSK_IDENTIFIER_LOOKUP_WINDOW_MS = 10 * 60 * 1000;

/** Return to the start screen after this much inactivity on any non-start screen. */
export const KIOSK_IDLE_TIMEOUT_MS = 90 * 1000;
/** Show the "Still there?" warning this long before the idle reset. */
export const KIOSK_IDLE_WARNING_MS = 15 * 1000;
/** Return to the start screen this long after a successful submission. */
export const KIOSK_SUBMITTED_RESET_MS = 10 * 1000;

export type KioskLookupQuery =
	| { kind: 'email'; value: string }
	| { kind: 'bookingNumber'; value: string }
	| { kind: 'invalid'; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseKioskLookupQuery(raw: string): KioskLookupQuery {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return { kind: 'invalid', message: 'Enter your booking number or email.' };
	}
	if (trimmed.length > KIOSK_MAX_QUERY_LENGTH) {
		return { kind: 'invalid', message: 'That entry is too long.' };
	}
	if (trimmed.includes('@')) {
		const email = trimmed.toLowerCase();
		return EMAIL_PATTERN.test(email)
			? { kind: 'email', value: email }
			: { kind: 'invalid', message: 'Enter a valid email address.' };
	}

	const bookingNumber = trimmed.replace(/^#/, '').trim();
	if (bookingNumber.length < KIOSK_MIN_BOOKING_NUMBER_LENGTH) {
		return { kind: 'invalid', message: 'Enter your full booking number.' };
	}
	return { kind: 'bookingNumber', value: bookingNumber };
}

export function isWithinKioskLookupWindow(startAt: number | undefined, now: number): boolean {
	if (typeof startAt !== 'number' || !Number.isFinite(startAt)) return false;
	return startAt >= now - KIOSK_LOOKBACK_MS && startAt <= now + KIOSK_LOOKAHEAD_MS;
}

/** Only the lead's first name is shown so a lookup never reveals a full customer identity. */
export function kioskLeadFirstName(leadCustomerName: string | undefined | null): string | null {
	const first = leadCustomerName?.trim().split(/\s+/)[0] ?? '';
	return first.length > 0 ? first : null;
}

/** UTC calendar dates that can contain a booking inside the lookup window (any timezone). */
export function kioskServiceDateRange(now: number): { from: string; to: string } {
	const dayMs = 24 * 60 * 60 * 1000;
	const toDate = (value: number) => new Date(value).toISOString().slice(0, 10);
	return {
		from: toDate(now - KIOSK_LOOKBACK_MS - dayMs),
		to: toDate(now + KIOSK_LOOKAHEAD_MS + dayMs)
	};
}
