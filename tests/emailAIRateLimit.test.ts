import assert from 'node:assert/strict';
import test from 'node:test';
import { nextFixedWindowUsage } from '../src/convex/lib/emailAIRateLimit.ts';

test('starts and increments a fixed quota window', () => {
	const first = nextFixedWindowUsage(null, 1_000, 60_000, 2);
	const second = nextFixedWindowUsage(first, 2_000, 60_000, 2);

	assert.deepEqual(first, {
		allowed: true,
		windowStartedAt: 1_000,
		requestCount: 1,
		retryAfterSeconds: 0
	});
	assert.equal(second.allowed, true);
	assert.equal(second.requestCount, 2);
	assert.equal(second.windowStartedAt, 1_000);
});

test('denies requests at the limit and reports when to retry', () => {
	const decision = nextFixedWindowUsage(
		{ windowStartedAt: 1_000, requestCount: 2 },
		31_000,
		60_000,
		2
	);

	assert.equal(decision.allowed, false);
	assert.equal(decision.requestCount, 2);
	assert.equal(decision.retryAfterSeconds, 30);
});

test('resets usage after the window expires', () => {
	const decision = nextFixedWindowUsage(
		{ windowStartedAt: 1_000, requestCount: 2 },
		61_000,
		60_000,
		2
	);

	assert.deepEqual(decision, {
		allowed: true,
		windowStartedAt: 61_000,
		requestCount: 1,
		retryAfterSeconds: 0
	});
});
