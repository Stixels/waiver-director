import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { bookingProviderValidator, bookingStatusValidator } from './lib/bookings';
import { submissionsForBooking } from './lib/bookingSignatures';
import { requireWorkspaceMember } from './lib/waivers';

const MAX_BOOKING_LIST_SPAN_MS = 48 * 60 * 60 * 1000;
const MAX_BOOKINGS_PER_LIST_WINDOW = 5_000;
const DEFAULT_BOOKING_DURATION_MS = 60 * 60 * 1000;

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

function signedUsersFromSubmissions(
	submissions: Awaited<ReturnType<typeof submissionsForBooking>>
) {
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

function serializeBooking(booking: Doc<'bookings'>) {
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
		signedCount: booking.signedCount,
		updatedAt: booking.updatedAt
	};
}

function bookingIsDone(booking: Doc<'bookings'>, now: number) {
	if (typeof booking.endAt === 'number') return booking.endAt < now;
	const endTime = booking.endTime ? Date.parse(booking.endTime) : Number.NaN;
	if (Number.isFinite(endTime)) return endTime < now;
	if (typeof booking.startAt === 'number')
		return booking.startAt + DEFAULT_BOOKING_DURATION_MS < now;
	if (!booking.startTime) return false;
	const startAt = Date.parse(booking.startTime);
	return Number.isFinite(startAt) && startAt + DEFAULT_BOOKING_DURATION_MS < now;
}

export const listWorkspaceBookings = query({
	args: {
		workspaceId: v.id('workspaces'),
		dayStartAt: v.number(),
		dayEndAt: v.number(),
		pageIndex: v.number(),
		pageSize: v.number(),
		searchQuery: v.optional(v.string()),
		hideDone: v.boolean(),
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

		const dayEndAt = Math.min(args.dayEndAt, args.dayStartAt + MAX_BOOKING_LIST_SPAN_MS);
		const pageIndex = Math.max(0, Math.min(Math.floor(args.pageIndex), 100));
		const pageSize = Math.max(1, Math.min(Math.floor(args.pageSize), 50));
		const searchQuery = normalizedMatchValue(args.searchQuery);
		const dayBookings = await ctx.db
			.query('bookings')
			.withIndex('by_workspaceId_and_startAt', (q) =>
				q
					.eq('workspaceId', args.workspaceId)
					.gte('startAt', args.dayStartAt)
					.lt('startAt', dayEndAt)
			)
			.take(MAX_BOOKINGS_PER_LIST_WINDOW);

		const now = Date.now();
		const serialized = dayBookings.map((booking) => ({
			booking: serializeBooking(booking),
			isDone: bookingIsDone(booking, now)
		}));
		const visibleByDoneFilter = serialized.filter((entry) => {
			if (!args.hideDone) return true;
			return !entry.isDone;
		});
		const summary = visibleByDoneFilter.reduce(
			(total, entry) => {
				const isCanceled = entry.booking.status === 'canceled';
				const isIncomplete =
					!isCanceled && entry.booking.signedCount < entry.booking.participantCount;

				return {
					totalCount: total.totalCount + 1,
					activeCount: total.activeCount + (entry.booking.status === 'active' ? 1 : 0),
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

		const filteredBookings = visibleByDoneFilter
			.map((entry) => entry.booking)
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
		return serializeBooking(booking);
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
			booking: serializeBooking(booking),
			signedUsers
		};
	}
});
