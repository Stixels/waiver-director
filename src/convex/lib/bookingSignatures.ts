import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type FunctionCtx = QueryCtx | MutationCtx;

export async function submissionsForBooking(ctx: FunctionCtx, bookingId: Id<'bookings'>) {
	const submissions = await ctx.db
		.query('waiver_submissions')
		.withIndex('by_bookingId', (q) => q.eq('bookingId', bookingId))
		.collect();
	return submissions.sort((a, b) => b.submittedAt - a.submittedAt);
}

export function signedUserCountFromSubmissions(
	submissions: Awaited<ReturnType<typeof submissionsForBooking>>
) {
	return submissions.reduce((total, submission) => total + 1 + submission.minors.length, 0);
}

export async function signedCountForBooking(ctx: FunctionCtx, bookingId: Id<'bookings'>) {
	return signedUserCountFromSubmissions(await submissionsForBooking(ctx, bookingId));
}
