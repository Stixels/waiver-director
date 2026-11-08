import assert from 'node:assert/strict';
import test from 'node:test';
import {
	fareHarborDateRanges,
	fareHarborSyncSlot,
	orderFareHarborSyncSlots,
	fareHarborWebhookBooking,
	fareHarborWebhookEventType,
	normalizeFareHarborBooking,
	normalizeFareHarborDateTime,
	normalizeFareHarborShortname
} from '../src/convex/lib/fareharbor.ts';

const booking = {
	pk: 344488,
	uuid: '4509eb05-79cb-405d-8aba-e1d0edaef309',
	display_id: '#344488',
	status: 'booked',
	customer_count: 3,
	customers: [{ pk: 1 }, { pk: 2 }, { pk: 3 }],
	contact: { name: 'Riley Shore', email: ' Riley@Example.com ', phone: '2548558454' },
	availability: {
		pk: 35887201,
		start_at: '2022-08-18T12:00:00+1000',
		end_at: '2022-08-18T14:30:00+1000',
		item: { pk: 32439, name: 'Daily Cruise Tour' }
	}
};

test('normalizes a FareHarbor booking into the shared booking shape', () => {
	assert.deepEqual(normalizeFareHarborBooking(booking), {
		providerBookingId: '344488',
		status: 'active',
		activityName: 'Daily Cruise Tour',
		startTime: '2022-08-18T12:00:00+10:00',
		endTime: '2022-08-18T14:30:00+10:00',
		startAt: Date.parse('2022-08-18T02:00:00Z'),
		endAt: Date.parse('2022-08-18T04:30:00Z'),
		serviceDate: '2022-08-18',
		leadCustomerName: 'Riley Shore',
		leadCustomerEmail: 'riley@example.com',
		participantCount: 3
	});
});

test('treats cancelled and rebooked bookings as canceled', () => {
	assert.equal(normalizeFareHarborBooking({ ...booking, status: 'cancelled' })?.status, 'canceled');
	assert.equal(normalizeFareHarborBooking({ ...booking, status: 'rebooked' })?.status, 'canceled');
});

test('falls back to availability context, customers length, and display_id', () => {
	const normalized = normalizeFareHarborBooking(
		{ display_id: '#99', customers: [{}, {}], contact: { email: 'not-an-email' } },
		{ startAt: '2026-05-01T09:00:00-0700', itemName: 'Kayak Tour' }
	);
	assert.equal(normalized?.providerBookingId, '99');
	assert.equal(normalized?.activityName, 'Kayak Tour');
	assert.equal(normalized?.participantCount, 2);
	assert.equal(normalized?.serviceDate, '2026-05-01');
	assert.equal(normalized?.leadCustomerEmail, undefined);
});

test('ignores bookings without an identifier', () => {
	assert.equal(normalizeFareHarborBooking({ status: 'booked' }), null);
	assert.equal(normalizeFareHarborBooking(null), null);
});

test('reads webhook bodies with or without the booking wrapper', () => {
	assert.equal(fareHarborWebhookBooking({ booking }).pk, 344488);
	assert.equal(fareHarborWebhookBooking(booking).pk, 344488);
	assert.equal(fareHarborWebhookEventType({ status: 'cancelled' }), 'cancelled');
	assert.equal(fareHarborWebhookEventType({}), 'updated');
});

test('normalizes compact UTC offsets', () => {
	assert.equal(
		normalizeFareHarborDateTime('2022-08-18T12:00:00-0800'),
		'2022-08-18T12:00:00-08:00'
	);
	assert.equal(normalizeFareHarborDateTime('2022-08-18T12:00:00Z'), '2022-08-18T12:00:00Z');
	assert.equal(normalizeFareHarborDateTime(''), undefined);
});

test('validates company shortnames', () => {
	assert.equal(normalizeFareHarborShortname('  BayKayaks '), 'baykayaks');
	assert.equal(normalizeFareHarborShortname('bay-kayaks-1'), 'bay-kayaks-1');
	assert.equal(normalizeFareHarborShortname('bay/../kayaks'), null);
	assert.equal(normalizeFareHarborShortname(''), null);
});

test('splits sync windows into inclusive date ranges', () => {
	assert.deepEqual(
		fareHarborDateRanges(new Date('2026-01-01T15:00:00Z'), new Date('2026-02-05T01:00:00Z'), 31),
		[
			{ start: '2026-01-01', end: '2026-01-31' },
			{ start: '2026-02-01', end: '2026-02-05' }
		]
	);
	assert.deepEqual(fareHarborDateRanges(new Date('2026-01-01'), new Date('2026-01-01')), [
		{ start: '2026-01-01', end: '2026-01-01' }
	]);
});

test('orders sync slots by start time across items and resumes from the cursor', () => {
	const slot = (pk: number, startAt: string, itemName: string) =>
		fareHarborSyncSlot({ pk, start_at: startAt }, itemName)!;
	const slots = [
		slot(3, '2026-05-02T09:00:00-0700', 'Kayak'),
		slot(1, '2026-05-01T09:00:00-0700', 'Kayak'),
		slot(2, '2026-05-01T10:00:00-0700', 'Paddleboard'),
		slot(4, '2026-05-03T09:00:00-0700', 'Paddleboard')
	];
	assert.deepEqual(
		orderFareHarborSyncSlots(slots).map((s) => s.availabilityPk),
		['1', '2', '3', '4']
	);
	assert.deepEqual(
		orderFareHarborSyncSlots(slots, '2026-05-02T09:00:00-0700').map((s) => s.availabilityPk),
		['3', '4', '1', '2']
	);
	// A cursor past every slot (window moved on) starts from the beginning again.
	assert.deepEqual(
		orderFareHarborSyncSlots(slots, '2026-06-01T00:00:00Z').map((s) => s.availabilityPk),
		['1', '2', '3', '4']
	);
	assert.equal(fareHarborSyncSlot({ pk: 'abc' }, 'Kayak'), null);
});
