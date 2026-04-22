import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
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

const bookingPageValue = v.object({
	bookings: v.array(bookingSummaryValue),
	continueCursor: v.string(),
	isDone: v.boolean()
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

async function signedUserCountForBooking(ctx: QueryCtx, bookingId: Doc<'bookings'>['_id']) {
	const submissions = await ctx.db
		.query('waiver_submissions')
		.withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
		.collect();

	return submissions.reduce((total, submission) => total + 1 + submission.minors.length, 0);
}

function serializeBooking(booking: Doc<'bookings'>, signedCount: number) {
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
		signedCount,
		updatedAt: booking.updatedAt
	};
}

export const listWorkspaceBookings = query({
	args: {
		workspaceId: v.id('workspaces'),
		dayStartAt: v.number(),
		dayEndAt: v.number(),
		paginationOpts: paginationOptsValidator
	},
	returns: bookingPageValue,
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		if (
			!Number.isFinite(args.dayStartAt) ||
			!Number.isFinite(args.dayEndAt) ||
			args.dayEndAt <= args.dayStartAt
		) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Choose a valid booking date.'
			});
		}

		const bookingPage = await ctx.db
			.query('bookings')
			.withIndex('by_workspaceId_and_startAt', (q) =>
				q
					.eq('workspaceId', args.workspaceId)
					.gte('startAt', args.dayStartAt)
					.lt('startAt', args.dayEndAt)
			)
			.paginate(args.paginationOpts);

		const serialized = [];
		for (const booking of bookingPage.page) {
			serialized.push(serializeBooking(booking, await signedUserCountForBooking(ctx, booking._id)));
		}

		return {
			bookings: serialized,
			continueCursor: bookingPage.continueCursor,
			isDone: bookingPage.isDone
		};
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
		return serializeBooking(booking, await signedUserCountForBooking(ctx, booking._id));
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
			const signedCount = await signedUserCountForBooking(ctx, booking._id);
			return [
				{
					lookupToken: booking.lookupToken,
					title: booking.title,
					startTime: booking.startTime ?? null,
					endTime: booking.endTime ?? null,
					leadCustomerName: booking.leadCustomerName ?? null,
					participantCount: booking.participantCount,
					signedCount
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

		const matches = [];
		for (const booking of bookings.filter((candidate) => candidate.status === 'active')) {
			matches.push({
				lookupToken: booking.lookupToken,
				title: booking.title,
				startTime: booking.startTime ?? null,
				endTime: booking.endTime ?? null,
				leadCustomerName: booking.leadCustomerName ?? null,
				participantCount: booking.participantCount,
				signedCount: await signedUserCountForBooking(ctx, booking._id)
			});
		}

		return matches;
	}
});
