export const WORKSPACE_HANDLE_MAX_LENGTH = 48;

const FALLBACK_WORKSPACE_HANDLE = 'workspace';
const RESERVED_WORKSPACE_HANDLES = new Set(['workspaces']);

export function workspaceHandleBase(name: string): string {
	const handle = name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, WORKSPACE_HANDLE_MAX_LENGTH)
		.replace(/-+$/g, '');

	return handle && !RESERVED_WORKSPACE_HANDLES.has(handle) ? handle : FALLBACK_WORKSPACE_HANDLE;
}

export function workspaceHandleCandidate(base: string, attempt: number): string {
	if (!Number.isInteger(attempt) || attempt < 1) {
		throw new Error('Workspace handle attempt must be a positive integer.');
	}

	if (attempt === 1) return base;

	const suffix = `-${attempt}`;
	const availableBaseLength = WORKSPACE_HANDLE_MAX_LENGTH - suffix.length;
	if (availableBaseLength < 1) {
		throw new Error('Workspace handle attempt exceeds the supported handle length.');
	}

	const candidateBase = base.slice(0, availableBaseLength).replace(/-+$/g, '');
	return `${candidateBase || FALLBACK_WORKSPACE_HANDLE.slice(0, availableBaseLength)}${suffix}`;
}
