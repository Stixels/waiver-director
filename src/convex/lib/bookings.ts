import { v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';

export const bookingProviderValidator = v.union(
	v.literal('bookeo'),
	v.literal('resova'),
	v.literal('xola')
);

export const bookingStatusValidator = v.union(v.literal('active'), v.literal('canceled'));

export const bookingSnapshotValidator = v.object({
	provider: bookingProviderValidator,
	providerBookingId: v.string(),
	activityName: v.string(),
	startTime: v.optional(v.string()),
	endTime: v.optional(v.string()),
	leadCustomerName: v.optional(v.string()),
	leadCustomerEmail: v.optional(v.string())
});

export type BookingProvider = 'bookeo' | 'resova' | 'xola';

export const BOOKEO_REQUIRED_PERMISSIONS = ['bookings_r_all', 'customers_r_all'] as const;
export const UNKNOWN_ACTIVITY_NAME = 'Unknown activity';

export function normalizeEmail(value: string | undefined): string | undefined {
	const email = value?.trim().toLowerCase();
	return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export function normalizeNullableString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function parseDateTime(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function serviceDateFromDateTime(value: string | undefined): string | undefined {
	const localDate = value?.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/)?.[1];
	if (localDate) return localDate;
	return undefined;
}

export function missingBookeoRequiredPermissions(permissions: string[]): string[] {
	return BOOKEO_REQUIRED_PERMISSIONS.filter((permission) => !permissions.includes(permission));
}

export function bookingSnapshot(booking: Doc<'bookings'>) {
	return {
		provider: booking.provider,
		providerBookingId: booking.providerBookingId,
		activityName: booking.activityName,
		...(booking.startTime ? { startTime: booking.startTime } : {}),
		...(booking.endTime ? { endTime: booking.endTime } : {}),
		...(booking.leadCustomerName ? { leadCustomerName: booking.leadCustomerName } : {}),
		...(booking.leadCustomerEmail ? { leadCustomerEmail: booking.leadCustomerEmail } : {})
	};
}

export function bookingSearchText(args: {
	providerBookingId: string;
	activityName: string;
	leadCustomerName?: string;
	leadCustomerEmail?: string;
}) {
	const normalizeSearchValue = (value: string | undefined) => value?.trim().toLowerCase() ?? '';

	return [args.providerBookingId, args.activityName, args.leadCustomerName, args.leadCustomerEmail]
		.map(normalizeSearchValue)
		.filter((value) => value.length > 0)
		.join(' ');
}
