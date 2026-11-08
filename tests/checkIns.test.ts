import assert from 'node:assert/strict';
import test from 'node:test';
import {
	rosterInputFromSummary,
	rosterSummaryFromSubmission,
	computeRosterTotals,
	isValidParticipantIndex,
	rosterPeopleForSubmission,
	unsignedParticipantCount
} from '../src/convex/lib/checkIns.ts';

test('validates participant indexes against the signer and minors', () => {
	assert.equal(isValidParticipantIndex(0, 0), true);
	assert.equal(isValidParticipantIndex(2, 2), true);
	assert.equal(isValidParticipantIndex(3, 2), false);
	assert.equal(isValidParticipantIndex(-1, 2), false);
	assert.equal(isValidParticipantIndex(1.5, 2), false);
	assert.equal(isValidParticipantIndex(Number.NaN, 2), false);
});

test('builds roster rows for the signer and minors in order', () => {
	const people = rosterPeopleForSubmission(
		{
			_id: 'sub1',
			signerName: 'Ada Parent',
			minors: [{ fullName: 'Kid One' }, { fullName: 'Kid Two' }]
		},
		new Map([[2, 5_000]])
	);

	assert.deepEqual(
		people.map((person) => [person.participantIndex, person.name, person.kind, person.checkedInAt]),
		[
			[0, 'Ada Parent', 'signer', null],
			[1, 'Kid One', 'minor', null],
			[2, 'Kid Two', 'minor', 5_000]
		]
	);
});

test('never reports a negative unsigned count', () => {
	assert.equal(unsignedParticipantCount(4, 1), 3);
	assert.equal(unsignedParticipantCount(2, 5), 0);
});

test('computes day totals and excludes canceled bookings from expected and unsigned', () => {
	const totals = computeRosterTotals(
		[
			{
				status: 'active',
				participantCount: 4,
				people: [{ checkedInAt: 1 }, { checkedInAt: null }]
			},
			{
				status: 'active',
				participantCount: 1,
				people: [{ checkedInAt: null }, { checkedInAt: 2 }]
			},
			{ status: 'canceled', participantCount: 6, people: [{ checkedInAt: null }] }
		],
		[{ checkedInAt: 3 }, { checkedInAt: null }]
	);

	assert.deepEqual(totals, {
		expected: 4 + 2 + 2,
		signed: 2 + 2 + 1 + 2,
		arrived: 1 + 1 + 1,
		unsigned: 2
	});
});

test('roster summaries round-trip to the same roster people', () => {
	const submission = {
		_id: 'sub1',
		signerName: 'Dana Smith',
		minors: [{ fullName: 'Ava Smith' }, { fullName: 'Leo Smith' }]
	};
	const summary = rosterSummaryFromSubmission(submission);
	assert.deepEqual(summary, { signerName: 'Dana Smith', minorNames: ['Ava Smith', 'Leo Smith'] });
	assert.deepEqual(
		rosterPeopleForSubmission(
			rosterInputFromSummary({ submissionId: 'sub1', ...summary }),
			new Map([[2, 99]])
		),
		rosterPeopleForSubmission(submission, new Map([[2, 99]]))
	);
});
