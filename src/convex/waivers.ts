import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
	assertWorkspaceRecord,
	buildTemplateLifecycle,
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

async function getWorkspaceTemplate(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	const publicLink = await getWorkspacePublicLink(ctx, workspaceId);
	if (publicLink) {
		const version = await ctx.db.get(publicLink.versionId);
		if (version && version.workspaceId === workspaceId) {
			const activeTemplate = await ctx.db.get(version.templateId);
			if (activeTemplate && activeTemplate.workspaceId === workspaceId) {
				return activeTemplate;
			}
		}
	}

	const templates = await ctx.db
		.query('waiver_templates')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.order('desc')
		.take(1);

	return templates[0] ?? null;
}

async function insertWorkspaceTemplate(ctx: MutationCtx, workspaceId: Id<'workspaces'>) {
	const workspace = await ctx.db.get(workspaceId);
	if (!workspace) {
		throw new ConvexError({
			code: 'not_found',
			message: 'Workspace not found.'
		});
	}

	const definition = createDefaultWaiverDefinition(workspace.name);
	const templateId = await ctx.db.insert('waiver_templates', {
		workspaceId,
		title: definition.title,
		introCopy: definition.introCopy,
		fields: definition.fields
	});

	return templateId;
}

async function getNextVersionNumber(ctx: MutationCtx, templateId: Id<'waiver_templates'>) {
	const latest = await ctx.db
		.query('waiver_template_versions')
		.withIndex('by_templateId_and_versionNumber', (q) => q.eq('templateId', templateId))
		.order('desc')
		.first();

	return latest ? latest.versionNumber + 1 : 1;
}

async function templateHasUnpublishedChanges(ctx: FunctionCtx, template: Doc<'waiver_templates'>) {
	if (!template.lastPublishedVersionId) {
		return false;
	}

	const version = await ctx.db.get(template.lastPublishedVersionId);
	if (!version) {
		return true;
	}

	return !waiverDefinitionsEqual(
		{
			title: template.title,
			introCopy: template.introCopy,
			fields: template.fields
		},
		{
			title: version.title,
			introCopy: version.introCopy,
			fields: version.fields
		}
	);
}

async function templateSummary(
	ctx: FunctionCtx,
	template: Doc<'waiver_templates'>,
	activeLink: Doc<'public_waiver_links'> | null
) {
	const hasUnpublishedChanges = await templateHasUnpublishedChanges(ctx, template);

	return buildTemplateLifecycle({
		template,
		activeLink,
		hasUnpublishedChanges
	});
}

export const listTemplates = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [template, activeLink] = await Promise.all([
			getWorkspaceTemplate(ctx, args.workspaceId),
			getWorkspacePublicLink(ctx, args.workspaceId)
		]);

		if (!template) {
			return [];
		}

		return [await templateSummary(ctx, template, activeLink)];
	}
});

export const ensureWorkspaceTemplate = mutation({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const existing = await getWorkspaceTemplate(ctx, args.workspaceId);
		if (existing) {
			return { templateId: existing._id };
		}

		const templateId = await insertWorkspaceTemplate(ctx, args.workspaceId);

		return { templateId };
	}
});

export const updateTemplate = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		templateId: v.id('waiver_templates'),
		definition: waiverDefinitionValidator
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const template = assertWorkspaceRecord(
			await ctx.db.get(args.templateId),
			args.workspaceId,
			'Waiver template not found.'
		);

		const definition = normalizeWaiverDefinition(args.definition);

		await ctx.db.patch(template._id, {
			title: definition.title,
			introCopy: definition.introCopy,
			fields: definition.fields
		});

		return { templateId: template._id };
	}
});

export const publishTemplate = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		templateId: v.id('waiver_templates')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const template = assertWorkspaceRecord(
			await ctx.db.get(args.templateId),
			args.workspaceId,
			'Waiver template not found.'
		);

		const definition = normalizeWaiverDefinition({
			title: template.title,
			introCopy: template.introCopy,
			fields: template.fields
		});
		const currentVersionId = template.lastPublishedVersionId;
		const activeLink = await getWorkspacePublicLink(ctx, args.workspaceId);
		if (
			activeLink &&
			currentVersionId &&
			activeLink.versionId === currentVersionId &&
			!(await templateHasUnpublishedChanges(ctx, template))
		) {
			return {
				versionId: currentVersionId,
				publicLinkId: activeLink._id
			};
		}

		const versionId = await ctx.db.insert('waiver_template_versions', {
			workspaceId: args.workspaceId,
			templateId: template._id,
			versionNumber: await getNextVersionNumber(ctx, template._id),
			title: definition.title,
			introCopy: definition.introCopy,
			fields: definition.fields,
			publishedAt: Date.now()
		});

		await ctx.db.patch(template._id, {
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

export const listVersionHistory = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [template, activeLink] = await Promise.all([
			getWorkspaceTemplate(ctx, args.workspaceId),
			getWorkspacePublicLink(ctx, args.workspaceId)
		]);

		if (!template) {
			return [];
		}

		const versions = await ctx.db
			.query('waiver_template_versions')
			.withIndex('by_templateId', (q) => q.eq('templateId', template._id))
			.order('desc')
			.take(50);

		return versions.map((version) => ({
			versionId: version._id,
			versionNumber: version.versionNumber,
			title: version.title,
			introCopy: version.introCopy,
			fields: version.fields,
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
		versionId: v.id('waiver_template_versions'),
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
			templateId: version.templateId,
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
