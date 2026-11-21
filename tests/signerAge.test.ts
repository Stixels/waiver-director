import assert from 'node:assert/strict';
import test from 'node:test';
import {
	ageOnDate,
	adultAgeOf,
	isSignerBirthDate,
	isValidAdultAge,
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

test('minimum signer age is a whole number from the adult age to 99', () => {
	assert.equal(isValidMinimumSignerAge(18, 18), true);
	assert.equal(isValidMinimumSignerAge(21, 18), true);
	assert.equal(isValidMinimumSignerAge(17, 18), false);
	assert.equal(isValidMinimumSignerAge(100, 18), false);
	assert.equal(isValidMinimumSignerAge(18.5, 18), false);
	assert.equal(isValidMinimumSignerAge(null, 18), false);
	// Below the adult age, the guest is a minor and can't sign for themselves.
	assert.equal(isValidMinimumSignerAge(18, 19), false);
	assert.equal(isValidMinimumSignerAge(19, 19), true);
	assert.equal(isValidMinimumSignerAge(20, 21), false);
});

test('adult age is one of 18, 19 or 21 and defaults to 18', () => {
	assert.equal(isValidAdultAge(18), true);
	assert.equal(isValidAdultAge(19), true);
	assert.equal(isValidAdultAge(21), true);
	assert.equal(isValidAdultAge(20), false);
	assert.equal(isValidAdultAge(undefined), false);
	assert.equal(adultAgeOf({}), 18);
	assert.equal(adultAgeOf({ adultAge: 21 }), 21);
});
