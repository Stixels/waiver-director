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
	activityName: v.string(),
	startTime: v.union(v.string(), v.null()),
	endTime: v.union(v.string(), v.null()),
	serviceDate: v.union(v.string(), v.null()),
	leadCustomerName: v.union(v.string(), v.null()),
	leadCustomerEmail: v.union(v.string(), v.null()),
	participantCount: v.number(),
	signedCount: v.number(),
	updatedAt: v.number()
});

const bookingDaySummaryValue = v.object({
	totalCount: v.number(),
	activeCount: v.number(),
	incompleteCount: v.number(),
	canceledCount: v.number()
});

const bookingPageValue = v.object({
	bookings: v.array(bookingSummaryValue),
	pageIndex: v.number(),
	nextUpcomingBookingId: v.union(v.id('bookings'), v.null()),
	summary: bookingDaySummaryValue,
	hasPreviousPage: v.boolean(),
	hasNextPage: v.boolean()
});

const signedUserValue = v.object({
	submissionId: v.id('waiver_submissions'),
	name: v.string(),
	email: v.union(v.string(), v.null()),
	kind: v.union(v.literal('signer'), v.literal('minor')),
	submittedAt: v.number()
});

const bookingDetailValue = v.object({
	booking: bookingSummaryValue,
	signedUsers: v.array(signedUserValue)
});

const publicBookingMatchValue = v.object({
	lookupToken: v.string(),
	activityName: v.string(),
	startTime: v.union(v.string(), v.null()),
	endTime: v.union(v.string(), v.null()),
	leadCustomerName: v.union(v.string(), v.null()),
	participantCount: v.number(),
	signedCount: v.number()
});

async function submissionsForBooking(ctx: QueryCtx, bookingId: Doc<'bookings'>['_id']) {
	const submissions = await ctx.db
		.query('waiver_submissions')
		.withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
		.collect();
	return submissions.sort((a, b) => b.submittedAt - a.submittedAt);
}

function signedUserCountFromSubmissions(submissions: Array<Doc<'waiver_submissions'>>) {
	return submissions.reduce((total, submission) => total + 1 + submission.minors.length, 0);
}

function signedUsersFromSubmissions(submissions: Array<Doc<'waiver_submissions'>>) {
	return submissions.flatMap((submission) => [
		{
			submissionId: submission._id,
			name: submission.signerName,
			email: submission.signerEmail,
			kind: 'signer' as const,
			submittedAt: submission.submittedAt
		},
		...submission.minors.map((minor) => ({
			submissionId: submission._id,
			name: minor.fullName,
			email: null,
			kind: 'minor' as const,
			submittedAt: submission.submittedAt
		}))
	]);
}

function normalizedMatchValue(value?: string | null) {
	return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
}

