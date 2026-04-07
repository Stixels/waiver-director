type ClerkErrorLike = {
	errors?: Array<{
		longMessage?: string;
		message?: string;
		code?: string;
	}>;
};

export function getClerkErrorMessage(error: unknown, fallback: string): string {
	if (error && typeof error === 'object' && 'errors' in error) {
		const firstError = (error as ClerkErrorLike).errors?.[0];
		if (firstError?.longMessage) {
			return firstError.longMessage;
		}
		if (firstError?.message) {
			return firstError.message;
		}
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return fallback;
}
