import { v } from 'convex/values';
import { query } from './_generated/server';
import { bookingStatusValidator } from './lib/bookings';
import { requireWorkspaceMember } from './lib/waivers';

const MAX_SEARCH_RESULTS_PER_GROUP = 8;

const customerResultValue = v.object({
	customerId: v.id('customers'),
	displayName: v.string(),
	primaryEmail: v.string(),
	lastSeenAt: v.number(),
	visitCount: v.number()
});

const bookingResultValue = v.object({
	bookingId: v.id('bookings'),
	providerBookingId: v.string(),
	status: bookingStatusValidator,
	activityName: v.string(),
	startTime: v.union(v.string(), v.null()),
	serviceDate: v.union(v.string(), v.null()),
	leadCustomerName: v.union(v.string(), v.null()),
	leadCustomerEmail: v.union(v.string(), v.null()),
	participantCount: v.number(),
	signedCount: v.number()
});

const submissionResultValue = v.object({
	submissionId: v.id('waiver_submissions'),
	signerName: v.string(),
	signerEmail: v.string(),
	minorCount: v.number(),
	bookingActivityName: v.union(v.string(), v.null()),
	bookingStartTime: v.union(v.string(), v.null()),
	submittedAt: v.number()
});

function normalizedMatchValue(value?: string | null) {
	return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
}

export const globalWorkspaceSearch = query({
	args: {
		workspaceId: v.id('workspaces'),
		searchQuery: v.string()
	},
	returns: v.object({
		customers: v.array(customerResultValue),
		bookings: v.array(bookingResultValue),
		submissions: v.array(submissionResultValue)
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const searchQuery = normalizedMatchValue(args.searchQuery);
		if (!searchQuery) {
			return {
				customers: [],
				bookings: [],
				submissions: []
			};
		}

		const customers = await ctx.db
			.query('customers')
			.withSearchIndex('search_customerText', (q) =>
				q.search('searchText', searchQuery).eq('workspaceId', args.workspaceId)
			)
			.take(MAX_SEARCH_RESULTS_PER_GROUP);

		const bookings = await ctx.db
			.query('bookings')
			.withSearchIndex('search_bookingText', (q) =>
				q.search('searchText', searchQuery).eq('workspaceId', args.workspaceId)
			)
			.take(MAX_SEARCH_RESULTS_PER_GROUP);

		const submissions = await ctx.db
			.query('waiver_submissions')
			.withSearchIndex('search_submissionText', (q) =>
				q.search('searchText', searchQuery).eq('workspaceId', args.workspaceId)
			)
			.take(MAX_SEARCH_RESULTS_PER_GROUP);

		return {
			customers: customers.map((customer) => ({
				customerId: customer._id,
				displayName: customer.displayName,
				primaryEmail: customer.primaryEmail,
				lastSeenAt: customer.lastSeenAt,
				visitCount: customer.visitCount
			})),
			bookings: bookings.map((booking) => ({
				bookingId: booking._id,
				providerBookingId: booking.providerBookingId,
				status: booking.status,
				activityName: booking.activityName,
				startTime: booking.startTime ?? null,
				serviceDate: booking.serviceDate ?? null,
				leadCustomerName: booking.leadCustomerName ?? null,
				leadCustomerEmail: booking.leadCustomerEmail ?? null,
				participantCount: booking.participantCount,
				signedCount: booking.signedCount
			})),
			submissions: submissions.map((submission) => ({
				submissionId: submission._id,
				signerName: submission.signerName,
				signerEmail: submission.signerEmail,
				minorCount: submission.minors.length,
				bookingActivityName: submission.bookingSnapshot?.activityName ?? null,
				bookingStartTime: submission.bookingSnapshot?.startTime ?? null,
				submittedAt: submission.submittedAt
			}))
		};
	}
});
