import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

export const TAG_COLORS = [
	'gray',
	'red',
	'orange',
	'amber',
	'green',
	'teal',
	'blue',
	'violet',
	'pink'
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const tagColorValidator = v.union(
	v.literal('gray'),
	v.literal('red'),
	v.literal('orange'),
	v.literal('amber'),
	v.literal('green'),
	v.literal('teal'),
	v.literal('blue'),
	v.literal('violet'),
	v.literal('pink')
);

export const MAX_TAGS_PER_WORKSPACE = 100;
export const MAX_TAGS_PER_RECORD = 20;
export const MAX_TAG_NAME_LENGTH = 32;

export const tagSummaryValue = v.object({
	tagId: v.id('workspace_tags'),
	name: v.string(),
	color: tagColorValidator
});

export type TagSummary = {
	tagId: Id<'workspace_tags'>;
	name: string;
	color: TagColor;
};

export function cleanTagName(name: string) {
	return name.trim().replace(/\s+/g, ' ');
}

export function normalizeTagName(name: string) {
	return cleanTagName(name).toLowerCase();
}

export function validateTagName(name: string) {
	const cleaned = cleanTagName(name);
	if (!cleaned) {
		throw new ConvexError({
			code: 'invalid_tag_name',
			message: 'Tag name is required.'
		});
	}
	if (cleaned.length > MAX_TAG_NAME_LENGTH) {
		throw new ConvexError({
			code: 'invalid_tag_name',
			message: `Tag names can be at most ${MAX_TAG_NAME_LENGTH} characters.`
		});
	}
	return cleaned;
}

export function serializeTag(tag: Doc<'workspace_tags'>): TagSummary {
	return {
		tagId: tag._id,
		name: tag.name,
		color: tag.color
	};
}

export function sortTags(tags: TagSummary[]) {
	return [...tags].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export async function loadWorkspaceTagMap(ctx: QueryCtx, workspaceId: Id<'workspaces'>) {
	const tags = await ctx.db
		.query('workspace_tags')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.take(MAX_TAGS_PER_WORKSPACE);
	return new Map(tags.map((tag) => [tag._id, tag]));
}

/**
 * Loads a tag and confirms it belongs to the workspace. Returns null when the
 * tag does not exist or belongs to a different workspace.
 */
export async function getWorkspaceTag(
	ctx: QueryCtx,
	workspaceId: Id<'workspaces'>,
	tagId: Id<'workspace_tags'>
) {
	const tag = await ctx.db.get(tagId);
	if (!tag || tag.workspaceId !== workspaceId) return null;
	return tag;
}

export async function requireWorkspaceTag(
	ctx: QueryCtx,
	workspaceId: Id<'workspaces'>,
	tagId: Id<'workspace_tags'>
) {
	const tag = await getWorkspaceTag(ctx, workspaceId, tagId);
	if (!tag) {
		throw new ConvexError({
			code: 'not_found',
			message: 'Tag not found.'
		});
	}
	return tag;
}

export async function loadCustomerTags(
	ctx: QueryCtx,
	tagMap: Map<Id<'workspace_tags'>, Doc<'workspace_tags'>>,
	customerId: Id<'customers'>
): Promise<TagSummary[]> {
	const rows = await ctx.db
		.query('customer_tags')
		.withIndex('by_customerId_and_tagId', (q) => q.eq('customerId', customerId))
		.take(MAX_TAGS_PER_RECORD);
	return resolveTags(tagMap, rows);
}

export async function loadSubmissionTags(
	ctx: QueryCtx,
	tagMap: Map<Id<'workspace_tags'>, Doc<'workspace_tags'>>,
	submissionId: Id<'waiver_submissions'>
): Promise<TagSummary[]> {
	const rows = await ctx.db
		.query('submission_tags')
		.withIndex('by_submissionId_and_tagId', (q) => q.eq('submissionId', submissionId))
		.take(MAX_TAGS_PER_RECORD);
	return resolveTags(tagMap, rows);
}

function resolveTags(
	tagMap: Map<Id<'workspace_tags'>, Doc<'workspace_tags'>>,
	rows: Array<{ tagId: Id<'workspace_tags'> }>
) {
	const tags: TagSummary[] = [];
	for (const row of rows) {
		const tag = tagMap.get(row.tagId);
		if (tag) tags.push(serializeTag(tag));
	}
	return sortTags(tags);
}

/** Matches the in-memory search used when a tag filter and a text search are combined. */
export function matchesSearchText(searchText: string, searchQuery: string) {
	const haystack = searchText.toLowerCase();
	return searchQuery
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((term) => haystack.includes(term));
}
