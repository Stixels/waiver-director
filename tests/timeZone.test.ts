import assert from 'node:assert/strict';
import test from 'node:test';
import { deviceTimeZone, isValidTimeZone } from '../src/lib/utils/time-zone.ts';

test('accepts IANA time zone names and rejects anything else', () => {
	assert.equal(isValidTimeZone('America/Los_Angeles'), true);
	assert.equal(isValidTimeZone('UTC'), true);
	assert.equal(isValidTimeZone(''), false);
	assert.equal(isValidTimeZone('Not/A_Zone'), false);
	assert.equal(isValidTimeZone('x'.repeat(65)), false);
});

test('reads a valid time zone from the device', () => {
	const timeZone = deviceTimeZone();
	assert.equal(typeof timeZone, 'string');
	assert.equal(isValidTimeZone(timeZone ?? ''), true);
});
