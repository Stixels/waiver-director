import assert from 'node:assert/strict';
import test from 'node:test';
import {
	normalizeActivityKey,
	pickDefaultWaiver,
	resolveRequiredWaiverIds,
	waiverSlugBase,
	waiverSlugCandidate
} from '../src/convex/lib/waiverRequirements.ts';

test('legacy workspaces fall back to their oldest active waiver as default', () => {
	const waivers = [
		{ _id: 'b', _creationTime: 20 },
		{ _id: 'a', _creationTime: 10 },
		{ _id: 'c', _creationTime: 5, status: 'archived' as const }
	];
	assert.equal(pickDefaultWaiver(waivers)?._id, 'a');
});

test('an explicit default flag wins over creation order', () => {
	const waivers = [
		{ _id: 'a', _creationTime: 10 },
		{ _id: 'b', _creationTime: 20, isDefault: true }
	];
	assert.equal(pickDefaultWaiver(waivers)?._id, 'b');
});

test('an archived waiver is never picked as default, even if flagged', () => {
	const waivers = [
		{ _id: 'a', _creationTime: 10, isDefault: true, status: 'archived' as const },
		{ _id: 'b', _creationTime: 20 }
	];
	assert.equal(pickDefaultWaiver(waivers)?._id, 'b');
	assert.equal(pickDefaultWaiver([]), null);
});

test('activity keys ignore case and extra whitespace', () => {
	assert.equal(normalizeActivityKey('  Zipline   Tour '), 'zipline tour');
	assert.equal(normalizeActivityKey('ZIPLINE TOUR'), normalizeActivityKey('zipline tour'));
});

test('activity-specific requirements replace the default', () => {
	const active = new Set(['default', 'zip', 'medical']);
	assert.deepEqual(
		resolveRequiredWaiverIds({
			defaultWaiverId: 'default',
			requirementWaiverIds: ['zip', 'medical'],
			activeWaiverIds: active
		}),
		['zip', 'medical']
	);
	assert.deepEqual(
		resolveRequiredWaiverIds({
			defaultWaiverId: 'default',
			requirementWaiverIds: null,
			activeWaiverIds: active
		}),
		['default']
	);
});

test('archived, unknown and duplicate waivers are dropped from requirements', () => {
	const active = new Set(['default', 'zip']);
	assert.deepEqual(
		resolveRequiredWaiverIds({
			defaultWaiverId: 'default',
			requirementWaiverIds: ['gone', 'zip', 'zip'],
			activeWaiverIds: active
		}),
		['zip']
	);
	assert.deepEqual(
		resolveRequiredWaiverIds({
			defaultWaiverId: 'default',
			requirementWaiverIds: ['gone'],
			activeWaiverIds: active
		}),
		['default']
	);
	assert.deepEqual(
		resolveRequiredWaiverIds({
			defaultWaiverId: null,
			requirementWaiverIds: null,
			activeWaiverIds: new Set<string>()
		}),
		[]
	);
});

test('waiver slugs are URL safe and collision suffixed', () => {
	assert.equal(waiverSlugBase('atlas', 'Zipline & Canopy Tour'), 'atlas-zipline-canopy-tour');
	assert.equal(waiverSlugBase('atlas', '!!!'), 'atlas-waiver');
	assert.equal(waiverSlugCandidate('atlas-zip', 1), 'atlas-zip');
	assert.equal(waiverSlugCandidate('atlas-zip', 3), 'atlas-zip-3');
});
