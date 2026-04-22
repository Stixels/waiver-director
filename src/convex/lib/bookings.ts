import { ConvexError, v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';

export const bookingProviderValidator = v.union(
	v.literal('bookeo'),
	v.literal('resova'),
	v.literal('xola')
);

export const bookingStatusValidator = v.union(v.literal('active'), v.literal('canceled'));

export const syncHorizonMonthsValidator = v.union(v.literal(3), v.literal(6), v.literal(12));

export const bookingSnapshotValidator = v.object({
	provider: bookingProviderValidator,
	providerBookingId: v.string(),
	title: v.string(),
	startTime: v.optional(v.string()),
	endTime: v.optional(v.string()),
	leadCustomerName: v.optional(v.string()),
	leadCustomerEmail: v.optional(v.string())
});

export type BookingProvider = 'bookeo' | 'resova' | 'xola';
export type SyncHorizonMonths = 3 | 6 | 12;

export const BOOKEO_REQUIRED_PERMISSIONS = ['bookings_r_all', 'customers_r_all'] as const;
export const BOOKEO_OPTIONAL_PERMISSIONS = [
	'availability_r',
	'blocks_r_all',
	'payments_r_all'
] as const;

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
	const timestamp = parseDateTime(value);
	if (!timestamp) return undefined;
	return new Date(timestamp).toISOString().slice(0, 10);
}

export function assertValidSyncHorizon(value: number): SyncHorizonMonths {
	if (value === 3 || value === 6 || value === 12) return value;
	throw new ConvexError({
		code: 'invalid_argument',
		message: 'Choose a sync horizon of 3, 6, or 12 months.'
	});
}

export function missingBookeoRequiredPermissions(permissions: string[]): string[] {
	return BOOKEO_REQUIRED_PERMISSIONS.filter((permission) => !permissions.includes(permission));
}

export function bookingSnapshot(booking: Doc<'bookings'>) {
	return {
		provider: booking.provider,
		providerBookingId: booking.providerBookingId,
		title: booking.title,
		...(booking.startTime ? { startTime: booking.startTime } : {}),
		...(booking.endTime ? { endTime: booking.endTime } : {}),
		...(booking.leadCustomerName ? { leadCustomerName: booking.leadCustomerName } : {}),
		...(booking.leadCustomerEmail ? { leadCustomerEmail: booking.leadCustomerEmail } : {})
	};
}
