export function queryString(entries: Array<[string, string | null]>): string {
	return entries
		.map(([key, value]) => [key, value?.trim() ?? null] as [string, string | null])
		.filter((entry): entry is [string, string] => entry[1] !== null && entry[1].length > 0)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
		.join('&');
}
