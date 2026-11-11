import assert from 'node:assert/strict';
import test from 'node:test';
import {
	isPlausibleKioskLocalDate,
	kioskLeadFirstName,
	kioskLocalDate,
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

test('formats the kiosk device local date', () => {
	assert.equal(kioskLocalDate(new Date(2026, 10, 8, 23, 59)), '2026-11-08');
	assert.equal(kioskLocalDate(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('accepts only a date that is "today" in some timezone', () => {
	const now = Date.UTC(2026, 10, 8, 1); // 01:00 UTC: still Nov 7 in the Americas
	assert.equal(isPlausibleKioskLocalDate('2026-11-07', now), true);
	assert.equal(isPlausibleKioskLocalDate('2026-11-08', now), true);
	assert.equal(isPlausibleKioskLocalDate('2026-11-06', now), false);
	assert.equal(isPlausibleKioskLocalDate('2026-11-09', now), false);
	assert.equal(isPlausibleKioskLocalDate('11/08/2026', now), false);
});

test('shows only the lead first name', () => {
	assert.equal(kioskLeadFirstName('  Dana   Smith '), 'Dana');
	assert.equal(kioskLeadFirstName(''), null);
	assert.equal(kioskLeadFirstName(undefined), null);
});
