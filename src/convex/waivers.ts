import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { bookingSnapshot, bookingSnapshotValidator } from './lib/bookings';
import { requireWorkspaceFeature, workspaceHasBillingFeature } from './lib/billing';
import { upsertSignerCustomer } from './lib/customers';
import { submissionSearchText } from './lib/submissions';
import { getOwnedWorkspaceLogoUrl } from './lib/workspaces';
import { marketingConsentLabel } from './lib/marketing';
import { sanitizeRichTextHtml } from '../lib/utils/rich-text';
import {
	assertWorkspaceRecord,
	minorInputValidator,
	createDefaultWaiverDefinition,
	normalizePublicSlug,
	normalizeWaiverDefinition,
	requireWorkspaceMember,
	requireWorkspaceOwner,
	validateMinors,
	validateSubmissionAnswers,
	waiverDefinitionsEqual,
	waiverAnswerValueValidator,
	waiverFieldValidator,
	waiverDefinitionValidator,
	waiverThemeValidator
} from './lib/waivers';
import {
	MAX_ACTIVITY_NAME_LENGTH,
	MAX_WAIVERS_PER_REQUIREMENT,
	MAX_WAIVERS_PER_WORKSPACE,
	isWaiverActive,
	normalizeActivityKey,
	pickDefaultWaiver,
	resolveRequiredWaiverIds,
	waiverSlugBase,
	waiverSlugCandidate
} from './lib/waiverRequirements';

type FunctionCtx = QueryCtx | MutationCtx;

const workspaceWaiverValue = v.object({
	waiverId: v.id('workspace_waivers'),
	publicSlug: v.string(),
	title: v.string(),
	introCopy: v.string(),
	theme: waiverThemeValidator,
	fields: v.array(waiverFieldValidator),
	publishedVersionId: v.union(v.id('waiver_versions'), v.null()),
	hasUnpublishedChanges: v.boolean(),
	isDefault: v.boolean()
});

const workspaceWaiverListItemValue = v.object({
	waiverId: v.id('workspace_waivers'),
	publicSlug: v.string(),
	title: v.string(),
	isDefault: v.boolean(),
	isPublished: v.boolean(),
	createdAt: v.number()
});

const requiredWaiverLinkValue = v.object({
	slug: v.string(),
	title: v.string(),
	isCurrent: v.boolean()
});

const waiverVersionPreviewValue = v.object({
	versionId: v.id('waiver_versions'),
	versionNumber: v.number(),
	title: v.string(),
	introCopy: v.string(),
	theme: waiverThemeValidator,
	fields: v.array(waiverFieldValidator),
	workspaceName: v.string(),
	publishedAt: v.number(),
	isActivePublic: v.boolean()
});

const publicWaiverValue = v.object({
	slug: v.string(),
	versionId: v.id('waiver_versions'),
	workspaceName: v.string(),
	workspaceLogoUrl: v.union(v.string(), v.null()),
	title: v.string(),
	introCopy: v.string(),
	theme: waiverThemeValidator,
	fields: v.array(waiverFieldValidator),
	marketingOptIn: v.union(
		v.null(),
		v.object({ provider: v.literal('mailchimp'), label: v.string() })
	)
});

const publicBookingWaiverValue = v.object({
	slug: v.string(),
	versionId: v.id('waiver_versions'),
	workspaceName: v.string(),
	workspaceLogoUrl: v.union(v.string(), v.null()),
	title: v.string(),
	introCopy: v.string(),
	theme: waiverThemeValidator,
	fields: v.array(waiverFieldValidator),
	marketingOptIn: v.union(
		v.null(),
		v.object({ provider: v.literal('mailchimp'), label: v.string() })
	),
	booking: v.object({
		lookupToken: v.string(),
		activityName: v.string(),
		startTime: v.union(v.string(), v.null()),
		endTime: v.union(v.string(), v.null()),
		leadCustomerName: v.union(v.string(), v.null()),
		participantCount: v.number(),
		signedCount: v.number()
	}),
	// Every published waiver this booking's activity requires, in order. The
	// first entry is the primary waiver that counts toward the waiver gap.
	requiredWaivers: v.array(requiredWaiverLinkValue)
});

async function listWorkspaceWaiverRecords(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	// Archived waivers stay in the table for signed-record integrity, so allow
	// headroom beyond the active-waiver limit.
	return await ctx.db
		.query('workspace_waivers')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.take(MAX_WAIVERS_PER_WORKSPACE * 4);
}

