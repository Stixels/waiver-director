import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import {
	MAX_TAGS_PER_RECORD,
	MAX_TAGS_PER_WORKSPACE,
	normalizeTagName,
	requireWorkspaceTag,
	serializeTag,
	tagColorValidator,
	tagSummaryValue,
	TAG_COLORS,
	validateTagName,
	type TagColor
} from './lib/tags';
import { requireWorkspaceMember, requireWorkspaceOwner } from './lib/waivers';

const TAG_CLEANUP_BATCH = 200;

const workspaceTagValue = v.object({
	tagId: v.id('workspace_tags'),
	name: v.string(),
	color: tagColorValidator,
	customerCount: v.number(),
	submissionCount: v.number()
});

export const listWorkspaceTags = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.array(workspaceTagValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const tags = await ctx.db
			.query('workspace_tags')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(MAX_TAGS_PER_WORKSPACE);

		return tags
			.map((tag) => ({
				...serializeTag(tag),
				customerCount: tag.customerCount,
				submissionCount: tag.submissionCount
			}))
			.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
	}
});

export const createTag = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		name: v.string(),
		color: v.optional(tagColorValidator)
	},
	returns: tagSummaryValue,
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceMember(ctx, args.workspaceId);
		const name = validateTagName(args.name);
		const normalizedName = normalizeTagName(name);

		const existing = await ctx.db
			.query('workspace_tags')
			.withIndex('by_workspaceId_and_normalizedName', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('normalizedName', normalizedName)
			)
			.first();
		if (existing) {
			return serializeTag(existing);
		}

		const tags = await ctx.db
			.query('workspace_tags')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.take(MAX_TAGS_PER_WORKSPACE);
		if (tags.length >= MAX_TAGS_PER_WORKSPACE) {
			throw new ConvexError({
				code: 'tag_limit_reached',
				message: `A workspace can have at most ${MAX_TAGS_PER_WORKSPACE} tags.`
			});
		}

		const color: TagColor = args.color ?? TAG_COLORS[tags.length % TAG_COLORS.length];
		const tagId = await ctx.db.insert('workspace_tags', {
			workspaceId: args.workspaceId,
			name,
			normalizedName,
			color,
			customerCount: 0,
			submissionCount: 0,
			createdByUserId: user._id,
			createdAt: Date.now()
		});

		return { tagId, name, color };
	}
});

export const updateTag = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		tagId: v.id('workspace_tags'),
		name: v.optional(v.string()),
		color: v.optional(tagColorValidator)
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'edit tags');
		const tag = await requireWorkspaceTag(ctx, args.workspaceId, args.tagId);

		const patch: { name?: string; normalizedName?: string; color?: TagColor } = {};
		if (args.name !== undefined) {
			const name = validateTagName(args.name);
			const normalizedName = normalizeTagName(name);
			if (normalizedName !== tag.normalizedName) {
				const duplicate = await ctx.db
					.query('workspace_tags')
					.withIndex('by_workspaceId_and_normalizedName', (q) =>
						q.eq('workspaceId', args.workspaceId).eq('normalizedName', normalizedName)
					)
					.first();
				if (duplicate && duplicate._id !== tag._id) {
					throw new ConvexError({
						code: 'duplicate_tag',
						message: 'A tag with that name already exists.'
					});
				}
			}
			patch.name = name;
			patch.normalizedName = normalizedName;
		}
		if (args.color !== undefined) {
			patch.color = args.color;
		}

		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(tag._id, patch);
		}
		return null;
	}
});

export const deleteTag = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		tagId: v.id('workspace_tags')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'delete tags');
		const tag = await requireWorkspaceTag(ctx, args.workspaceId, args.tagId);

		// Remove the tag right away; queries skip assignments whose tag no longer
		// exists, so the assignment rows can be cleaned up in the background.
		await ctx.db.delete(tag._id);
		await ctx.scheduler.runAfter(0, internal.tags.cleanupDeletedTagAssignments, {
			tagId: tag._id
		});
		return null;
	}
});

