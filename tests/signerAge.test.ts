import assert from 'node:assert/strict';
import test from 'node:test';
import {
	ageOnDate,
	isSignerBirthDate,
	isValidMinimumSignerAge,
	signerBirthDateBounds
} from '../src/lib/domain/waiver-constraints.ts';

test('ageOnDate counts whole years and waits for the birthday', () => {
	assert.equal(ageOnDate('2008-11-08', '2026-11-08'), 18);
	assert.equal(ageOnDate('2008-11-09', '2026-11-08'), 17);
	assert.equal(ageOnDate('2008-02-29', '2026-02-28'), 17);
	assert.equal(ageOnDate('2008-02-29', '2026-03-01'), 18);
});

test('signer must reach the minimum age on the signing day', () => {
	assert.equal(isSignerBirthDate('2008-11-08', '2026-11-08', 18), true);
	assert.equal(isSignerBirthDate('2008-11-09', '2026-11-08', 18), false);
	assert.equal(isSignerBirthDate('2005-11-08', '2026-11-08', 21), true);
	assert.equal(isSignerBirthDate('2005-11-09', '2026-11-08', 21), false);
	assert.equal(isSignerBirthDate('1899-12-31', '2026-11-08', 18), false);
	assert.equal(isSignerBirthDate('not-a-date', '2026-11-08', 18), false);
});

test('signer bounds handle a Feb 29 signing day', () => {
	assert.equal(signerBirthDateBounds('2028-02-29', 18).max, '2010-02-28');
	assert.equal(signerBirthDateBounds('2028-02-29', 20).max, '2008-02-29');
});

test('minimum signer age is a whole number from 18 to 99', () => {
	assert.equal(isValidMinimumSignerAge(18), true);
	assert.equal(isValidMinimumSignerAge(21), true);
	assert.equal(isValidMinimumSignerAge(17), false);
	assert.equal(isValidMinimumSignerAge(100), false);
	assert.equal(isValidMinimumSignerAge(18.5), false);
	assert.equal(isValidMinimumSignerAge(null), false);
});
