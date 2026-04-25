import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { bookingSnapshotValidator } from './lib/bookings';
import { requireWorkspaceMember } from './lib/waivers';

const MAX_CUSTOMERS_PER_LIST = 1_000;
const MAX_CUSTOMER_VISITS = 50;

const customerSummaryValue = v.object({
	customerId: v.id('customers'),
	displayName: v.string(),
	primaryEmail: v.string(),
	firstSeenAt: v.number(),
	lastSeenAt: v.number(),
	visitCount: v.number()
});

const customerVisitValue = v.object({
	submissionId: v.id('waiver_submissions'),
	signerName: v.string(),
	signerEmail: v.string(),
	submittedAt: v.number(),
	minorCount: v.number(),
	booking: v.union(v.null(), bookingSnapshotValidator)
});

function normalizedMatchValue(value?: string | null) {
	return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
}

function serializeCustomer(customer: Doc<'customers'>) {
	return {
		customerId: customer._id,
		displayName: customer.displayName,
		primaryEmail: customer.primaryEmail,
		firstSeenAt: customer.firstSeenAt,
		lastSeenAt: customer.lastSeenAt,
		visitCount: customer.visitCount
	};
}

export const listWorkspaceCustomers = query({
	args: {
		workspaceId: v.id('workspaces'),
		pageIndex: v.number(),
		pageSize: v.number(),
		searchQuery: v.optional(v.string())
	},
	returns: v.object({
		customers: v.array(customerSummaryValue),
		pageIndex: v.number(),
		totalCount: v.number(),
		hasPreviousPage: v.boolean(),
		hasNextPage: v.boolean()
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const pageIndex = Math.max(0, Math.min(Math.floor(args.pageIndex), 100));
		const pageSize = Math.max(1, Math.min(Math.floor(args.pageSize), 50));
		const searchQuery = normalizedMatchValue(args.searchQuery);
		const customers = await ctx.db
			.query('customers')
			.withIndex('by_workspaceId_and_lastSeenAt', (q) => q.eq('workspaceId', args.workspaceId))
			.order('desc')
			.take(MAX_CUSTOMERS_PER_LIST);

		const filteredCustomers = customers.filter((customer) => {
			if (!searchQuery) return true;
			return [customer.displayName, customer.primaryEmail].some((value) =>
				normalizedMatchValue(value).includes(searchQuery)
			);
		});
		const pageStart = pageIndex * pageSize;
		const pageCustomers = filteredCustomers.slice(pageStart, pageStart + pageSize);

		return {
			customers: pageCustomers.map((customer) => serializeCustomer(customer)),
			pageIndex,
			totalCount: filteredCustomers.length,
			hasPreviousPage: pageIndex > 0,
			hasNextPage: filteredCustomers.length > pageStart + pageSize
		};
	}
});

export const getCustomerDetail = query({
	args: {
		workspaceId: v.id('workspaces'),
		customerId: v.id('customers')
	},
	returns: v.union(
		v.null(),
		v.object({
			customer: customerSummaryValue,
			visits: v.array(customerVisitValue)
		})
	),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const customer = await ctx.db.get(args.customerId);
		if (!customer || customer.workspaceId !== args.workspaceId) return null;

		const submissions = await ctx.db
			.query('waiver_submissions')
			.withIndex('by_customerId_and_submittedAt', (q) => q.eq('customerId', customer._id))
			.order('desc')
			.take(MAX_CUSTOMER_VISITS);

		return {
			customer: serializeCustomer(customer),
			visits: submissions
				.filter((submission) => submission.workspaceId === args.workspaceId)
				.map((submission) => ({
					submissionId: submission._id,
					signerName: submission.signerName,
					signerEmail: submission.signerEmail,
					submittedAt: submission.submittedAt,
					minorCount: submission.minors.length,
					booking: submission.bookingSnapshot ?? null
				}))
		};
	}
});
