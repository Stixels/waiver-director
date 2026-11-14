import assert from 'node:assert/strict';
import test from 'node:test';
import { collectsMinorDateOfBirth } from '../src/lib/domain/waiver-constraints.ts';

test('minor date of birth is off unless the waiver turns it on', () => {
	assert.equal(collectsMinorDateOfBirth({}), false, 'waivers saved before the setting');
	assert.equal(collectsMinorDateOfBirth({ collectMinorDateOfBirth: false }), false);
	assert.equal(collectsMinorDateOfBirth({ collectMinorDateOfBirth: true }), true);
});
