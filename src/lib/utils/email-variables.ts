export type FollowUpTemplateVariables = {
	signerName: string;
	bookingId: string;
	businessName: string;
	activityDate: string;
};

/**
 * Replaces follow-up template variables with their values.
 *
 * Uses function replacers so `$&`, `$'`, `` $` `` and `$$` inside a customer
 * or business name are inserted literally instead of being expanded by
 * `String.prototype.replace`.
 */
export function resolveTemplateVariables(
	template: string,
	vars: FollowUpTemplateVariables
): string {
	return template
		.replace(/\{\{customer_name\}\}|\{customer_name\}/g, () => vars.signerName)
		.replace(/\{\{booking_id\}\}|\{booking_id\}/g, () => vars.bookingId)
		.replace(/\{\{business_name\}\}|\{business_name\}/g, () => vars.businessName)
		.replace(/\{\{activity_date\}\}|\{activity_date\}/g, () => vars.activityDate);
}

const activityDateFormat = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'long',
	timeZone: 'UTC'
});

/**
 * Formats the `{{activity_date}}` value for a follow-up.
 *
 * Booking start times from providers carry the venue's local date and offset
 * (for example `2026-01-05T19:00:00-08:00`). Converting that to an instant and
 * formatting it in the server's or viewer's time zone can move the date to the
 * next or previous day, so the local calendar date is read straight from the
 * string when it has one. Both the sent email and the in-app preview use this,
 * so they always agree.
 */
export function formatFollowUpActivityDate(
	bookingStartTime: string | null | undefined,
	submittedAt: number
): string {
	const localDate = bookingStartTime?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/);
	if (localDate) {
		const [, year, month, day] = localDate;
		return activityDateFormat.format(
			new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
		);
	}

	const parsed = bookingStartTime ? Date.parse(bookingStartTime) : Number.NaN;
	return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
		new Date(Number.isNaN(parsed) ? submittedAt : parsed)
	);
}
