/** Whether `value` is an IANA time zone name this runtime can format dates in. */
export function isValidTimeZone(value: string): boolean {
	if (value.length === 0 || value.length > 64) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

/** The time zone of the device this runs on, or null when it cannot be read. */
export function deviceTimeZone(): string | null {
	const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
	return timeZone && isValidTimeZone(timeZone) ? timeZone : null;
}
