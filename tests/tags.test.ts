import assert from 'node:assert/strict';
import test from 'node:test';
import {
	MAX_TAG_NAME_LENGTH,
	cleanTagName,
	matchesSearchText,
	normalizeTagName,
	sortTags,
	validateTagName
} from '../src/convex/lib/tags.ts';

test('cleanTagName trims and collapses whitespace', () => {
	assert.equal(cleanTagName('  Season   pass  '), 'Season pass');
});

test('normalizeTagName makes duplicate detection case-insensitive', () => {
	assert.equal(normalizeTagName(' VIP '), normalizeTagName('vip'));
	assert.equal(normalizeTagName('Birthday  Party'), 'birthday party');
});

test('validateTagName rejects empty and overlong names', () => {
	assert.throws(() => validateTagName('   '));
	assert.throws(() => validateTagName('x'.repeat(MAX_TAG_NAME_LENGTH + 1)));
	assert.equal(validateTagName(' Group  lead '), 'Group lead');
	assert.equal(validateTagName('x'.repeat(MAX_TAG_NAME_LENGTH)).length, MAX_TAG_NAME_LENGTH);
});

test('matchesSearchText requires every search term', () => {
	const text = 'Jordan Rivers Jordan@Example.com jordan@example.com';
	assert.equal(matchesSearchText(text, 'jordan'), true);
	assert.equal(matchesSearchText(text, 'rivers example'), true);
	assert.equal(matchesSearchText(text, 'JORDAN'), true);
	assert.equal(matchesSearchText(text, 'jordan smith'), false);
	assert.equal(matchesSearchText(text, '   '), true);
});

test('sortTags orders by name ignoring case', () => {
	const sorted = sortTags([
		{ tagId: 'b' as never, name: 'vip', color: 'amber' },
		{ tagId: 'a' as never, name: 'Allergy', color: 'red' },
		{ tagId: 'c' as never, name: 'birthday', color: 'pink' }
	]);
	assert.deepEqual(
		sorted.map((tag) => tag.name),
		['Allergy', 'birthday', 'vip']
	);
});
