import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { bookingProviderValidator, bookingStatusValidator, normalizeEmail } from './lib/bookings';
import { requireWorkspaceMember } from './lib/waivers';

const bookingSummaryValue = v.object({
	bookingId: v.id('bookings'),
	provider: bookingProviderValidator,
	providerBookingId: v.string(),
	lookupToken: v.string(),
	status: bookingStatusValidator,
	title: v.string(),
	productName: v.union(v.string(), v.null()),
	startTime: v.union(v.string(), v.null()),
	endTime: v.union(v.string(), v.null()),
	serviceDate: v.union(v.string(), v.null()),
	leadCustomerName: v.union(v.string(), v.null()),
	leadCustomerEmail: v.union(v.string(), v.null()),
	participantCount: v.number(),
	signedCount: v.number(),
	updatedAt: v.number()
});

const publicBookingMatchValue = v.object({
	lookupToken: v.string(),
	title: v.string(),
	startTime: v.union(v.string(), v.null()),
	endTime: v.union(v.string(), v.null()),
	leadCustomerName: v.union(v.string(), v.null()),
	participantCount: v.number(),
	signedCount: v.number()
});

function serializeBooking(booking: Doc<'bookings'>) {
	return {
		bookingId: booking._id,
		provider: booking.provider,
		providerBookingId: booking.providerBookingId,
		lookupToken: booking.lookupToken,
		status: booking.status,
		title: booking.title,
		productName: booking.productName ?? null,
		startTime: booking.startTime ?? null,
		endTime: booking.endTime ?? null,
		serviceDate: booking.serviceDate ?? null,
		leadCustomerName: booking.leadCustomerName ?? null,
		leadCustomerEmail: booking.leadCustomerEmail ?? null,
		participantCount: booking.participantCount,
		signedCount: booking.signedCount,
		updatedAt: booking.updatedAt
	};
}

export const listWorkspaceBookings = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.array(bookingSummaryValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const bookings = await ctx.db
			.query('bookings')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(100);

		return bookings
			.sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0))
			.map((booking) => serializeBooking(booking));
	}
});

export const getWorkspaceBooking = query({
	args: {
		workspaceId: v.id('workspaces'),
		bookingId: v.id('bookings')
	},
	returns: v.union(v.null(), bookingSummaryValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const booking = await ctx.db.get(args.bookingId);
		if (!booking || booking.workspaceId !== args.workspaceId) return null;
		return serializeBooking(booking);
	}
});

export const findPublicBooking = query({
	args: {
		slug: v.string(),
		bookingNumber: v.optional(v.string()),
		leadEmail: v.optional(v.string()),
		serviceDate: v.optional(v.string())
	},
	returns: v.array(publicBookingMatchValue),
	handler: async (ctx, args) => {
		const waiver = await ctx.db
			.query('workspace_waivers')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', args.slug))
			.unique();
		if (!waiver || !waiver.publishedVersionId) return [];

		const bookingNumber = args.bookingNumber?.trim();
		if (bookingNumber) {
			const booking = await ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_providerBookingId', (q) =>
					q.eq('workspaceId', waiver.workspaceId).eq('providerBookingId', bookingNumber)
				)
				.unique();
			if (!booking || booking.status !== 'active') return [];
			return [
				{
					lookupToken: booking.lookupToken,
					title: booking.title,
					startTime: booking.startTime ?? null,
					endTime: booking.endTime ?? null,
					leadCustomerName: booking.leadCustomerName ?? null,
					participantCount: booking.participantCount,
					signedCount: booking.signedCount
				}
			];
		}

		const email = normalizeEmail(args.leadEmail);
		const serviceDate = args.serviceDate?.trim();
		if (!email || !serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter a booking number, or enter the booking email and date.'
			});
		}

		const bookings = await ctx.db
			.query('bookings')
			.withIndex('by_workspaceId_and_leadCustomerEmail_and_serviceDate', (q) =>
				q
					.eq('workspaceId', waiver.workspaceId)
					.eq('leadCustomerEmail', email)
					.eq('serviceDate', serviceDate)
			)
			.take(10);

		return bookings
			.filter((booking) => booking.status === 'active')
			.map((booking) => ({
				lookupToken: booking.lookupToken,
				title: booking.title,
				startTime: booking.startTime ?? null,
				endTime: booking.endTime ?? null,
				leadCustomerName: booking.leadCustomerName ?? null,
				participantCount: booking.participantCount,
				signedCount: booking.signedCount
			}));
	}
});