function serializeBooking(booking: Doc<'bookings'>, signedCount: number) {
	return {
		bookingId: booking._id,
		provider: booking.provider,
		providerBookingId: booking.providerBookingId,
		lookupToken: booking.lookupToken,
		status: booking.status,
		activityName: booking.activityName,
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

function serializePublicBookingMatch(booking: Doc<'bookings'>) {
	return {
		lookupToken: booking.lookupToken,
		activityName: booking.activityName,
		startTime: booking.startTime ?? null,
		endTime: booking.endTime ?? null,
		leadCustomerName: booking.leadCustomerName ?? null,
		participantCount: booking.participantCount,
		signedCount: booking.signedCount
	};
}

export const listWorkspaceBookings = query({
	args: {
		workspaceId: v.id('workspaces'),
		dayStartAt: v.number(),
		dayEndAt: v.number(),
		pageIndex: v.number(),
		pageSize: v.number(),
		searchQuery: v.optional(v.string()),
		statusFilter: v.union(
			v.literal('all'),
			v.literal('active'),
			v.literal('attention'),
			v.literal('canceled')
		)
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

		const pageIndex = Math.max(0, Math.min(Math.floor(args.pageIndex), 100));
		const pageSize = Math.max(1, Math.min(Math.floor(args.pageSize), 50));
		const searchQuery = normalizedMatchValue(args.searchQuery);
		const dayBookings = await ctx.db
			.query('bookings')
			.withIndex('by_workspaceId_and_startAt', (q) =>
				q
					.eq('workspaceId', args.workspaceId)
					.gte('startAt', args.dayStartAt)
					.lt('startAt', args.dayEndAt)
			)
			.collect();

		const serialized = dayBookings.map((booking) => serializeBooking(booking, booking.signedCount));
		const summary = serialized.reduce(
			(total, booking) => {
				const isCanceled = booking.status === 'canceled';
				const isIncomplete = !isCanceled && booking.signedCount < booking.participantCount;

				return {
					totalCount: total.totalCount + 1,
					activeCount: total.activeCount + (booking.status === 'active' ? 1 : 0),
					incompleteCount: total.incompleteCount + (isIncomplete ? 1 : 0),
					canceledCount: total.canceledCount + (isCanceled ? 1 : 0)
				};
			},
			{
				totalCount: 0,
				activeCount: 0,
				incompleteCount: 0,
				canceledCount: 0
			}
		);

		const filteredBookings = serialized
			.filter((booking) => {
				if (args.statusFilter === 'active') return booking.status === 'active';
				if (args.statusFilter === 'attention') {
					return booking.status === 'active' && booking.signedCount < booking.participantCount;
				}
				if (args.statusFilter === 'canceled') return booking.status === 'canceled';
				return true;
			})
			.filter((booking) => {
				if (!searchQuery) return true;
				return [
					booking.activityName,
					booking.leadCustomerName,
					booking.leadCustomerEmail,
					booking.providerBookingId
				].some((value) => normalizedMatchValue(value).includes(searchQuery));
			})
			.sort((a, b) => {
				const aStart = a.startTime ? Date.parse(a.startTime) : Number.MAX_SAFE_INTEGER;
				const bStart = b.startTime ? Date.parse(b.startTime) : Number.MAX_SAFE_INTEGER;
				if (aStart !== bStart) return aStart - bStart;
				return a.activityName.localeCompare(b.activityName);
			});
		const now = Date.now();
		const nextUpcomingBooking =
			filteredBookings
				.filter((booking) => booking.status === 'active')
				.map((booking) => ({
					booking,
					startAt: booking.startTime ? Date.parse(booking.startTime) : Number.NaN
				}))
				.filter((entry) => Number.isFinite(entry.startAt) && entry.startAt >= now)
				.sort((a, b) => a.startAt - b.startAt)[0]?.booking ?? null;

		const pageStart = pageIndex * pageSize;
		const pageBookings = filteredBookings.slice(pageStart, pageStart + pageSize);

		return {
			bookings: pageBookings,
			pageIndex,
			nextUpcomingBookingId: nextUpcomingBooking?.bookingId ?? null,
			summary,
			hasPreviousPage: pageIndex > 0,
			hasNextPage: filteredBookings.length > pageStart + pageSize
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
		return serializeBooking(booking, booking.signedCount);
	}
});

export const getWorkspaceBookingDetail = query({
	args: {
		workspaceId: v.id('workspaces'),
		bookingId: v.id('bookings')
	},
	returns: v.union(v.null(), bookingDetailValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const booking = await ctx.db.get(args.bookingId);
		if (!booking || booking.workspaceId !== args.workspaceId) return null;

		const submissions = await submissionsForBooking(ctx, booking._id);
		const signedUsers = signedUsersFromSubmissions(submissions);

		return {
			booking: serializeBooking(booking, signedUserCountFromSubmissions(submissions)),
			signedUsers
		};
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
			const bookings = await ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_providerBookingId', (q) =>
					q.eq('workspaceId', waiver.workspaceId).eq('providerBookingId', bookingNumber)
				)
				.take(10);
			return bookings
				.filter((booking) => booking.status === 'active')
				.map((booking) => serializePublicBookingMatch(booking));
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
			.map((booking) => serializePublicBookingMatch(booking));
	}
});