async function getDefaultWaiverRecord(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	return pickDefaultWaiver(await listWorkspaceWaiverRecords(ctx, workspaceId));
}

async function getWaiverRecordForMember(
	ctx: FunctionCtx,
	workspaceId: Id<'workspaces'>,
	waiverId: Id<'workspace_waivers'> | undefined
) {
	if (!waiverId) {
		return await getDefaultWaiverRecord(ctx, workspaceId);
	}
	const waiver = await ctx.db.get(waiverId);
	if (!waiver || waiver.workspaceId !== workspaceId || !isWaiverActive(waiver)) {
		// A stale link to an archived or deleted waiver opens the default instead.
		return await getDefaultWaiverRecord(ctx, workspaceId);
	}
	return waiver;
}

/**
 * Resolves the waivers a booking requires: an activity-specific requirement
 * when one matches the booking's activity, otherwise the default waiver.
 */
async function getBookingRequiredWaivers(ctx: FunctionCtx, booking: Doc<'bookings'>) {
	const [waivers, requirement] = await Promise.all([
		listWorkspaceWaiverRecords(ctx, booking.workspaceId),
		ctx.db
			.query('activity_waiver_requirements')
			.withIndex('by_workspaceId_and_activityKey', (q) =>
				q
					.eq('workspaceId', booking.workspaceId)
					.eq('activityKey', normalizeActivityKey(booking.activityName))
			)
			.unique()
	]);
	const activeWaivers = waivers.filter(isWaiverActive);
	const byId = new Map(activeWaivers.map((waiver) => [waiver._id, waiver]));
	const requiredIds = resolveRequiredWaiverIds({
		defaultWaiverId: pickDefaultWaiver(activeWaivers)?._id ?? null,
		requirementWaiverIds: requirement?.waiverIds ?? null,
		activeWaiverIds: new Set(byId.keys())
	});

	return requiredIds.flatMap((waiverId) => {
		const waiver = byId.get(waiverId);
		return waiver ? [waiver] : [];
	});
}

async function getPublicWaiverRecordBySlug(ctx: FunctionCtx, slug: string) {
	const waiver = await ctx.db
		.query('workspace_waivers')
		.withIndex('by_publicSlug', (q) => q.eq('publicSlug', slug))
		.unique();
	if (!waiver || !waiver.publishedVersionId || !isWaiverActive(waiver)) {
		return null;
	}
	return waiver;
}

async function generateWaiverPublicSlug(
	ctx: MutationCtx,
	workspaceSlug: string,
	title: string
): Promise<string> {
	const base = normalizePublicSlug(waiverSlugBase(workspaceSlug, title));
	for (let attempt = 1; attempt <= 50; attempt++) {
		const candidate = waiverSlugCandidate(base, attempt);
		const existing = await ctx.db
			.query('workspace_waivers')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', candidate))
			.first();
		if (!existing) return candidate;
	}
	throw new ConvexError({
		code: 'internal_error',
		message: 'Unable to generate a unique waiver link. Try a different title.'
	});
}

async function getNextVersionNumber(ctx: MutationCtx, waiverId: Id<'workspace_waivers'>) {
	const latest = await ctx.db
		.query('waiver_versions')
		.withIndex('by_waiverId_and_versionNumber', (q) => q.eq('waiverId', waiverId))
		.order('desc')
		.first();

	return latest ? latest.versionNumber + 1 : 1;
}

async function waiverHasUnpublishedChanges(ctx: FunctionCtx, waiver: Doc<'workspace_waivers'>) {
	const publishedVersionId = waiver.publishedVersionId ?? null;
	if (!publishedVersionId) {
		return false;
	}

	const version = await ctx.db.get(publishedVersionId);
	if (!version || version.waiverId !== waiver._id) {
		return true;
	}

	return !waiverDefinitionsEqual(
		{
			title: waiver.title,
			introCopy: waiver.introCopy,
			theme: waiver.theme,
			fields: waiver.fields
		},
		{
			title: version.title,
			introCopy: version.introCopy,
			theme: version.theme,
			fields: version.fields
		}
	);
}

