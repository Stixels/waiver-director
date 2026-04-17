import { ConvexError } from 'convex/values';

export function getConvexErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof ConvexError) {
		if (typeof error.data === 'string') {
			return error.data;
		}

		if (
			typeof error.data === 'object' &&
			error.data !== null &&
			'message' in error.data &&
			typeof error.data.message === 'string'
		) {
			return error.data.message;
		}
	}

	return error instanceof Error ? error.message : fallback;
}
