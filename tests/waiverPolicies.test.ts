import assert from 'node:assert/strict';
import test from 'node:test';
import {
	DAY_MS,
	HOUR_MS,
	REUSE_LOOKUP_MAX_FAILURES,
	REUSE_LOOKUP_WINDOW_MS,
	bookingNeedsGuestReminder,
	formatBookingWallClock,
	isRetryableEmailError,
	reminderRetryDelayMs,
	reuseCoveredCount,
	reuseExpiredForStart,
	reuseValidityCheckAt,
	nextReuseLookupAttempts,
	normalizeReminderLeadHours,
	normalizeValidityDays,
	reuseLookupAllowed,
	submissionReuseEligibility,
	waiverExpiresAt
} from '../src/convex/lib/waiverPolicies.ts';
import { buildGuestReminderEmail } from '../src/convex/lib/guestReminderEmail.ts';

const now = Date.UTC(2026, 10, 8, 12);
const policy = { reuseEnabled: true, validityDays: 365, resignOnNewVersion: true };

test('waiver expiry follows the configured validity window', () => {
	assert.equal(waiverExpiresAt(policy, now), now + 365 * DAY_MS);
	assert.equal(waiverExpiresAt({ validityDays: null }, now), null);
});

test('a recent signature on the current version can be reused', () => {
	const result = submissionReuseEligibility({
		policy,
		submission: { submittedAt: now - 10 * DAY_MS, versionId: 'v2' },
		publishedVersionId: 'v2',
		now
	});
	assert.deepEqual(result, { eligible: true, expiresAt: now + 355 * DAY_MS });
});

test('reuse is refused when disabled, expired, or on an older version', () => {
	const base = { submission: { submittedAt: now - DAY_MS, versionId: 'v1' }, now };
	assert.deepEqual(
		submissionReuseEligibility({
			...base,
			policy: { ...policy, reuseEnabled: false },
			publishedVersionId: 'v1'
		}),
		{ eligible: false, reason: 'disabled' }
	);
	assert.deepEqual(submissionReuseEligibility({ ...base, policy, publishedVersionId: 'v2' }), {
		eligible: false,
		reason: 'new_version'
	});
	assert.deepEqual(
		submissionReuseEligibility({
			policy: { ...policy, validityDays: 30 },
			submission: { submittedAt: now - 30 * DAY_MS, versionId: 'v1' },
			publishedVersionId: 'v1',
			now
		}),
		{ eligible: false, reason: 'expired' }
	);
});

test('older versions stay valid when the workspace does not require re-signing', () => {
	const result = submissionReuseEligibility({
		policy: { reuseEnabled: true, validityDays: null, resignOnNewVersion: false },
		submission: { submittedAt: now - 900 * DAY_MS, versionId: 'v1' },
		publishedVersionId: 'v3',
		now
	});
	assert.deepEqual(result, { eligible: true, expiresAt: null });
});

test('validates policy inputs', () => {
	assert.equal(normalizeValidityDays(null), null);
	assert.equal(normalizeValidityDays(30), 30);
	assert.throws(() => normalizeValidityDays(0));
	assert.throws(() => normalizeValidityDays(1.5));
	assert.equal(normalizeReminderLeadHours(24), 24);
	assert.throws(() => normalizeReminderLeadHours(0));
	assert.throws(() => normalizeReminderLeadHours(200));
});

test('limits failed waiver lookups per booking window', () => {
	let attempts: { windowStartedAt: number; failedCount: number } | null = null;
	for (let i = 0; i < REUSE_LOOKUP_MAX_FAILURES; i++) {
		assert.equal(reuseLookupAllowed(attempts, now), true);
		attempts = nextReuseLookupAttempts(attempts, now);
	}
	assert.equal(reuseLookupAllowed(attempts, now), false);
	assert.equal(reuseLookupAllowed(attempts, now + REUSE_LOOKUP_WINDOW_MS), true);
	assert.deepEqual(nextReuseLookupAttempts(attempts, now + REUSE_LOOKUP_WINDOW_MS), {
		windowStartedAt: now + REUSE_LOOKUP_WINDOW_MS,
		failedCount: 1
	});
});

