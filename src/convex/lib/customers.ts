import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

export function normalizeCustomerEmail(email: string) {
	return email.trim().toLowerCase();
}

export async function upsertSignerCustomer(
	ctx: MutationCtx,
	args: {
		workspaceId: Id<'workspaces'>;
		signerName: string;
		signerEmail: string;
		submittedAt: number;
		bookingId: Id<'bookings'> | null;
	}
) {
	const normalizedEmail = normalizeCustomerEmail(args.signerEmail);
	const existing = await ctx.db
		.query('customers')
		.withIndex('by_workspaceId_and_normalizedEmail', (q) =>
			q.eq('workspaceId', args.workspaceId).eq('normalizedEmail', normalizedEmail)
		)
		.unique();

	if (existing) {
		await ctx.db.patch(existing._id, {
			primaryEmail: args.signerEmail,
			displayName: args.signerName,
			lastSeenAt: args.submittedAt,
			visitCount: existing.visitCount + 1,
			latestBookingId: args.bookingId
		});
		return existing._id;
	}

	return await ctx.db.insert('customers', {
		workspaceId: args.workspaceId,
		normalizedEmail,
		primaryEmail: args.signerEmail,
		displayName: args.signerName,
		firstSeenAt: args.submittedAt,
		lastSeenAt: args.submittedAt,
		visitCount: 1,
		latestSubmissionId: null,
		latestBookingId: args.bookingId
	});
}
