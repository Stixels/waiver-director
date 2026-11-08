import assert from 'node:assert/strict';
import test from 'node:test';
import {
	KIOSK_LOOKAHEAD_MS,
	KIOSK_LOOKBACK_MS,
	isWithinKioskLookupWindow,
	kioskLeadFirstName,
	kioskServiceDateRange,
	parseKioskLookupQuery
} from '../src/lib/domain/kiosk.ts';

test('parses emails case-insensitively', () => {
	assert.deepEqual(parseKioskLookupQuery('  Guest@Example.COM '), {
		kind: 'email',
		value: 'guest@example.com'
	});
	assert.equal(parseKioskLookupQuery('not@an').kind, 'invalid');
});

test('parses booking numbers and rejects short or empty entries', () => {
	assert.deepEqual(parseKioskLookupQuery('#AB1234'), { kind: 'bookingNumber', value: 'AB1234' });
	assert.equal(parseKioskLookupQuery('12').kind, 'invalid');
	assert.equal(parseKioskLookupQuery('   ').kind, 'invalid');
	assert.equal(parseKioskLookupQuery('x'.repeat(121)).kind, 'invalid');
});

test('limits lookups to recently started and near-term bookings', () => {
	const now = Date.UTC(2026, 10, 8, 12);
	assert.equal(isWithinKioskLookupWindow(now, now), true);
	assert.equal(isWithinKioskLookupWindow(now - KIOSK_LOOKBACK_MS, now), true);
	assert.equal(isWithinKioskLookupWindow(now - KIOSK_LOOKBACK_MS - 1, now), false);
	assert.equal(isWithinKioskLookupWindow(now + KIOSK_LOOKAHEAD_MS, now), true);
	assert.equal(isWithinKioskLookupWindow(now + KIOSK_LOOKAHEAD_MS + 1, now), false);
	assert.equal(isWithinKioskLookupWindow(undefined, now), false);
});

test('service date range covers every timezone around the window', () => {
	const now = Date.UTC(2026, 10, 8, 1);
	assert.deepEqual(kioskServiceDateRange(now), { from: '2026-11-06', to: '2026-11-10' });
});

test('shows only the lead first name', () => {
	assert.equal(kioskLeadFirstName('  Dana   Smith '), 'Dana');
	assert.equal(kioskLeadFirstName(''), null);
	assert.equal(kioskLeadFirstName(undefined), null);
});