test('reminds only active, incomplete bookings inside the lead window', () => {
	const booking = {
		status: 'active' as const,
		startAt: now + 12 * HOUR_MS,
		participantCount: 4,
		signedCount: 1,
		leadCustomerEmail: 'lead@example.com'
	};
	assert.equal(bookingNeedsGuestReminder({ booking, leadHours: 24, now }), true);
	assert.equal(bookingNeedsGuestReminder({ booking, leadHours: 6, now }), false);
	assert.equal(
		bookingNeedsGuestReminder({ booking: { ...booking, signedCount: 4 }, leadHours: 24, now }),
		false
	);
	assert.equal(
		bookingNeedsGuestReminder({ booking: { ...booking, status: 'canceled' }, leadHours: 24, now }),
		false
	);
	assert.equal(
		bookingNeedsGuestReminder({
			booking: { ...booking, leadCustomerEmail: undefined },
			leadHours: 24,
			now
		}),
		false
	);
	assert.equal(
		bookingNeedsGuestReminder({ booking: { ...booking, startAt: now - 1 }, leadHours: 24, now }),
		false
	);
});

test('formats booking times in the venue wall clock', () => {
	assert.equal(formatBookingWallClock('2026-11-09T18:30:00-05:00'), 'November 9, 2026 at 6:30 PM');
	assert.equal(formatBookingWallClock('2026-11-09T00:05:00Z'), 'November 9, 2026 at 12:05 AM');
	assert.equal(formatBookingWallClock('2026-11-09'), 'November 9, 2026');
	assert.equal(formatBookingWallClock('not a date'), null);
	assert.equal(formatBookingWallClock(undefined), null);
});

test('builds an escaped reminder email', () => {
	const email = buildGuestReminderEmail({
		workspaceName: 'Atlas <VR>',
		leadCustomerName: 'Sam',
		activityName: 'Escape Room',
		when: 'November 9, 2026 at 6:30 PM',
		signedCount: 3,
		participantCount: 4,
		signingUrl: 'https://app.example.com/w/atlas/b/tok?x="1"',
		returningGuestsCanSkip: true
	});
	assert.equal(email.subject, 'Reminder: 1 guest still needs to sign the waiver for Escape Room');
	assert.match(email.html, /Atlas &lt;VR&gt;/);
	assert.match(email.html, /href="https:\/\/app\.example\.com\/w\/atlas\/b\/tok\?x=&quot;1&quot;"/);
	assert.doesNotMatch(email.html, /<VR>/);
	assert.match(email.text, /3 of 4 guests have signed/);
	assert.match(email.text, /confirm it instead of signing again/);
});

test('retries rate limits, server errors and network failures, not permanent errors', () => {
	assert.equal(isRetryableEmailError({ statusCode: 429, name: 'rate_limit_exceeded' }), true);
	assert.equal(isRetryableEmailError({ statusCode: 500, name: 'internal_server_error' }), true);
	assert.equal(isRetryableEmailError({ statusCode: 503 }), true);
	assert.equal(isRetryableEmailError({ statusCode: null }), true);
	assert.equal(isRetryableEmailError(null), true);
	assert.equal(isRetryableEmailError({ statusCode: 422, name: 'validation_error' }), false);
	assert.equal(isRetryableEmailError({ statusCode: 403, name: 'invalid_from_address' }), false);
});

test('backs off exponentially with a cap', () => {
	assert.equal(reminderRetryDelayMs(1, 0), 30_000);
	assert.equal(reminderRetryDelayMs(2, 0), 60_000);
	assert.equal(reminderRetryDelayMs(4, 0), 240_000);
	assert.equal(reminderRetryDelayMs(20, 0), 30 * 60 * 1000);
	assert.equal(reminderRetryDelayMs(1, 1), 35_000);
});

test('checks reuse validity at the booking start, not just at claim time', () => {
	const startAt = now + 7 * DAY_MS;
	assert.equal(reuseValidityCheckAt({ startAt }, now), startAt);
	assert.equal(reuseValidityCheckAt({ startAt: now - DAY_MS }, now), now);
	assert.equal(reuseValidityCheckAt({}, now), now);
	// Signed 363 days ago with a 365-day policy: valid today, expired by next week's booking.
	const result = submissionReuseEligibility({
		policy,
		submission: { submittedAt: now - 363 * DAY_MS, versionId: 'v1' },
		publishedVersionId: 'v1',
		now: reuseValidityCheckAt({ startAt }, now)
	});
	assert.deepEqual(result, { eligible: false, reason: 'expired' });
});

test('releases reuses that expire before a rescheduled start', () => {
	assert.equal(reuseCoveredCount({ minorNames: ['Maya', 'Leo'] }), 3);
	assert.equal(reuseCoveredCount({}), 1);
	assert.equal(reuseExpiredForStart({ coveredUntil: now + DAY_MS }, now + 2 * DAY_MS), true);
	assert.equal(reuseExpiredForStart({ coveredUntil: now + 3 * DAY_MS }, now + 2 * DAY_MS), false);
	assert.equal(reuseExpiredForStart({}, now + 2 * DAY_MS), false);
	assert.equal(reuseExpiredForStart({ coveredUntil: now }, undefined), false);
});
