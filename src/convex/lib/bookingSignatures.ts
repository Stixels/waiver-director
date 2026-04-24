import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type FunctionCtx = QueryCtx | MutationCtx;
const MAX_SUBMISSIONS_FOR_BOOKING = 200;

export async function submissionsForBooking(ctx: FunctionCtx, bookingId: Id<'bookings'>) {
	const submissions = await ctx.db
		.query('waiver_submissions')
		.withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
		.take(MAX_SUBMISSIONS_FOR_BOOKING);
	return submissions.sort((a, b) => b.submittedAt - a.submittedAt);
}
