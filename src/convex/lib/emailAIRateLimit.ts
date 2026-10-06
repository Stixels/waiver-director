export type FixedWindowUsage = {
	windowStartedAt: number;
	requestCount: number;
};

export type FixedWindowDecision = FixedWindowUsage & {
	allowed: boolean;
	retryAfterSeconds: number;
};

export function nextFixedWindowUsage(
	current: FixedWindowUsage | null,
	now: number,
	windowMs: number,
	limit: number
): FixedWindowDecision {
	if (!Number.isFinite(now) || !Number.isFinite(windowMs) || windowMs <= 0) {
		throw new Error('Fixed-window timestamps must be finite and the window must be positive.');
	}
	if (!Number.isInteger(limit) || limit < 1) {
		throw new Error('Fixed-window limits must be positive integers.');
	}

	if (!current || now < current.windowStartedAt || now - current.windowStartedAt >= windowMs) {
		return {
			allowed: true,
			windowStartedAt: now,
			requestCount: 1,
			retryAfterSeconds: 0
		};
	}

	if (current.requestCount >= limit) {
		return {
			allowed: false,
			windowStartedAt: current.windowStartedAt,
			requestCount: current.requestCount,
			retryAfterSeconds: Math.max(1, Math.ceil((current.windowStartedAt + windowMs - now) / 1000))
		};
	}

	return {
		allowed: true,
		windowStartedAt: current.windowStartedAt,
		requestCount: current.requestCount + 1,
		retryAfterSeconds: 0
	};
}
