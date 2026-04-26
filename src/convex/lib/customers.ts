import { ConvexError } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

export function normalizeCustomerEmail(email: string) {
	return email.trim().toLowerCase();
}

export function customerSearchText(args: { displayName: string; primaryEmail: string }) {
	return `${args.displayName} ${args.primaryEmail} ${normalizeCustomerEmail(args.primaryEmail)}`.trim();
}

export async function upsertSignerCustomer(
	ctx: MutationCtx,
	args: {
		workspaceId: Id<'workspaces'>;
		signerName: string;
		signerEmail: string;
		submittedAt: number;
		bookingId: Id<'bookings'> | null;
		latestSubmissionId: Id<'waiver_submissions'>;
	}
) {
	const normalizedEmail = normalizeCustomerEmail(args.signerEmail);
	const workspace = await ctx.db.get(args.workspaceId);
	if (!workspace) {
		throw new ConvexError({
			code: 'not_found',
			message: 'Workspace not found.'
		});
	}

	const existing = await ctx.db
		.query('customers')
		.withIndex('by_workspaceId_and_normalizedEmail', (q) =>
			q.eq('workspaceId', args.workspaceId).eq('normalizedEmail', normalizedEmail)
		)
		.unique();

	if (existing) {
		const isLatestVisit = args.submittedAt >= existing.lastSeenAt;
		const patch: {
			primaryEmail?: string;
			displayName?: string;
			firstSeenAt: number;
			lastSeenAt: number;
			visitCount: number;
			latestSubmissionId?: Id<'waiver_submissions'>;
			latestBookingId?: Id<'bookings'>;
			searchText?: string;
		} = {
			firstSeenAt: Math.min(existing.firstSeenAt, args.submittedAt),
			lastSeenAt: Math.max(existing.lastSeenAt, args.submittedAt),
			visitCount: existing.visitCount + 1
		};

		if (isLatestVisit) {
			patch.primaryEmail = args.signerEmail;
			patch.displayName = args.signerName;
			patch.latestSubmissionId = args.latestSubmissionId;
			patch.searchText = customerSearchText({
				displayName: args.signerName,
				primaryEmail: args.signerEmail
			});
		}
		if (args.bookingId !== null && isLatestVisit) {
			patch.latestBookingId = args.bookingId;
		}

		await ctx.db.patch(existing._id, patch);
		return existing._id;
	}

	const customerId = await ctx.db.insert('customers', {
		workspaceId: args.workspaceId,
		normalizedEmail,
		primaryEmail: args.signerEmail,
		searchText: customerSearchText({
			displayName: args.signerName,
			primaryEmail: args.signerEmail
		}),
		displayName: args.signerName,
		firstSeenAt: args.submittedAt,
		lastSeenAt: args.submittedAt,
		visitCount: 1,
		latestSubmissionId: args.latestSubmissionId,
		...(args.bookingId !== null ? { latestBookingId: args.bookingId } : {})
	});
	await ctx.db.patch(args.workspaceId, {
		customerCount: workspace.customerCount + 1
	});
	return customerId;
}
