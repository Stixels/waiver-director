import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { serializeCustomer, serializeSubmission, serializeWorkspace } from './lib/publicApi';

// Internal, workspace-scoped reads for the public HTTP API. The workspace id always comes from
// the authenticated API key, never from the request.

const pageArgs = {
	workspaceId: v.id('workspaces'),
	numItems: v.number(),
	cursor: v.union(v.string(), v.null())
};

async function versionsById(ctx: QueryCtx, submissions: Doc<'waiver_submissions'>[]) {
	const ids = [...new Set(submissions.map((submission) => submission.versionId))];
	const versions = await Promise.all(ids.map((id) => ctx.db.get(id)));
	const map = new Map<Id<'waiver_versions'>, Doc<'waiver_versions'>>();
	for (const version of versions) {
		if (version) map.set(version._id, version);
	}
	return map;
}

export const getWorkspace = internalQuery({
	args: { workspaceId: v.id('workspaces') },
	returns: v.any(),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		return workspace ? serializeWorkspace(workspace) : null;
	}
});

export const listSubmissions = internalQuery({
	args: pageArgs,
	returns: v.any(),
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('waiver_submissions')
			.withIndex('by_workspaceId_and_submittedAt', (q) => q.eq('workspaceId', args.workspaceId))
			.order('desc')
			.paginate({ numItems: args.numItems, cursor: args.cursor });
		const versions = await versionsById(ctx, result.page);
		return {
			data: result.page.map((submission) =>
				serializeSubmission(submission, versions.get(submission.versionId) ?? null)
			),
			hasMore: !result.isDone,
			nextCursor: result.isDone ? null : result.continueCursor
		};
	}
});

export const getSubmission = internalQuery({
	args: { workspaceId: v.id('workspaces'), submissionId: v.string() },
	returns: v.any(),
	handler: async (ctx, args) => {
		const submissionId = ctx.db.normalizeId('waiver_submissions', args.submissionId);
		if (!submissionId) return null;
		const submission = await ctx.db.get(submissionId);
		if (!submission || submission.workspaceId !== args.workspaceId) return null;
		const version = await ctx.db.get(submission.versionId);
		return serializeSubmission(submission, version);
	}
});

export const listCustomers = internalQuery({
	args: pageArgs,
	returns: v.any(),
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('customers')
			// Creation order is stable; lastSeenAt changes on every visit and would skip rows mid-export.
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.order('desc')
			.paginate({ numItems: args.numItems, cursor: args.cursor });
		return {
			data: result.page.map(serializeCustomer),
			hasMore: !result.isDone,
			nextCursor: result.isDone ? null : result.continueCursor
		};
	}
});
