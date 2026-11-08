import { ConvexError } from 'convex/values';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export const MAX_WAIVER_VALIDITY_DAYS = 3650;
export const DEFAULT_GUEST_REMINDER_LEAD_HOURS = 24;
export const MIN_GUEST_REMINDER_LEAD_HOURS = 1;
export const MAX_GUEST_REMINDER_LEAD_HOURS = 168;

/** Failed "already signed" lookups allowed per booking link inside one window. */
export const REUSE_LOOKUP_MAX_FAILURES = 10;
export const REUSE_LOOKUP_WINDOW_MS = HOUR_MS;

export type WaiverReusePolicy = {
	/** When false, every visit needs a fresh signature (the original behavior). */
	reuseEnabled: boolean;
	/** Days a signed waiver stays valid. `null` means no time limit. */
	validityDays: number | null;
	/** When true, publishing a new waiver version invalidates older signatures. */
	resignOnNewVersion: boolean;
};

export type GuestReminderPolicy = {
	enabled: boolean;
	leadHours: number;
};

export const DEFAULT_WAIVER_REUSE_POLICY: WaiverReusePolicy = {
	reuseEnabled: false,
	validityDays: 365,
	resignOnNewVersion: true
};

export const DEFAULT_GUEST_REMINDER_POLICY: GuestReminderPolicy = {
	enabled: false,
	leadHours: DEFAULT_GUEST_REMINDER_LEAD_HOURS
};

export function normalizeValidityDays(value: number | null): number | null {
	if (value === null) return null;
	if (!Number.isInteger(value) || value < 1 || value > MAX_WAIVER_VALIDITY_DAYS) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Waiver validity must be a whole number of days between 1 and ${MAX_WAIVER_VALIDITY_DAYS}.`
		});
	}
	return value;
}

export function normalizeReminderLeadHours(value: number): number {
	if (
		!Number.isInteger(value) ||
		value < MIN_GUEST_REMINDER_LEAD_HOURS ||
		value > MAX_GUEST_REMINDER_LEAD_HOURS
	) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Send reminders between ${MIN_GUEST_REMINDER_LEAD_HOURS} and ${MAX_GUEST_REMINDER_LEAD_HOURS} hours before the booking.`
		});
	}
	return value;
}

/** When a signature made at `submittedAt` stops covering new visits, or null if it never expires by time. */
export function waiverExpiresAt(
	policy: Pick<WaiverReusePolicy, 'validityDays'>,
	submittedAt: number
): number | null {
	if (policy.validityDays === null) return null;
	return submittedAt + policy.validityDays * DAY_MS;
}

export type ReuseEligibility =
	| { eligible: true; expiresAt: number | null }
	| { eligible: false; reason: 'disabled' | 'expired' | 'new_version' };

/**
 * Decides whether an existing signed submission may stand in for a new signature.
 * Signed submissions are never modified; this only decides whether one still counts.
 */
export function submissionReuseEligibility(args: {
	policy: WaiverReusePolicy;
	submission: { submittedAt: number; versionId: string };
	publishedVersionId: string;
	now: number;
}): ReuseEligibility {
	const { policy, submission, publishedVersionId, now } = args;
	if (!policy.reuseEnabled) return { eligible: false, reason: 'disabled' };
	if (policy.resignOnNewVersion && submission.versionId !== publishedVersionId) {
		return { eligible: false, reason: 'new_version' };
	}
	const expiresAt = waiverExpiresAt(policy, submission.submittedAt);
	if (expiresAt !== null && expiresAt <= now) return { eligible: false, reason: 'expired' };
	return { eligible: true, expiresAt };
}

/** Whether another "already signed" lookup is allowed for this booking link right now. */
export function reuseLookupAllowed(
	attempts: { windowStartedAt: number; failedCount: number } | null,
	now: number
): boolean {
	if (!attempts) return true;
	if (now - attempts.windowStartedAt >= REUSE_LOOKUP_WINDOW_MS) return true;
	return attempts.failedCount < REUSE_LOOKUP_MAX_FAILURES;
}

export function nextReuseLookupAttempts(
	attempts: { windowStartedAt: number; failedCount: number } | null,
	now: number
): { windowStartedAt: number; failedCount: number } {
	if (!attempts || now - attempts.windowStartedAt >= REUSE_LOOKUP_WINDOW_MS) {
		return { windowStartedAt: now, failedCount: 1 };
	}
	return { windowStartedAt: attempts.windowStartedAt, failedCount: attempts.failedCount + 1 };
}

/**
 * A booking should get a guest reminder when it is active, still missing signatures,
 * has a lead customer email, and starts inside the reminder window.
 */
export function bookingNeedsGuestReminder(args: {
	booking: {
		status: 'active' | 'canceled';
		startAt?: number;
		participantCount: number;
		signedCount: number;
		leadCustomerEmail?: string;
	};
	leadHours: number;
	now: number;
}): boolean {
	const { booking, leadHours, now } = args;
	if (booking.status !== 'active') return false;
	if (!booking.leadCustomerEmail) return false;
	if (booking.signedCount >= booking.participantCount) return false;
	if (typeof booking.startAt !== 'number') return false;
	return booking.startAt > now && booking.startAt <= now + leadHours * HOUR_MS;
}

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/**
 * Formats a provider booking start time using its own wall-clock date and time, so the
 * email shows the venue's local time rather than the server's time zone.
 */
export function formatBookingWallClock(startTime: string | undefined): string | null {
	const match = startTime?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
	if (!match) return null;
	const [, year, month, day, hour, minute] = match;
	const monthName = MONTHS[Number(month) - 1];
	if (!monthName) return null;
	const date = `${monthName} ${Number(day)}, ${year}`;
	if (hour === undefined || minute === undefined) return date;
	const hourNumber = Number(hour);
	const suffix = hourNumber >= 12 ? 'PM' : 'AM';
	const displayHour = hourNumber % 12 === 0 ? 12 : hourNumber % 12;
	return `${date} at ${displayHour}:${minute} ${suffix}`;
}
