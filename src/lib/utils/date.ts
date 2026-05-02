export function formatBookingTimestamp(
	timestamp: string | null | undefined,
	options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
) {
	if (!timestamp) return null;
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat('en-US', options).format(date);
}
