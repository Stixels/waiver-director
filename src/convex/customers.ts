import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { query, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { bookingSnapshotValidator } from './lib/bookings';
import {
	getWorkspaceTag,
	loadCustomerTags,
	loadWorkspaceTagMap,
	matchesSearchText,
	tagSummaryValue
} from './lib/tags';
import { requireWorkspaceMember } from './lib/waivers';

const MAX_CUSTOMER_VISITS = 50;

const customerSummaryValue = v.object({
	customerId: v.id('customers'),
	displayName: v.string(),
	primaryEmail: v.string(),
	firstSeenAt: v.number(),
	lastSeenAt: v.number(),
	visitCount: v.number(),
	tags: v.array(tagSummaryValue)
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

async function serializeCustomers(
	ctx: QueryCtx,
	workspaceId: Id<'workspaces'>,
	customers: Doc<'customers'>[]
) {
	const tagMap = await loadWorkspaceTagMap(ctx, workspaceId);
	return await Promise.all(
		customers.map(async (customer) => ({
			customerId: customer._id,
			displayName: customer.displayName,
			primaryEmail: customer.primaryEmail,
			firstSeenAt: customer.firstSeenAt,
			lastSeenAt: customer.lastSeenAt,
			visitCount: customer.visitCount,
			tags: await loadCustomerTags(ctx, tagMap, customer._id)
		}))
	);
}

export const listWorkspaceCustomers = query({
	args: {
		workspaceId: v.id('workspaces'),
		paginationOpts: paginationOptsValidator,
		searchQuery: v.optional(v.string()),
		// Accepts a raw string so a stale or malformed ?tag= URL param yields an
		// empty result instead of an argument validation error.
		tagId: v.optional(v.string())
	},
	returns: v.object({
		customers: v.array(customerSummaryValue),
		totalCount: v.number(),
		continueCursor: v.string(),
		isDone: v.boolean()
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Workspace not found.'
			});
		}

		const searchQuery = normalizedMatchValue(args.searchQuery);
		const pageSize = Math.max(1, Math.floor(args.paginationOpts.numItems));

		if (args.tagId) {
			const tagId = ctx.db.normalizeId('workspace_tags', args.tagId);
			const tag = tagId ? await getWorkspaceTag(ctx, args.workspaceId, tagId) : null;
			if (!tag) {
				return { customers: [], totalCount: 0, continueCursor: '', isDone: true };
			}

			// Tagged customers are listed newest-tagged first. A text search is
			// applied to each page in memory, so filtered pages can be shorter.
			const assignmentPage = await ctx.db
				.query('customer_tags')
				.withIndex('by_tagId', (q) => q.eq('tagId', tag._id))
				.order('desc')
				.paginate({ ...args.paginationOpts, numItems: pageSize });
			const taggedCustomers = await Promise.all(
				assignmentPage.page.map((row) => ctx.db.get(row.customerId))
			);
			const matches = taggedCustomers.filter(
				(customer): customer is Doc<'customers'> =>
					customer !== null &&
					customer.workspaceId === args.workspaceId &&
					(!searchQuery || matchesSearchText(customer.searchText, searchQuery))
			);

			return {
				customers: await serializeCustomers(ctx, args.workspaceId, matches),
				totalCount: tag.customerCount,
				continueCursor: assignmentPage.continueCursor,
				isDone: assignmentPage.isDone
			};
		}

		if (!searchQuery) {
			const customerPage = await ctx.db
				.query('customers')
				.withIndex('by_workspaceId_and_lastSeenAt', (q) => q.eq('workspaceId', args.workspaceId))
				.order('desc')
				.paginate({ ...args.paginationOpts, numItems: pageSize });

			return {
				customers: await serializeCustomers(ctx, args.workspaceId, customerPage.page),
				totalCount: workspace.customerCount,
				continueCursor: customerPage.continueCursor,
				isDone: customerPage.isDone
			};
		}

		const customerPage = await ctx.db
			.query('customers')
			.withSearchIndex('search_customerText', (q) =>
				q.search('searchText', searchQuery).eq('workspaceId', args.workspaceId)
			)
			.paginate({ ...args.paginationOpts, numItems: pageSize });

		return {
			customers: await serializeCustomers(ctx, args.workspaceId, customerPage.page),
			totalCount: workspace.customerCount,
			continueCursor: customerPage.continueCursor,
			isDone: customerPage.isDone
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
			visits: v.array(customerVisitValue),
			hasMore: v.boolean()
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

		for (const submission of submissions) {
			if (submission.workspaceId !== args.workspaceId) {
				throw new ConvexError({
					code: 'data_integrity_error',
					message: 'Submission workspaceId mismatch.',
					submissionId: submission._id,
					workspaceId: submission.workspaceId,
					expectedWorkspaceId: args.workspaceId
				});
			}
		}

		return {
			customer: (await serializeCustomers(ctx, args.workspaceId, [customer]))[0],
			visits: submissions.map((submission) => ({
				submissionId: submission._id,
				signerName: submission.signerName,
				signerEmail: submission.signerEmail,
				submittedAt: submission.submittedAt,
				minorCount: submission.minors.length,
				booking: submission.bookingSnapshot ?? null
			})),
			hasMore:
				submissions.length === MAX_CUSTOMER_VISITS && customer.visitCount > MAX_CUSTOMER_VISITS
		};
	}
});
