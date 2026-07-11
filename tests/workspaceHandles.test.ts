import assert from 'node:assert/strict';
import test from 'node:test';
import {
	WORKSPACE_HANDLE_MAX_LENGTH,
	workspaceHandleBase,
	workspaceHandleCandidate
} from '../src/convex/lib/workspaceHandles.ts';

test('creates a URL-safe workspace handle from a display name', () => {
	assert.equal(workspaceHandleBase('  Caf\u00e9 & Co.  '), 'cafe-co');
	assert.equal(workspaceHandleBase('Workspaces'), 'workspace');
	assert.equal(workspaceHandleBase('!!!'), 'workspace');
	assert.equal(workspaceHandleBase(''), 'workspace');
});

test('creates deterministic collision-safe handle candidates', () => {
	const base = workspaceHandleBase('Atlas Escape & VR');

	assert.equal(workspaceHandleCandidate(base, 1), 'atlas-escape-vr');
	assert.equal(workspaceHandleCandidate(base, 2), 'atlas-escape-vr-2');
	assert.equal(workspaceHandleCandidate(base, 3), 'atlas-escape-vr-3');
	assert.throws(() => workspaceHandleCandidate(base, 0), /positive integer/);
	assert.throws(() => workspaceHandleCandidate(base, -1), /positive integer/);
});

test('preserves the maximum handle length when adding a collision suffix', () => {
	const base = workspaceHandleBase('a'.repeat(80));
	const candidate = workspaceHandleCandidate(base, 12);

	assert.equal(candidate.length, WORKSPACE_HANDLE_MAX_LENGTH);
	assert.equal(candidate, `${'a'.repeat(45)}-12`);
});
