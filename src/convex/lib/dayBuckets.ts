export const DAY_MS = 24 * 60 * 60 * 1000;

// A local calendar day is 23, 24 or 25 hours long around daylight saving
// changes. Anything outside this window is not a real day boundary.
const MIN_DAY_MS = 22 * 60 * 60 * 1000;
const MAX_DAY_MS = 26 * 60 * 60 * 1000;

/**
 * Returns the boundaries of each local day between `startAt` and `endAt`:
 * every day's start, followed by `endAt`, so day `i` is
 * `[boundaries[i], boundaries[i + 1])`.
 *
 * Clients pass the exact local midnights they computed (`provided`), because
 * the server cannot know the viewer's time zone and a fixed 24-hour step
 * drifts by an hour across a daylight saving change. When `provided` is
 * missing or does not describe the same range, the boundaries fall back to
 * 24-hour steps that still end exactly at `endAt`, so every bucket key the
 * server builds lines up with the ones it reads back.
 */
export function resolveDayBoundaries(
	startAt: number,
	endAt: number,
	provided?: number[]
): number[] {
	if (provided && isValidDayBoundaries(startAt, endAt, provided)) {
		return provided;
	}

	const dayCount = Math.max(1, Math.round((endAt - startAt) / DAY_MS));
	const boundaries: number[] = [];
	for (let index = 0; index < dayCount; index += 1) {
		boundaries.push(startAt + index * DAY_MS);
	}
	boundaries.push(endAt);
	return boundaries;
}

export function isValidDayBoundaries(startAt: number, endAt: number, boundaries: number[]) {
	if (boundaries.length < 2) return false;
	if (boundaries[0] !== startAt || boundaries[boundaries.length - 1] !== endAt) return false;
	for (let index = 1; index < boundaries.length; index += 1) {
		const length = boundaries[index] - boundaries[index - 1];
		if (!Number.isFinite(length) || length < MIN_DAY_MS || length > MAX_DAY_MS) return false;
	}
	return true;
}

/** Index of the day containing `epochMs`, or -1 when it falls outside the range. */
export function dayIndexFor(boundaries: number[], epochMs: number): number {
	if (epochMs < boundaries[0] || epochMs >= boundaries[boundaries.length - 1]) return -1;
	let low = 0;
	let high = boundaries.length - 2;
	while (low < high) {
		const mid = Math.ceil((low + high) / 2);
		if (boundaries[mid] <= epochMs) {
			low = mid;
		} else {
			high = mid - 1;
		}
	}
	return low;
}

/** Number of whole local days the boundaries cover. */
export function dayCount(boundaries: number[]): number {
	return boundaries.length - 1;
}
