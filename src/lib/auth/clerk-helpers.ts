import { resolve } from '$app/paths';
import type { Pathname } from '$app/types';

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
	return `${resolve(url.pathname as Pathname)}${url.search}${url.hash}`;
}

export function normalizeClerkNavigateTarget(decoratedUrl: string): Pathname {
	const appRoot = resolve('/');
	const target = new URL(decoratedUrl, window.location.origin);
	const appPath =
		appRoot !== '/' && target.pathname.startsWith(appRoot)
			? target.pathname.slice(appRoot.length) || '/'
			: target.pathname;

	return `${appPath}${target.search}${target.hash}` as Pathname;
}
