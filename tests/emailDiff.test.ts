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
	const lines = buildEmailDiff({
		currentSubject: 'Reminder',
		currentBody: '<p>Please sign your waiver.</p>',
		proposedSubject: 'Reminder',
		proposedBody: '<p>Please sign your waiver.</p>'
	});

	assert.deepEqual(countDiffChanges(lines), { additions: 0, removals: 0 });
	assert.ok(lines.every((line) => line.type === 'same'));
});

test('highlights subject and body changes at line and word level', () => {
	const lines = buildEmailDiff({
		currentSubject: 'Waiver reminder',
		currentBody: '<p>Please sign today.</p>',
		proposedSubject: 'Friendly waiver reminder',
		proposedBody: '<p>Please complete your waiver today.</p>'
	});
	const changes = countDiffChanges(lines);

	assert.equal(changes.additions, 2);
	assert.equal(changes.removals, 2);
	assert.ok(lines.some((line) => line.segments.some((segment) => segment.type === 'add')));
	assert.ok(lines.some((line) => line.segments.some((segment) => segment.type === 'remove')));
});
