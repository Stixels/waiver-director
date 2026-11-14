import assert from 'node:assert/strict';
import test from 'node:test';
import {
	DAY_MS,
	customerActivityByDay,
	dayCount,
	dayIndexFor,
	isValidDayBoundaries,
	resolveDayBoundaries
} from '../src/convex/lib/dayBuckets.ts';

const HOUR_MS = 60 * 60 * 1000;

// Local midnights in America/Los_Angeles around the Nov 1, 2026 fall-back change:
// Oct 31 00:00 PDT (UTC-7), Nov 1 00:00 PDT, Nov 2 00:00 PST (UTC-8), Nov 3 00:00 PST.
const oct31 = Date.UTC(2026, 9, 31, 7);
const nov1 = Date.UTC(2026, 10, 1, 7);
const nov2 = Date.UTC(2026, 10, 2, 8);
const nov3 = Date.UTC(2026, 10, 3, 8);
const dstBoundaries = [oct31, nov1, nov2, nov3];

test('accepts client boundaries that include a 25-hour day', () => {
	assert.equal(isValidDayBoundaries(oct31, nov3, dstBoundaries), true);
	assert.deepEqual(resolveDayBoundaries(oct31, nov3, dstBoundaries), dstBoundaries);
});

test('buckets late-evening events into the right local day across DST', () => {
	const boundaries = resolveDayBoundaries(oct31, nov3, dstBoundaries);
	// 11:30pm PST on Nov 1 belongs to Nov 1, even though it is 24.5h after Nov 1 00:00 PDT.
	assert.equal(dayIndexFor(boundaries, nov2 - 30 * 60 * 1000), 1);
	assert.equal(dayIndexFor(boundaries, nov2), 2);
	assert.equal(dayIndexFor(boundaries, oct31), 0);
	assert.equal(dayIndexFor(boundaries, nov3 - 1), 2);
	assert.equal(dayIndexFor(boundaries, nov3), -1);
	assert.equal(dayIndexFor(boundaries, oct31 - 1), -1);
});

test('rejects boundaries that do not match the range or are not days', () => {
	assert.equal(isValidDayBoundaries(oct31, nov3, [oct31, nov3]), false);
	assert.equal(isValidDayBoundaries(oct31, nov3, [nov1, nov2, nov3]), false);
	assert.equal(isValidDayBoundaries(oct31, oct31 + HOUR_MS, [oct31, oct31 + HOUR_MS]), false);
});

test('falls back to 24h steps that end exactly at the range end', () => {
	// A 30-day range that crosses DST is 30 days plus an hour.
	const start = Date.UTC(2026, 9, 10, 7);
	const end = start + 30 * DAY_MS + HOUR_MS;
	const boundaries = resolveDayBoundaries(start, end, [start, end]);
	assert.equal(dayCount(boundaries), 30);
	assert.equal(boundaries[0], start);
	assert.equal(boundaries[boundaries.length - 1], end);
	assert.equal(dayIndexFor(boundaries, end - 1), 29);
});

test('fallback keeps the most recent days exact across spring-forward', () => {
	// 14 local days in America/Los_Angeles ending Mar 15, 2026. Mar 8 is 23 hours long.
	const start = Date.UTC(2026, 2, 1, 8);
	const todayStart = Date.UTC(2026, 2, 14, 7);
	const end = Date.UTC(2026, 2, 15, 7);
	const boundaries = resolveDayBoundaries(start, end);
	assert.equal(dayCount(boundaries), 14);
	assert.equal(boundaries[0], start);
	assert.equal(boundaries[13], todayStart);
	assert.equal(dayIndexFor(boundaries, todayStart), 13);
	assert.equal(dayIndexFor(boundaries, start), 0);
});

test('splits customers into new and returning per day', () => {
	const firstSeenAt = new Map([
		['new-nov1', nov1 + HOUR_MS],
		['new-oct31', oct31 + HOUR_MS],
		['seen-later', nov2 + HOUR_MS]
	]);
	const activity = customerActivityByDay(
		dstBoundaries,
		[
			{ customerId: 'new-nov1', submittedAt: nov1 + HOUR_MS },
			// A second signature on the same day counts the customer once.
			{ customerId: 'new-nov1', submittedAt: nov1 + 2 * HOUR_MS },
			{ customerId: 'new-oct31', submittedAt: nov1 + HOUR_MS },
			// Not in the map: first seen before the loaded window.
			{ customerId: 'long-time', submittedAt: nov1 + HOUR_MS },
			// First seen after the day they are listed under: not counted.
			{ customerId: 'seen-later', submittedAt: nov1 + HOUR_MS },
			{ submittedAt: nov1 + HOUR_MS },
			{ customerId: 'new-oct31', submittedAt: nov3 }
		],
		firstSeenAt
	);
	assert.deepEqual(activity, [
		{ newCustomers: 0, returningCustomers: 0 },
		{ newCustomers: 1, returningCustomers: 2 },
		{ newCustomers: 0, returningCustomers: 0 }
	]);
});
