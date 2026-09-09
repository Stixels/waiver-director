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

test('bounds large dissimilar email diffs with a whole-document replacement', () => {
	const currentLines = Array.from({ length: 600 }, (_, index) => `Current line ${index}`);
	const proposedLines = Array.from({ length: 600 }, (_, index) => `Proposed line ${index}`);
	const diff = buildEmailDiff({
		currentSubject: 'Current subject',
		currentBody: currentLines.join('<br>'),
		proposedSubject: 'Proposed subject',
		proposedBody: proposedLines.join('<br>')
	});

	assert.deepEqual(countDiffChanges(diff), { additions: 602, removals: 602 });
	assert.equal(diff.additionLines.length, 602);
	assert.equal(diff.deletionLines.length, 602);
});

test('shows destination-only link changes with unchanged visible text', () => {
	const diff = buildEmailDiff({
		currentSubject: 'Reminder',
		proposedSubject: 'Reminder',
		currentBody: '<p><a href="https://example.com/waiver">Sign your waiver</a></p>',
		proposedBody: '<p><a href="https://example.com/other">Sign your waiver</a></p>'
	});
	assert.deepEqual(countDiffChanges(diff), { additions: 1, removals: 1 });
	assert.ok(diff.deletionLines.some((line) => line.includes('https://example.com/waiver')));
	assert.ok(diff.additionLines.some((line) => line.includes('https://example.com/other')));
});

test('normalizes equivalent link markup and decodes URL entities', () => {
	const diff = buildEmailDiff({
		currentSubject: 'Reminder',
		proposedSubject: 'Reminder',
		currentBody: '<a href="https://example.com/?a=1&amp;b=2"><strong>Sign</strong></a>',
		proposedBody: "<a href='https://example.com/?a=1&#38;b=2'>Sign</a>"
	});
	assert.deepEqual(countDiffChanges(diff), { additions: 0, removals: 0 });
});

test('shows removed links even when their text remains', () => {
	const diff = buildEmailDiff({
		currentSubject: 'Reminder',
		proposedSubject: 'Reminder',
		currentBody: '<a href="https://example.com/waiver">Sign</a>',
		proposedBody: '<p>Sign</p>'
	});
	assert.ok(countDiffChanges(diff).removals > 0);
	assert.ok(diff.deletionLines.some((line) => line.includes('https://example.com/waiver')));
});

test('bounds large nearly identical emails while preserving identical-email results', () => {
	const lines = Array.from({ length: 600 }, (_, index) => `Line ${index}`);
	const body = lines.join('<br>');
	const input = {
		currentSubject: 'Reminder',
		proposedSubject: 'Reminder',
		currentBody: body,
		proposedBody: body
	};
	assert.deepEqual(countDiffChanges(buildEmailDiff(input)), { additions: 0, removals: 0 });
	lines[300] = 'Updated line';
	const diff = buildEmailDiff({ ...input, proposedBody: lines.join('<br>') });
	assert.deepEqual(countDiffChanges(diff), { additions: 602, removals: 602 });
	assert.ok(diff.additionLines.some((line) => line.includes('Updated line')));
});