async function workspaceWaiverSummary(
	ctx: FunctionCtx,
	waiver: Doc<'workspace_waivers'>,
	defaultWaiverId: Id<'workspace_waivers'> | null
) {
	const hasUnpublishedChanges = await waiverHasUnpublishedChanges(ctx, waiver);

	return {
		waiverId: waiver._id,
		publicSlug: waiver.publicSlug,
		title: waiver.title,
		introCopy: waiver.introCopy,
		theme: waiver.theme ?? 'dark',
		fields: waiver.fields,
		publishedVersionId: waiver.publishedVersionId ?? null,
		hasUnpublishedChanges,
		isDefault: waiver._id === defaultWaiverId
	};
}

export const getWorkspaceWaiver = query({
	args: {
		workspaceId: v.id('workspaces'),
		// Omit to get the workspace's default waiver.
		waiverId: v.optional(v.id('workspace_waivers'))
	},
	returns: workspaceWaiverValue,
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [waiver, defaultWaiver] = await Promise.all([
			getWaiverRecordForMember(ctx, args.workspaceId, args.waiverId),
			getDefaultWaiverRecord(ctx, args.workspaceId)
		]);
		if (!waiver) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Workspace waiver not found.'
			});
		}

		return await workspaceWaiverSummary(ctx, waiver, defaultWaiver?._id ?? null);
	}
});

export const listWorkspaceWaivers = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.array(workspaceWaiverListItemValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const waivers = (await listWorkspaceWaiverRecords(ctx, args.workspaceId)).filter(
			isWaiverActive
		);
		const defaultWaiverId = pickDefaultWaiver(waivers)?._id ?? null;

		return waivers
			.map((waiver) => ({
				waiverId: waiver._id,
				publicSlug: waiver.publicSlug,
				title: waiver.title,
				isDefault: waiver._id === defaultWaiverId,
				isPublished: Boolean(waiver.publishedVersionId),
				createdAt: waiver._creationTime
			}))
			.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt - b.createdAt);
	}
});

export const createWorkspaceWaiver = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		title: v.string()
	},
	returns: v.object({
		waiverId: v.id('workspace_waivers')
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'create waivers');

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}

		const waivers = await listWorkspaceWaiverRecords(ctx, args.workspaceId);
		const activeWaivers = waivers.filter(isWaiverActive);
		if (activeWaivers.length >= MAX_WAIVERS_PER_WORKSPACE) {
			throw new ConvexError({
				code: 'limit_reached',
				message: `A workspace can have up to ${MAX_WAIVERS_PER_WORKSPACE} active waivers. Archive one to add another.`
			});
		}

		// Reuse the definition validator so new waivers obey the same title rules.
		const definition = normalizeWaiverDefinition({
			...createDefaultWaiverDefinition(workspace.name),
			title: args.title
		});
		const publicSlug = await generateWaiverPublicSlug(ctx, workspace.slug, definition.title);

		const waiverId = await ctx.db.insert('workspace_waivers', {
			workspaceId: args.workspaceId,
			publicSlug,
			isDefault: activeWaivers.length === 0,
			status: 'active',
			title: definition.title,
			introCopy: definition.introCopy,
			theme: definition.theme ?? 'dark',
			fields: definition.fields
		});

		return { waiverId };
	}
});

export const setDefaultWorkspaceWaiver = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		waiverId: v.id('workspace_waivers')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change the default waiver');

		const waiver = assertWorkspaceRecord(
			await ctx.db.get(args.waiverId),
			args.workspaceId,
			'Workspace waiver not found.'
		);
		if (!isWaiverActive(waiver)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Archived waivers cannot be the default.'
			});
		}

		const waivers = await listWorkspaceWaiverRecords(ctx, args.workspaceId);
		for (const other of waivers) {
			const shouldBeDefault = other._id === waiver._id;
			if ((other.isDefault === true) !== shouldBeDefault) {
				await ctx.db.patch(other._id, { isDefault: shouldBeDefault });
			}
		}

		return null;
	}
});

export const archiveWorkspaceWaiver = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		waiverId: v.id('workspace_waivers')
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'archive waivers');

		const waiver = assertWorkspaceRecord(
			await ctx.db.get(args.waiverId),
			args.workspaceId,
			'Workspace waiver not found.'
		);
		if (!isWaiverActive(waiver)) {
			return null;
		}

		const defaultWaiver = await getDefaultWaiverRecord(ctx, args.workspaceId);
		if (defaultWaiver?._id === waiver._id) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Make another waiver the default before archiving this one.'
			});
		}

		// Versions and signed submissions are kept; archiving only takes the
		// waiver out of the builder, public links and activity requirements.
		await ctx.db.patch(waiver._id, {
			status: 'archived',
			isDefault: false,
			archivedAt: Date.now()
		});

		return null;
	}
});

