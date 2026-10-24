import { resolve } from '$app/paths';

const resolvePathname = resolve as unknown as (path: string) => string;

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

export function getSafePostAuthRedirectHref(
	redirectTo: string | null | undefined,
	fallback: string = '/app'
) {
	const safePath =
		!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')
			? fallback
			: redirectTo;
	const url = new URL(safePath, 'http://waiver-director.local');
	return `${resolvePathname(url.pathname)}${url.search}${url.hash}`;
}

export function getSsoCallbackHref(redirectTo: string | null | undefined) {
	const callbackPath = resolvePathname('/sso-callback');
	return redirectTo ? `${callbackPath}?redirectTo=${encodeURIComponent(redirectTo)}` : callbackPath;
}

const SIGN_UP_FIELD_LABELS: Record<string, string> = {
	first_name: 'first name',
	last_name: 'last name',
	username: 'username',
	phone_number: 'phone number',
	legal_accepted: 'acceptance of the terms'
};

// The sign-up form only collects email and password. If Clerk is configured to
// require more, say so instead of leaving the user on a form that can't finish.
export function getMissingSignUpFieldsMessage(missingFields: readonly string[]) {
	const labels = missingFields.map(
		(field) => SIGN_UP_FIELD_LABELS[field] ?? field.replace(/_/g, ' ')
	);
	return `Your account still needs ${labels.join(', ')} before it can be finished, and this form can't collect that yet. Please contact support.`;
}
