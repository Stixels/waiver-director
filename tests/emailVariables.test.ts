import assert from 'node:assert/strict';
import test from 'node:test';
import {
	formatFollowUpActivityDate,
	resolveTemplateVariables
} from '../src/lib/utils/email-variables.ts';

const vars = {
	signerName: 'Ada',
	bookingId: '#123',
	businessName: 'Rock Gym',
	activityDate: 'January 5, 2026'
};

test('resolves both single and double brace variables', () => {
	assert.equal(
		resolveTemplateVariables('Hi {{customer_name}} from {business_name} ({{booking_id}})', vars),
		'Hi Ada from Rock Gym (#123)'
	);
});

test('inserts dollar sequences in values literally', () => {
	const result = resolveTemplateVariables(
		'Thanks {{customer_name}}, see you at {{business_name}}!',
		{
			...vars,
			signerName: '$&$$',
			businessName: "A$'B$`C"
		}
	);
	assert.equal(result, "Thanks $&$$, see you at A$'B$`C!");
});

test('uses the venue-local date from an offset booking start time', () => {
	// 7pm in Los Angeles on Jan 5 is Jan 6 in UTC; the email must say Jan 5.
	assert.equal(formatFollowUpActivityDate('2026-01-05T19:00:00-08:00', 0), 'January 5, 2026');
	// 1am in Sydney on Jan 6 is Jan 5 in UTC.
	assert.equal(formatFollowUpActivityDate('2026-01-06T01:00:00+11:00', 0), 'January 6, 2026');
	assert.equal(formatFollowUpActivityDate('2026-03-09', 0), 'March 9, 2026');
});

test('falls back to the submission time when there is no booking start', () => {
	const submittedAt = Date.UTC(2026, 6, 4, 12);
	assert.equal(formatFollowUpActivityDate(undefined, submittedAt), 'July 4, 2026');
	assert.equal(formatFollowUpActivityDate('not a date', submittedAt), 'July 4, 2026');
});