const activityRequirementValue = v.object({
	activityKey: v.string(),
	activityName: v.string(),
	// Null means the activity uses the default waiver requirement.
	waiverIds: v.union(v.null(), v.array(v.id('workspace_waivers'))),
	recentBookingCount: v.number()
});

export const listActivityWaiverRequirements = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.array(activityRequirementValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [requirements, recentBookings, waivers] = await Promise.all([
			ctx.db
				.query('activity_waiver_requirements')
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
				.take(500),
			ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_startAt', (q) => q.eq('workspaceId', args.workspaceId))
				.order('desc')
				.take(500),
			listWorkspaceWaiverRecords(ctx, args.workspaceId)
		]);
		const activeWaiverIds = new Set(waivers.filter(isWaiverActive).map((waiver) => waiver._id));

		const rows = new Map<
			string,
			{
				activityKey: string;
				activityName: string;
				waiverIds: Id<'workspace_waivers'>[] | null;
				recentBookingCount: number;
			}
		>();
		for (const booking of recentBookings) {
			const activityKey = normalizeActivityKey(booking.activityName);
			if (!activityKey) continue;
			const row = rows.get(activityKey);
			if (row) {
				row.recentBookingCount += 1;
			} else {
				rows.set(activityKey, {
					activityKey,
					activityName: booking.activityName.trim(),
					waiverIds: null,
					recentBookingCount: 1
				});
			}
		}
		for (const requirement of requirements) {
			const waiverIds = requirement.waiverIds.filter((waiverId) => activeWaiverIds.has(waiverId));
			const row = rows.get(requirement.activityKey);
			if (row) {
				row.waiverIds = waiverIds;
			} else {
				rows.set(requirement.activityKey, {
					activityKey: requirement.activityKey,
					activityName: requirement.activityName,
					waiverIds,
					recentBookingCount: 0
				});
			}
		}

		return [...rows.values()].sort((a, b) => a.activityName.localeCompare(b.activityName));
	}
});

export const setActivityWaiverRequirement = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		activityName: v.string(),
		// An empty list removes the activity-specific requirement so the activity
		// goes back to the default waiver.
		waiverIds: v.array(v.id('workspace_waivers'))
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change waiver requirements');

		const activityName = args.activityName.trim().replace(/\s+/g, ' ');
		const activityKey = normalizeActivityKey(activityName);
		if (!activityKey || activityName.length > MAX_ACTIVITY_NAME_LENGTH) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `Activity name must be between 1 and ${MAX_ACTIVITY_NAME_LENGTH} characters.`
			});
		}

		const waiverIds = [...new Set(args.waiverIds)];
		if (waiverIds.length > MAX_WAIVERS_PER_REQUIREMENT) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `An activity can require up to ${MAX_WAIVERS_PER_REQUIREMENT} waivers.`
			});
		}
		for (const waiverId of waiverIds) {
			const waiver = await ctx.db.get(waiverId);
			if (!waiver || waiver.workspaceId !== args.workspaceId || !isWaiverActive(waiver)) {
				throw new ConvexError({
					code: 'not_found',
					message: 'One of the selected waivers was not found.'
				});
			}
		}

		const existing = await ctx.db
			.query('activity_waiver_requirements')
			.withIndex('by_workspaceId_and_activityKey', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('activityKey', activityKey)
			)
			.unique();

		if (waiverIds.length === 0) {
			if (existing) await ctx.db.delete(existing._id);
			return null;
		}

		if (existing) {
			await ctx.db.patch(existing._id, { activityName, waiverIds, updatedAt: Date.now() });
		} else {
			await ctx.db.insert('activity_waiver_requirements', {
				workspaceId: args.workspaceId,
				activityKey,
				activityName,
				waiverIds,
				updatedAt: Date.now()
			});
		}

		return null;
	}
});

export const updateWorkspaceWaiver = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		waiverId: v.id('workspace_waivers'),
		definition: waiverDefinitionValidator
	},
	returns: v.object({
		waiverId: v.id('workspace_waivers')
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const waiver = assertWorkspaceRecord(
			await ctx.db.get(args.waiverId),
			args.workspaceId,
			'Workspace waiver not found.'
		);

		const definition = normalizeWaiverDefinition(args.definition);

		await ctx.db.patch(waiver._id, {
			title: definition.title,
			introCopy: definition.introCopy,
			theme: definition.theme ?? 'dark',
			fields: definition.fields
		});

		return { waiverId: waiver._id };
	}
});

