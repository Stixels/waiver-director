import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
	assertWorkspaceRecord,
	buildWorkspaceWaiverSummary,
	createDefaultWaiverDefinition,
	minorInputValidator,
	normalizeWaiverDefinition,
	requireWorkspaceMember,
	assertValidPublicSlug,
	normalizePublicSlug,
	validateMinors,
	validateSubmissionAnswers,
	waiverDefinitionsEqual,
	waiverAnswerValueValidator,
	waiverDefinitionValidator
} from './lib/waivers';

type FunctionCtx = QueryCtx | MutationCtx;

async function createUniquePublicSlug(ctx: MutationCtx, baseSlug: string): Promise<string> {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
		const slug = `${baseSlug}${suffix}`;
		assertValidPublicSlug(slug);

		const existing = await ctx.db
			.query('public_waiver_links')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.unique();
		if (!existing) {
			return slug;
		}
	}

	throw new ConvexError({
		code: 'already_exists',
		message: 'Unable to create a unique public waiver link for this workspace.'
	});
}

async function getWorkspacePublicLink(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	const links = await ctx.db
		.query('public_waiver_links')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.order('desc')
		.take(1);

	return links[0] ?? null;
}

async function getWorkspaceWaiverRecord(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	const publicLink = await getWorkspacePublicLink(ctx, workspaceId);
	if (publicLink) {
		const version = await ctx.db.get(publicLink.versionId);
		if (version && version.workspaceId === workspaceId) {
			const activeWaiver = await ctx.db.get(version.waiverId);
			if (activeWaiver && activeWaiver.workspaceId === workspaceId) {
				return activeWaiver;
			}
		}
	}

	const waivers = await ctx.db
		.query('workspace_waivers')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.order('desc')
		.take(1);

	return waivers[0] ?? null;
}

async function insertWorkspaceWaiver(ctx: MutationCtx, workspaceId: Id<'workspaces'>) {
	const workspace = await ctx.db.get(workspaceId);
	if (!workspace) {
		throw new ConvexError({
			code: 'not_found',
			message: 'Workspace not found.'
		});
	}

	const definition = createDefaultWaiverDefinition(workspace.name);
	const waiverId = await ctx.db.insert('workspace_waivers', {
		workspaceId,
		title: definition.title,
		introCopy: definition.introCopy,
		fields: definition.fields
	});

	return waiverId;
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
	if (!waiver.lastPublishedVersionId) {
		return false;
	}

	const version = await ctx.db.get(waiver.lastPublishedVersionId);
	if (!version) {
		return true;
	}

	return !waiverDefinitionsEqual(
		{
			title: waiver.title,
			introCopy: waiver.introCopy,
			fields: waiver.fields
		},
		{
			title: version.title,
			introCopy: version.introCopy,
			fields: version.fields
		}
	);
}

async function workspaceWaiverSummary(
	ctx: FunctionCtx,
	waiver: Doc<'workspace_waivers'>,
	activeLink: Doc<'public_waiver_links'> | null
) {
	const hasUnpublishedChanges = await waiverHasUnpublishedChanges(ctx, waiver);

	return buildWorkspaceWaiverSummary({
		waiver,
		activeLink,
		hasUnpublishedChanges
	});
}

export const getWorkspaceWaiver = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [waiver, activeLink, workspace] = await Promise.all([
			getWorkspaceWaiverRecord(ctx, args.workspaceId),
			getWorkspacePublicLink(ctx, args.workspaceId),
			ctx.db.get(args.workspaceId)
		]);

		if (!waiver || !workspace) {
			return null;
		}

		return await workspaceWaiverSummary(ctx, waiver, activeLink);
	}
});

export const ensureWorkspaceWaiver = mutation({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const existing = await getWorkspaceWaiverRecord(ctx, args.workspaceId);
		if (existing) {
			return { waiverId: existing._id };
		}

		const waiverId = await insertWorkspaceWaiver(ctx, args.workspaceId);

		return { waiverId };
	}
});

export const updateWorkspaceWaiver = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		waiverId: v.id('workspace_waivers'),
		definition: waiverDefinitionValidator
	},
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
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const waiver = assertWorkspaceRecord(
			await ctx.db.get(args.waiverId),
			args.workspaceId,
			'Workspace waiver not found.'
		);

		const definition = normalizeWaiverDefinition({
			title: waiver.title,
			introCopy: waiver.introCopy,
			fields: waiver.fields
		});
		const currentVersionId = waiver.lastPublishedVersionId;
		const activeLink = await getWorkspacePublicLink(ctx, args.workspaceId);
		if (
			activeLink &&
			currentVersionId &&
			activeLink.versionId === currentVersionId &&
			!(await waiverHasUnpublishedChanges(ctx, waiver))
		) {
			return {
				versionId: currentVersionId,
				publicLinkId: activeLink._id
			};
		}

		const versionId = await ctx.db.insert('waiver_versions', {
			workspaceId: args.workspaceId,
			waiverId: waiver._id,
			versionNumber: await getNextVersionNumber(ctx, waiver._id),
			title: definition.title,
			introCopy: definition.introCopy,
			fields: definition.fields,
			publishedAt: Date.now()
		});

		await ctx.db.patch(waiver._id, {
			lastPublishedVersionId: versionId
		});

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Workspace not found.'
			});
		}

		let publicLinkId: Id<'public_waiver_links'>;
		if (activeLink) {
			await ctx.db.patch(activeLink._id, {
				versionId
			});
			publicLinkId = activeLink._id;
		} else {
			const baseSlug = normalizePublicSlug(`${workspace.slug}-waiver`);
			const slug = await createUniquePublicSlug(ctx, baseSlug);
			publicLinkId = await ctx.db.insert('public_waiver_links', {
				workspaceId: args.workspaceId,
				versionId,
				slug
			});
		}

		return { versionId, publicLinkId };
	}
});

