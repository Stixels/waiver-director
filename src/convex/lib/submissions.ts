import type { Doc } from '../_generated/dataModel';

export function submissionSearchText(args: {
	signerName: string;
	signerEmail: string;
	booking?: Doc<'bookings'> | null;
}) {
	const booking = args.booking;
	return [
		args.signerName,
		args.signerEmail,
		args.signerEmail.trim().toLowerCase(),
		booking?.providerBookingId,
		booking?.activityName,
		booking?.leadCustomerName,
		booking?.leadCustomerEmail,
		booking?.leadCustomerEmail?.trim().toLowerCase()
	]
		.filter((value): value is string => Boolean(value && value.trim()))
		.join(' ');
}