export const publishWorkspaceWaiver = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		waiverId: v.id('workspace_waivers')
	},
	returns: v.object({
		versionId: v.id('waiver_versions')
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		await requireWorkspaceFeature(ctx, args.workspaceId, 'waiver_publishing');

		const waiver = assertWorkspaceRecord(
			await ctx.db.get(args.waiverId),
			args.workspaceId,
			'Workspace waiver not found.'
		);

		if (!isWaiverActive(waiver)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Archived waivers cannot be published.'
			});
		}

		const definition = normalizeWaiverDefinition({
			title: waiver.title,
			introCopy: waiver.introCopy,
			theme: waiver.theme,
			fields: waiver.fields
		});
		const publishedVersionId = waiver.publishedVersionId ?? null;
		if (publishedVersionId && !(await waiverHasUnpublishedChanges(ctx, waiver))) {
			return {
				versionId: publishedVersionId
			};
		}

		const versionId = await ctx.db.insert('waiver_versions', {
			workspaceId: args.workspaceId,
			waiverId: waiver._id,
			versionNumber: await getNextVersionNumber(ctx, waiver._id),
			title: definition.title,
			introCopy: definition.introCopy,
			theme: definition.theme ?? 'dark',
			fields: definition.fields,
			publishedAt: Date.now()
		});

		await ctx.db.patch(waiver._id, {
			publishedVersionId: versionId
		});

		return { versionId };
	}
});

export const listWaiverVersions = query({
	args: {
		workspaceId: v.id('workspaces'),
		// Omit to list the default waiver's versions.
		waiverId: v.optional(v.id('workspace_waivers'))
	},
	returns: v.array(waiverVersionPreviewValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [waiver, workspace] = await Promise.all([
			getWaiverRecordForMember(ctx, args.workspaceId, args.waiverId),
			ctx.db.get(args.workspaceId)
		]);

		if (!waiver) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Waiver not found.'
			});
		}
		if (!workspace) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Workspace not found.'
			});
		}

		const versions = await ctx.db
			.query('waiver_versions')
			.withIndex('by_waiverId', (q) => q.eq('waiverId', waiver._id))
			.order('desc')
			.take(50);

		return versions.map((version) => ({
			versionId: version._id,
			versionNumber: version.versionNumber,
			title: version.title,
			introCopy: version.introCopy,
			theme: version.theme ?? 'dark',
			fields: version.fields,
			workspaceName: workspace.name,
			publishedAt: version.publishedAt,
			isActivePublic: waiver.publishedVersionId === version._id
		}));
	}
});

export const getSubmission = query({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions')
	},
	returns: v.union(
		v.null(),
		v.object({
			submissionId: v.id('waiver_submissions'),
			customerId: v.union(v.id('customers'), v.null()),
			bookingId: v.union(v.id('bookings'), v.null()),
			followUpId: v.union(v.id('email_follow_ups'), v.null()),
			signerName: v.string(),
			signerEmail: v.string(),
			signerDateOfBirth: v.string(),
			signatureDataUrl: v.string(),
			answers: v.record(v.string(), waiverAnswerValueValidator),
			submittedAt: v.number(),
			workspaceName: v.string(),
			waiver: waiverDefinitionValidator,
			minors: v.array(v.string()),
			booking: v.union(v.null(), bookingSnapshotValidator),
			marketingConsent: v.boolean(),
			marketingConsentLabel: v.union(v.string(), v.null())
		})
	),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const submission = await ctx.db.get(args.submissionId);
		if (!submission || submission.workspaceId !== args.workspaceId) {
			return null;
		}

		const [version, workspace] = await Promise.all([
			ctx.db.get(submission.versionId),
			ctx.db.get(args.workspaceId)
		]);
		if (!version || !workspace) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Signed waiver version not found.'
			});
		}

		const followUp = await ctx.db
			.query('email_follow_ups')
			.withIndex('by_submissionId', (q) => q.eq('submissionId', submission._id))
			.first();

		if (followUp && followUp.workspaceId !== args.workspaceId) {
			throw new ConvexError({
				code: 'data_integrity_error',
				message: 'Follow-up workspaceId mismatch.',
				followUpId: followUp._id,
				workspaceId: followUp.workspaceId,
				expectedWorkspaceId: args.workspaceId
			});
		}

		return {
			submissionId: submission._id,
			customerId: submission.customerId ?? null,
			bookingId: submission.bookingId ?? null,
			followUpId: followUp?._id ?? null,
			signerName: submission.signerName,
			signerEmail: submission.signerEmail,
			signerDateOfBirth: submission.signerDateOfBirth,
			signatureDataUrl: submission.signatureDataUrl,
			answers: submission.answers,
			submittedAt: submission.submittedAt,
			workspaceName: workspace.name,
			waiver: {
				title: version.title,
				introCopy: version.introCopy,
				theme: version.theme ?? 'dark',
				fields: version.fields
			},
			minors: submission.minors.map((participant) => participant.fullName),
			booking: submission.bookingSnapshot ?? null,
			marketingConsent: submission.marketingConsent ?? false,
			marketingConsentLabel: submission.marketingConsentLabel ?? null
		};
	}
});

