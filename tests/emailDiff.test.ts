import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmailDiff, countDiffChanges, htmlToPlainText } from '../src/lib/domain/email-diff.ts';

test('converts sanitized email HTML into readable lines', () => {
	assert.equal(
		htmlToPlainText('<p>Hello &amp; welcome</p><ul><li>First</li><li>Second</li></ul>'),
		'Hello & welcome\n• First\n• Second'
	);
});

test('returns no additions or removals for identical emails', () => {
	const diff = buildEmailDiff({
		currentSubject: 'Reminder',
		currentBody: '<p>Please sign your waiver.</p>',
		proposedSubject: 'Reminder',
		proposedBody: '<p>Please sign your waiver.</p>'
	});

	assert.deepEqual(countDiffChanges(diff), { additions: 0, removals: 0 });
	assert.equal(diff.hunks.length, 0);
});

test('builds Pierre diff metadata for subject and body changes', () => {
	const diff = buildEmailDiff({
		currentSubject: 'Waiver reminder',
		currentBody: '<p>Please sign today.</p>',
		proposedSubject: 'Friendly waiver reminder',
		proposedBody: '<p>Please complete your waiver today.</p>'
	});
	const changes = countDiffChanges(diff);

	assert.equal(changes.additions, 2);
	assert.equal(changes.removals, 2);
	assert.ok(
		diff.hunks.some((hunk) => hunk.hunkContent.some((content) => content.type === 'change'))
	);
	assert.equal(diff.deletionLines[0]?.trimEnd(), 'Subject: Waiver reminder');
	assert.equal(diff.additionLines[0]?.trimEnd(), 'Subject: Friendly waiver reminder');
});
