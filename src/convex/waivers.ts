import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import {
	assertWorkspaceRecord,
	buildTemplateLifecycle,
	minorInputValidator,
	normalizeWaiverDefinition,
	requireWorkspaceMember,
	getTemplateUsageState,
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

async function getActiveWorkspaceLink(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	return await ctx.db
		.query('public_waiver_links')
		.withIndex('by_workspaceId_and_status', (q) =>
			q.eq('workspaceId', workspaceId).eq('status', 'active')
		)
		.unique();
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
	const [hasSubmissions, hasUnpublishedChanges] = await Promise.all([
		templateHasSubmissions(ctx, template._id),
		templateHasUnpublishedChanges(ctx, template)
	]);

	return buildTemplateLifecycle({
		template,
		activeLink,
		hasSubmissions,
		hasUnpublishedChanges
	});
}

async function templateHasSubmissions(ctx: FunctionCtx, templateId: Id<'waiver_templates'>) {
	const existingSubmission = await ctx.db
		.query('waiver_submissions')
		.withIndex('by_templateId', (q) => q.eq('templateId', templateId))
		.first();

	return !!existingSubmission;
}

export const listTemplates = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [templates, activeLink] = await Promise.all([
			ctx.db
				.query('waiver_templates')
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
				.order('desc')
				.collect(),
			getActiveWorkspaceLink(ctx, args.workspaceId)
		]);

		return await Promise.all(
			templates.map((template) => templateSummary(ctx, template, activeLink))
		);
	}
});

export const getTemplate = query({
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
		const activeLink = await getActiveWorkspaceLink(ctx, args.workspaceId);
		return templateSummary(ctx, template, activeLink);
	}
});

export const createTemplate = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		title: v.string()
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const definition = normalizeWaiverDefinition({
			title: args.title,
			introCopy: '',
			fields: []
		});

		const templateId = await ctx.db.insert('waiver_templates', {
			workspaceId: args.workspaceId,
			title: definition.title,
			introCopy: definition.introCopy,
			fields: definition.fields
		});

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
		if (template.archivedAt) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Archived waivers cannot be edited.'
			});
		}

		const definition = normalizeWaiverDefinition(args.definition);

		await ctx.db.patch(template._id, {
			title: definition.title,
			introCopy: definition.introCopy,
			fields: definition.fields
		});

		return { templateId: template._id };
	}
});

export const archiveTemplate = mutation({
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
		const hasSubmissions = await templateHasSubmissions(ctx, template._id);
		const usageState = getTemplateUsageState({
			lastPublishedVersionId: template.lastPublishedVersionId,
			hasSubmissions
		});
		if (usageState !== 'used') {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Only signed waivers should be archived. Delete unsigned templates instead.'
			});
		}

		await ctx.db.patch(template._id, {
			archivedAt: Date.now()
		});

		const activeLink = await getActiveWorkspaceLink(ctx, args.workspaceId);
		if (activeLink && activeLink.versionId === template.lastPublishedVersionId) {
			await ctx.db.patch(activeLink._id, { status: 'inactive' });
		}

		return { templateId: template._id };
	}
});

export const deleteTemplate = mutation({
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
		const hasSubmissions = await templateHasSubmissions(ctx, template._id);
		const usageState = getTemplateUsageState({
			lastPublishedVersionId: template.lastPublishedVersionId,
			hasSubmissions
		});

		if (usageState === 'used') {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Signed waivers cannot be deleted permanently.'
			});
		}

		const versions = await ctx.db
			.query('waiver_template_versions')
			.withIndex('by_templateId', (q) => q.eq('templateId', template._id))
			.collect();

		for (const version of versions) {
			const links = await ctx.db
				.query('public_waiver_links')
				.withIndex('by_versionId', (q) => q.eq('versionId', version._id))
				.collect();

			for (const link of links) {
				await ctx.db.delete(link._id);
			}
		}

		for (const version of versions) {
			await ctx.db.delete(version._id);
		}

		await ctx.db.delete(template._id);

		return { templateId: args.templateId };
	}
});

export const publishTemplate = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		templateId: v.id('waiver_templates'),
		activate: v.boolean()
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const template = assertWorkspaceRecord(
			await ctx.db.get(args.templateId),
			args.workspaceId,
			'Waiver template not found.'
		);
		if (template.archivedAt) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Archived waivers cannot be published.'
			});
		}

		const definition = normalizeWaiverDefinition({
			title: template.title,
			introCopy: template.introCopy,
			fields: template.fields
		});
		const currentVersionId = template.lastPublishedVersionId;
		const activeLink = args.activate ? await getActiveWorkspaceLink(ctx, args.workspaceId) : null;
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

		let publicLinkId: Id<'public_waiver_links'> | null = null;
		if (args.activate) {
			const workspace = await ctx.db.get(args.workspaceId);
			if (!workspace) {
				throw new ConvexError({
					code: 'not_found',
					message: 'Workspace not found.'
				});
			}

			if (activeLink) {
				await ctx.db.patch(activeLink._id, {
					versionId,
					status: 'active'
				});
				publicLinkId = activeLink._id;
			} else {
				const baseSlug = normalizePublicSlug(`${workspace.slug}-waiver`);
				const slug = await createUniquePublicSlug(ctx, baseSlug);
				publicLinkId = await ctx.db.insert('public_waiver_links', {
					workspaceId: args.workspaceId,
					versionId,
					slug,
					status: 'active'
				});
			}
		}

		return { versionId, publicLinkId };
	}
});

export const deactivatePublicLink = mutation({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const activeLink = await getActiveWorkspaceLink(ctx, args.workspaceId);
		if (!activeLink) {
			return { deactivated: false };
		}

		await ctx.db.patch(activeLink._id, {
			status: 'inactive'
		});

		return { deactivated: true };
	}
});

export const getPublishingOverview = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const activeLink = await getActiveWorkspaceLink(ctx, args.workspaceId);
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

		if (!link || link.status !== 'active') {
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
		if (!link || link.status !== 'active') {
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

		// Hook that connects to the email scheduler to send a follow-up email to the signer after a certain amount of time.
		await ctx.scheduler.runAfter(0, internal.emails.scheduleFollowUpOnSubmission, {
			workspaceId: link.workspaceId,
			submissionId,
			signerName,
			signerEmail,
			submittedAt
		});

		return { submissionId };
	}
});