export const listWaiverVersions = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [waiver, activeLink, workspace] = await Promise.all([
			getWorkspaceWaiverRecord(ctx, args.workspaceId),
			getWorkspacePublicLink(ctx, args.workspaceId),
			ctx.db.get(args.workspaceId)
		]);

		if (!waiver || !workspace) {
			return [];
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
			fields: version.fields,
			workspaceName: workspace.name,
			publishedAt: version.publishedAt,
			isActivePublic: activeLink?.versionId === version._id
		}));
	}
});

export const getPublishingOverview = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const activeLink = await getWorkspacePublicLink(ctx, args.workspaceId);
		if (!activeLink) {
			return {
				activeLink: null
			};
		}

		const [version, workspace] = await Promise.all([
			ctx.db.get(activeLink.versionId),
			ctx.db.get(args.workspaceId)
		]);

		return {
			activeLink:
				version && workspace
					? {
							publicLinkId: activeLink._id,
							slug: activeLink.slug,
							title: version.title,
							versionId: version._id,
							versionNumber: version.versionNumber,
							workspaceName: workspace.name,
							introCopy: version.introCopy,
							fields: version.fields
						}
					: null
		};
	}
});

export const getSubmission = query({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions')
	},
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

		return {
			submissionId: submission._id,
			signerName: submission.signerName,
			signerEmail: submission.signerEmail,
			signerDateOfBirth: submission.signerDateOfBirth,
			signatureDataUrl: submission.signatureDataUrl,
			answers: submission.answers,
			submittedAt: submission.submittedAt,
			workspaceName: workspace?.name ?? '',
			waiver: version
				? {
						title: version.title,
						introCopy: version.introCopy,
						fields: version.fields
					}
				: null,
			minors: submission.minors.map((participant) => participant.fullName)
		};
	}
});

export const listRecentSubmissions = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const submissions = await ctx.db
			.query('waiver_submissions')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
			.order('desc')
			.take(25);

		return submissions.map((submission) => ({
			submissionId: submission._id,
			signerName: submission.signerName,
			signerEmail: submission.signerEmail,
			signerDateOfBirth: submission.signerDateOfBirth,
			minorCount: submission.minors.length,
			submittedAt: submission.submittedAt
		}));
	}
});

export const getPublicWaiverBySlug = query({
	args: {
		slug: v.string()
	},
	handler: async (ctx, args) => {
		const link = await ctx.db
			.query('public_waiver_links')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.unique();

		if (!link) {
			return null;
		}

		const [workspace, version] = await Promise.all([
			ctx.db.get(link.workspaceId),
			ctx.db.get(link.versionId)
		]);

		if (!workspace || !version) {
			return null;
		}

		return {
			slug: link.slug,
			versionId: version._id,
			workspaceName: workspace.name,
			title: version.title,
			introCopy: version.introCopy,
			fields: version.fields
		};
	}
});

export const submitPublicWaiver = mutation({
	args: {
		slug: v.string(),
		versionId: v.id('waiver_versions'),
		signerName: v.string(),
		signerEmail: v.string(),
		signerDateOfBirth: v.string(),
		signatureDataUrl: v.string(),
		answers: v.record(v.string(), waiverAnswerValueValidator),
		minors: v.array(minorInputValidator)
	},
	handler: async (ctx, args) => {
		const link = await ctx.db
			.query('public_waiver_links')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.unique();
		if (!link) {
			throw new ConvexError({
				code: 'not_found',
				message: 'This public waiver is no longer available.'
			});
		}
		if (link.versionId !== args.versionId) {
			throw new ConvexError({
				code: 'stale_version',
				message: 'This waiver has been updated. Reload and try again.'
			});
		}

		const version = await ctx.db.get(link.versionId);
		if (!version) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Published waiver version not found.'
			});
		}

		const signerName = args.signerName.trim();
		const signerEmail = args.signerEmail.trim().toLowerCase();
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

		const submittedAt = Date.now();
		const submissionId = await ctx.db.insert('waiver_submissions', {
			workspaceId: link.workspaceId,
			publicLinkId: link._id,
			waiverId: version.waiverId,
			versionId: link.versionId,
			signerName,
			signerEmail,
			signerDateOfBirth,
			signatureDataUrl: args.signatureDataUrl,
			answers: args.answers,
			minors,
			status: 'submitted',
			submittedAt
		});

		return { submissionId };
	}
});