export const listRecentSubmissions = query({
	args: {
		workspaceId: v.id('workspaces'),
		paginationOpts: paginationOptsValidator,
		searchQuery: v.optional(v.string())
	},
	returns: v.object({
		submissions: v.array(
			v.object({
				submissionId: v.id('waiver_submissions'),
				signerName: v.string(),
				signerEmail: v.string(),
				signerDateOfBirth: v.string(),
				minorCount: v.number(),
				bookingActivityName: v.union(v.string(), v.null()),
				bookingStartTime: v.union(v.string(), v.null()),
				submittedAt: v.number()
			})
		),
		continueCursor: v.string(),
		isDone: v.boolean()
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const searchQuery = args.searchQuery?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';

		const submissionPage = searchQuery
			? await ctx.db
					.query('waiver_submissions')
					.withSearchIndex('search_submissionText', (q) =>
						q.search('searchText', searchQuery).eq('workspaceId', args.workspaceId)
					)
					.paginate(args.paginationOpts)
			: await ctx.db
					.query('waiver_submissions')
					.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
					.order('desc')
					.paginate(args.paginationOpts);

		return {
			submissions: submissionPage.page.map((submission) => ({
				submissionId: submission._id,
				signerName: submission.signerName,
				signerEmail: submission.signerEmail,
				signerDateOfBirth: submission.signerDateOfBirth,
				minorCount: submission.minors.length,
				bookingActivityName: submission.bookingSnapshot?.activityName ?? null,
				bookingStartTime: submission.bookingSnapshot?.startTime ?? null,
				submittedAt: submission.submittedAt
			})),
			continueCursor: submissionPage.continueCursor,
			isDone: submissionPage.isDone
		};
	}
});

export const getPublicWaiverBySlug = query({
	args: {
		slug: v.string()
	},
	returns: v.union(v.null(), publicWaiverValue),
	handler: async (ctx, args) => {
		const waiver = await getPublicWaiverRecordBySlug(ctx, args.slug);
		if (!waiver || !waiver.publishedVersionId) {
			return null;
		}

		const [workspace, version, marketingIntegration] = await Promise.all([
			ctx.db.get(waiver.workspaceId),
			ctx.db.get(waiver.publishedVersionId),
			ctx.db
				.query('marketing_integrations')
				.withIndex('by_workspaceId_and_provider', (q) =>
					q.eq('workspaceId', waiver.workspaceId).eq('provider', 'mailchimp')
				)
				.unique()
		]);

		if (
			!workspace ||
			workspace.status === 'archived' ||
			!version ||
			version.waiverId !== waiver._id
		) {
			return null;
		}
		if (!(await workspaceHasBillingFeature(ctx, waiver.workspaceId, 'waiver_publishing'))) {
			return null;
		}

		const workspaceLogoUrl = await getOwnedWorkspaceLogoUrl(ctx, workspace);

		return {
			slug: waiver.publicSlug,
			versionId: version._id,
			workspaceName: workspace.name,
			workspaceLogoUrl: workspaceLogoUrl ?? null,
			title: version.title,
			introCopy: sanitizeRichTextHtml(version.introCopy),
			theme: version.theme ?? 'dark',
			fields: version.fields,
			marketingOptIn:
				marketingIntegration?.status === 'connected' && marketingIntegration.audienceId
					? { provider: 'mailchimp' as const, label: marketingConsentLabel(workspace.name) }
					: null
		};
	}
});

export const getPublicWaiverForBooking = query({
	args: {
		slug: v.string(),
		lookupToken: v.string()
	},
	returns: v.union(v.null(), publicBookingWaiverValue),
	handler: async (ctx, args) => {
		const waiver = await getPublicWaiverRecordBySlug(ctx, args.slug);
		if (!waiver || !waiver.publishedVersionId) {
			return null;
		}

		const booking = await ctx.db
			.query('bookings')
			.withIndex('by_lookupToken', (q) => q.eq('lookupToken', args.lookupToken))
			.unique();
		if (!booking || booking.workspaceId !== waiver.workspaceId || booking.status !== 'active') {
			return null;
		}

		const [workspace, version, marketingIntegration] = await Promise.all([
			ctx.db.get(waiver.workspaceId),
			ctx.db.get(waiver.publishedVersionId),
			ctx.db
				.query('marketing_integrations')
				.withIndex('by_workspaceId_and_provider', (q) =>
					q.eq('workspaceId', waiver.workspaceId).eq('provider', 'mailchimp')
				)
				.unique()
		]);
		if (
			!workspace ||
			workspace.status === 'archived' ||
			!version ||
			version.waiverId !== waiver._id
		) {
			return null;
		}
		if (!(await workspaceHasBillingFeature(ctx, waiver.workspaceId, 'waiver_publishing'))) {
			return null;
		}
		const workspaceLogoUrl = await getOwnedWorkspaceLogoUrl(ctx, workspace);
		const requiredWaivers = (
			await Promise.all(
				(await getBookingRequiredWaivers(ctx, booking)).map(async (required) => {
					// Show the published title, not unpublished builder edits.
					const publishedVersion = required.publishedVersionId
						? await ctx.db.get(required.publishedVersionId)
						: null;
					return publishedVersion
						? [
								{
									slug: required.publicSlug,
									title: publishedVersion.title,
									isCurrent: required._id === waiver._id
								}
							]
						: [];
				})
			)
		).flat();

		return {
			slug: waiver.publicSlug,
			versionId: version._id,
			workspaceName: workspace.name,
			workspaceLogoUrl: workspaceLogoUrl ?? null,
			title: version.title,
			introCopy: sanitizeRichTextHtml(version.introCopy),
			theme: version.theme ?? 'dark',
			fields: version.fields,
			marketingOptIn:
				marketingIntegration?.status === 'connected' && marketingIntegration.audienceId
					? { provider: 'mailchimp' as const, label: marketingConsentLabel(workspace.name) }
					: null,
			requiredWaivers,
			booking: {
				lookupToken: booking.lookupToken,
				activityName: booking.activityName,
				startTime: booking.startTime ?? null,
				endTime: booking.endTime ?? null,
				leadCustomerName: booking.leadCustomerName ?? null,
				participantCount: booking.participantCount,
				signedCount: booking.signedCount
			}
		};
	}
});

export const submitPublicWaiver = mutation({
	args: {
		slug: v.string(),
		versionId: v.id('waiver_versions'),
		bookingLookupToken: v.optional(v.string()),
		signerName: v.string(),
		signerEmail: v.string(),
		signerDateOfBirth: v.string(),
		signatureDataUrl: v.string(),
		marketingConsent: v.optional(v.boolean()),
		answers: v.record(v.string(), waiverAnswerValueValidator),
		minors: v.array(minorInputValidator)
	},
	returns: v.object({
		submissionId: v.id('waiver_submissions')
	}),
	handler: async (ctx, args) => {
		const waiver = await getPublicWaiverRecordBySlug(ctx, args.slug);
		if (!waiver || !waiver.publishedVersionId) {
			throw new ConvexError({
				code: 'not_found',
				message: 'This public waiver is no longer available.'
			});
		}
		if (waiver.publishedVersionId !== args.versionId) {
			throw new ConvexError({
				code: 'stale_version',
				message: 'This waiver has been updated. Reload and try again.'
			});
		}

		const [version, workspace] = await Promise.all([
			ctx.db.get(waiver.publishedVersionId),
			ctx.db.get(waiver.workspaceId)
		]);
		if (!workspace || workspace.status === 'archived') {
			throw new ConvexError({
				code: 'not_found',
				message: 'This public waiver is no longer available.'
			});
		}
		if (!(await workspaceHasBillingFeature(ctx, waiver.workspaceId, 'waiver_publishing'))) {
			throw new ConvexError({
				code: 'not_found',
				message: 'This public waiver is no longer available.'
			});
		}
		if (!version || version.waiverId !== waiver._id) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Published waiver version not found.'
			});
		}

		const signerName = args.signerName.trim();
		const originalSignerEmail = args.signerEmail.trim();
		const signerEmail = originalSignerEmail.toLowerCase();
		const signerDateOfBirth = args.signerDateOfBirth.trim();
		if (signerName.length < 2 || signerName.length > 120) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Signer name must be between 2 and 120 characters.'
			});
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter a valid email address.'
			});
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(signerDateOfBirth) || isNaN(Date.parse(signerDateOfBirth))) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter a valid date of birth.'
			});
		}
		if (!args.signatureDataUrl.startsWith('data:image/')) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'A drawn signature is required.'
			});
		}

		validateSubmissionAnswers(version, args.answers);
		const minors = validateMinors(args.minors);
		const marketingIntegration = await ctx.db
			.query('marketing_integrations')
			.withIndex('by_workspaceId_and_provider', (q) =>
				q.eq('workspaceId', waiver.workspaceId).eq('provider', 'mailchimp')
			)
			.unique();
		const marketingEnabled = Boolean(
			marketingIntegration?.status === 'connected' && marketingIntegration.audienceId
		);
		const marketingConsent = marketingEnabled && args.marketingConsent === true;
		const consentLabel = marketingEnabled ? marketingConsentLabel(workspace.name) : null;
		let booking: Doc<'bookings'> | null = null;
		const bookingLookupToken = args.bookingLookupToken;
		if (bookingLookupToken) {
			booking = await ctx.db
				.query('bookings')
				.withIndex('by_lookupToken', (q) => q.eq('lookupToken', bookingLookupToken))
				.unique();
			if (!booking || booking.workspaceId !== waiver.workspaceId || booking.status !== 'active') {
				throw new ConvexError({
					code: 'not_found',
					message: 'This booking is no longer available for waiver signing.'
				});
			}
		}

		const submittedAt = Date.now();
		const submissionId = await ctx.db.insert('waiver_submissions', {
			workspaceId: waiver.workspaceId,
			versionId: waiver.publishedVersionId,
			...(booking
				? {
						bookingId: booking._id,
						bookingSnapshot: bookingSnapshot(booking)
					}
				: {}),
			signerName,
			signerEmail: originalSignerEmail,
			searchText: submissionSearchText({
				signerName,
				signerEmail: originalSignerEmail,
				booking
			}),
			signerDateOfBirth,
			signatureDataUrl: args.signatureDataUrl,
			answers: args.answers,
			minors,
			status: 'submitted',
			marketingConsent,
			...(consentLabel ? { marketingConsentLabel: consentLabel } : {}),
			submittedAt
		});
		const customerId = await upsertSignerCustomer(ctx, {
			workspaceId: waiver.workspaceId,
			signerName,
			signerEmail: originalSignerEmail,
			submittedAt,
			bookingId: booking?._id ?? null,
			latestSubmissionId: submissionId
		});
		await ctx.db.patch(submissionId, { customerId });

		if (marketingConsent && marketingIntegration?.audienceId) {
			const syncId = await ctx.db.insert('marketing_contact_syncs', {
				workspaceId: waiver.workspaceId,
				integrationId: marketingIntegration._id,
				submissionId,
				provider: 'mailchimp',
				audienceId: marketingIntegration.audienceId,
				status: 'queued',
				attempts: 0,
				createdAt: submittedAt,
				updatedAt: submittedAt
			});
			await ctx.scheduler.runAfter(0, internal.mailchimp.syncContact, { syncId });
		}

		await ctx.scheduler.runAfter(0, internal.emails.scheduleFollowUpOnSubmission, {
			workspaceId: waiver.workspaceId,
			submissionId,
			signerName,
			signerEmail: originalSignerEmail,
			submittedAt
		});

		if (booking) {
			// Only the primary required waiver counts toward the waiver gap, so a
			// booking that needs two waivers is not double counted when each
			// participant signs both. Per-waiver coverage is a follow-up (ADR 0002).
			const [primaryWaiver] = await getBookingRequiredWaivers(ctx, booking);
			if (!primaryWaiver || primaryWaiver._id === waiver._id) {
				await ctx.db.patch(booking._id, {
					signedCount: booking.signedCount + 1 + minors.length
				});
			}
		}
		return { submissionId };
	}
});
