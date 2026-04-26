import type { Id, TableNames } from '$convex/_generated/dataModel';

export function parseConvexId<TableName extends TableNames>(
	value: string | null
): Id<TableName> | null {
	const trimmed = value?.trim() ?? '';
	return /^[a-z0-9]{32}$/.test(trimmed) ? (trimmed as Id<TableName>) : null;
}

export function queryString(entries: Array<[string, string | null]>): string {
	const params = new URLSearchParams(
		entries
			.map(([key, value]) => [key, value?.trim() ?? null] as [string, string | null])
			.filter((entry): entry is [string, string] => entry[1] !== null && entry[1].length > 0)
	);

	return params.toString();
}