export const cleanupDeletedTagAssignments = internalMutation({
	args: {
		tagId: v.id('workspace_tags')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		if (await ctx.db.get(args.tagId)) {
			return null;
		}

		const [customerRows, submissionRows] = await Promise.all([
			ctx.db
				.query('customer_tags')
				.withIndex('by_tagId', (q) => q.eq('tagId', args.tagId))
				.take(TAG_CLEANUP_BATCH),
			ctx.db
				.query('submission_tags')
				.withIndex('by_tagId', (q) => q.eq('tagId', args.tagId))
				.take(TAG_CLEANUP_BATCH)
		]);

		for (const row of customerRows) {
			await ctx.db.delete(row._id);
		}
		for (const row of submissionRows) {
			await ctx.db.delete(row._id);
		}

		if (customerRows.length === TAG_CLEANUP_BATCH || submissionRows.length === TAG_CLEANUP_BATCH) {
			await ctx.scheduler.runAfter(0, internal.tags.cleanupDeletedTagAssignments, {
				tagId: args.tagId
			});
		}
		return null;
	}
});

export const setCustomerTag = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		customerId: v.id('customers'),
		tagId: v.id('workspace_tags'),
		applied: v.boolean()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceMember(ctx, args.workspaceId);
		const tag = await requireWorkspaceTag(ctx, args.workspaceId, args.tagId);
		const customer = await ctx.db.get(args.customerId);
		if (!customer || customer.workspaceId !== args.workspaceId) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Customer not found.'
			});
		}

		const existing = await ctx.db
			.query('customer_tags')
			.withIndex('by_customerId_and_tagId', (q) =>
				q.eq('customerId', customer._id).eq('tagId', tag._id)
			)
			.first();

		if (args.applied) {
			if (existing) return null;
			const current = await ctx.db
				.query('customer_tags')
				.withIndex('by_customerId_and_tagId', (q) => q.eq('customerId', customer._id))
				.take(MAX_TAGS_PER_RECORD);
			if (current.length >= MAX_TAGS_PER_RECORD) {
				throw new ConvexError({
					code: 'tag_limit_reached',
					message: `A customer can have at most ${MAX_TAGS_PER_RECORD} tags.`
				});
			}
			await ctx.db.insert('customer_tags', {
				workspaceId: args.workspaceId,
				tagId: tag._id,
				customerId: customer._id,
				createdByUserId: user._id,
				createdAt: Date.now()
			});
			await ctx.db.patch(tag._id, { customerCount: tag.customerCount + 1 });
			return null;
		}

		if (!existing) return null;
		await ctx.db.delete(existing._id);
		await ctx.db.patch(tag._id, { customerCount: Math.max(0, tag.customerCount - 1) });
		return null;
	}
});

export const setSubmissionTag = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions'),
		tagId: v.id('workspace_tags'),
		applied: v.boolean()
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceMember(ctx, args.workspaceId);
		const tag = await requireWorkspaceTag(ctx, args.workspaceId, args.tagId);
		const submission = await ctx.db.get(args.submissionId);
		if (!submission || submission.workspaceId !== args.workspaceId) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Submission not found.'
			});
		}

		const existing = await ctx.db
			.query('submission_tags')
			.withIndex('by_submissionId_and_tagId', (q) =>
				q.eq('submissionId', submission._id).eq('tagId', tag._id)
			)
			.first();

		if (args.applied) {
			if (existing) return null;
			const current = await ctx.db
				.query('submission_tags')
				.withIndex('by_submissionId_and_tagId', (q) => q.eq('submissionId', submission._id))
				.take(MAX_TAGS_PER_RECORD);
			if (current.length >= MAX_TAGS_PER_RECORD) {
				throw new ConvexError({
					code: 'tag_limit_reached',
					message: `A submission can have at most ${MAX_TAGS_PER_RECORD} tags.`
				});
			}
			await ctx.db.insert('submission_tags', {
				workspaceId: args.workspaceId,
				tagId: tag._id,
				submissionId: submission._id,
				createdByUserId: user._id,
				createdAt: Date.now()
			});
			await ctx.db.patch(tag._id, { submissionCount: tag.submissionCount + 1 });
			return null;
		}

		if (!existing) return null;
		await ctx.db.delete(existing._id);
		await ctx.db.patch(tag._id, { submissionCount: Math.max(0, tag.submissionCount - 1) });
		return null;
	}
});
