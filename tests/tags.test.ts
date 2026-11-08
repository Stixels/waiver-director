import assert from 'node:assert/strict';
import test from 'node:test';
import {
	MAX_TAG_NAME_LENGTH,
	cleanTagName,
	collectTaggedMatches,
	matchesSearchText,
	normalizeTagName,
	parseTagScanCursor,
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

test('collectTaggedMatches keeps scanning past non-matching batches', async () => {
	// 250 assignments, newest first; only the 160th newest matches.
	const rows = Array.from({ length: 250 }, (_, index) => ({ _creationTime: 1000 - index, index }));
	const loadBatch = async (before: number | null, limit: number) =>
		rows.filter((row) => before === null || row._creationTime < before).slice(0, limit);
	const resolve = async (row: { index: number }) => (row.index === 159 ? row.index : null);

	const first = await collectTaggedMatches({ pageSize: 20, cursor: null, loadBatch, resolve });
	assert.deepEqual(first.items, [159]);
	assert.equal(first.isDone, true);

	const limited = await collectTaggedMatches({
		pageSize: 20,
		cursor: null,
		loadBatch,
		resolve,
		scanLimit: 100
	});
	assert.deepEqual(limited.items, []);
	assert.equal(limited.isDone, false);
	const resumed = await collectTaggedMatches({
		pageSize: 20,
		cursor: limited.continueCursor,
		loadBatch,
		resolve,
		scanLimit: 100
	});
	assert.deepEqual(resumed.items, [159]);
});

test('collectTaggedMatches pages through full results without gaps or repeats', async () => {
	const rows = Array.from({ length: 45 }, (_, index) => ({ _creationTime: 500 - index, index }));
	const loadBatch = async (before: number | null, limit: number) =>
		rows.filter((row) => before === null || row._creationTime < before).slice(0, limit);
	const resolve = async (row: { index: number }) => row.index;

	const seen: number[] = [];
	let cursor: string | null = null;
	for (let page = 0; page < 5; page += 1) {
		const result: { items: number[]; continueCursor: string; isDone: boolean } =
			await collectTaggedMatches({ pageSize: 20, cursor, loadBatch, resolve });
		seen.push(...result.items);
		if (result.isDone) break;
		cursor = result.continueCursor;
	}
	assert.deepEqual(
		seen,
		rows.map((row) => row.index)
	);
	assert.equal(parseTagScanCursor('not-a-tag-cursor'), null);
});
