/**
 * Pure helpers for the front-desk check-in roster. Kept free of Convex runtime
 * imports so they can be unit tested with `node --test`.
 */

export type RosterPersonKind = 'signer' | 'minor';

export type RosterSubmissionInput<SubmissionId extends string = string> = {
	_id: SubmissionId;
	signerName: string;
	minors: Array<{ fullName: string }>;
};

export type RosterPerson<SubmissionId extends string = string> = {
	submissionId: SubmissionId;
	participantIndex: number;
	name: string;
	kind: RosterPersonKind;
	checkedInAt: number | null;
};

export type RosterGroupTotalsInput = {
	status: 'active' | 'canceled';
	participantCount: number;
	people: Array<{ checkedInAt: number | null }>;
};

export type RosterTotals = {
	expected: number;
	signed: number;
	arrived: number;
	unsigned: number;
};

/**
 * Participant index 0 is the adult signer and 1..n are the submission's minors
 * in their signed order.
 */
export function isValidParticipantIndex(participantIndex: number, minorCount: number) {
	return (
		Number.isInteger(participantIndex) && participantIndex >= 0 && participantIndex <= minorCount
	);
}

export function rosterPeopleForSubmission<SubmissionId extends string>(
	submission: RosterSubmissionInput<SubmissionId>,
	checkedInAtByIndex: ReadonlyMap<number, number>
): RosterPerson<SubmissionId>[] {
	return [
		{
			submissionId: submission._id,
			participantIndex: 0,
			name: submission.signerName,
			kind: 'signer' as const,
			checkedInAt: checkedInAtByIndex.get(0) ?? null
		},
		...submission.minors.map((minor, minorIndex) => ({
			submissionId: submission._id,
			participantIndex: minorIndex + 1,
			name: minor.fullName,
			kind: 'minor' as const,
			checkedInAt: checkedInAtByIndex.get(minorIndex + 1) ?? null
		}))
	];
}

export type SubmissionRosterSummary = {
	signerName: string;
	minorNames: string[];
};

/** The names a signed submission covers, as stored in `submission_rosters`. */
export function rosterSummaryFromSubmission(submission: {
	signerName: string;
	minors: Array<{ fullName: string }>;
}): SubmissionRosterSummary {
	return {
		signerName: submission.signerName,
		minorNames: submission.minors.map((minor) => minor.fullName)
	};
}

export function rosterInputFromSummary<SubmissionId extends string>(row: {
	submissionId: SubmissionId;
	signerName: string;
	minorNames: string[];
}): RosterSubmissionInput<SubmissionId> {
	return {
		_id: row.submissionId,
		signerName: row.signerName,
		minors: row.minorNames.map((fullName) => ({ fullName }))
	};
}

export function unsignedParticipantCount(participantCount: number, signedPeople: number) {
	return Math.max(0, participantCount - signedPeople);
}

/**
 * Day totals for the check-in view. Canceled bookings do not count toward
 * expected or unsigned participants, but anyone who already signed or arrived
 * on them still counts as signed or arrived. Walk-ins are expected by virtue of
 * having signed.
 */
export function computeRosterTotals(
	bookings: RosterGroupTotalsInput[],
	walkInPeople: Array<{ checkedInAt: number | null }>
): RosterTotals {
	const totals: RosterTotals = { expected: 0, signed: 0, arrived: 0, unsigned: 0 };

	for (const booking of bookings) {
		const signedPeople = booking.people.length;
		totals.signed += signedPeople;
		totals.arrived += booking.people.filter((person) => person.checkedInAt !== null).length;
		if (booking.status === 'canceled') continue;
		totals.expected += Math.max(booking.participantCount, signedPeople);
		totals.unsigned += unsignedParticipantCount(booking.participantCount, signedPeople);
	}

	totals.expected += walkInPeople.length;
	totals.signed += walkInPeople.length;
	totals.arrived += walkInPeople.filter((person) => person.checkedInAt !== null).length;

	return totals;
}
