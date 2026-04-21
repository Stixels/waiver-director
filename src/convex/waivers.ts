import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
	assertWorkspaceRecord,
	minorInputValidator,
	normalizeWaiverDefinition,
	requireWorkspaceMember,
	validateMinors,
	validateSubmissionAnswers,
	waiverDefinitionsEqual,
	waiverAnswerValueValidator,
	waiverFieldValidator,
	waiverDefinitionValidator
} from './lib/waivers';

type FunctionCtx = QueryCtx | MutationCtx;

const workspaceWaiverValue = v.object({
	waiverId: v.id('workspace_waivers'),
	publicSlug: v.string(),
	title: v.string(),
	introCopy: v.string(),
	fields: v.array(waiverFieldValidator),
	publishedVersionId: v.union(v.id('waiver_versions'), v.null()),
	hasUnpublishedChanges: v.boolean()
});

const waiverVersionPreviewValue = v.object({
	versionId: v.id('waiver_versions'),
	versionNumber: v.number(),
	title: v.string(),
	introCopy: v.string(),
	fields: v.array(waiverFieldValidator),
	workspaceName: v.string(),
	publishedAt: v.number(),
	isActivePublic: v.boolean()
});

const publicWaiverValue = v.object({
	slug: v.string(),
	versionId: v.id('waiver_versions'),
	workspaceName: v.string(),
	title: v.string(),
	introCopy: v.string(),
	fields: v.array(waiverFieldValidator)
});

async function getWorkspaceWaiverRecord(ctx: FunctionCtx, workspaceId: Id<'workspaces'>) {
	return await ctx.db
		.query('workspace_waivers')
		.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspaceId))
		.unique();
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
			fields: waiver.fields
		},
		{
			title: version.title,
			introCopy: version.introCopy,
			fields: version.fields
		}
	);
}

async function workspaceWaiverSummary(ctx: FunctionCtx, waiver: Doc<'workspace_waivers'>) {
	const hasUnpublishedChanges = await waiverHasUnpublishedChanges(ctx, waiver);

	return {
		waiverId: waiver._id,
		publicSlug: waiver.publicSlug,
		title: waiver.title,
		introCopy: waiver.introCopy,
		fields: waiver.fields,
		publishedVersionId: waiver.publishedVersionId ?? null,
		hasUnpublishedChanges
	};
}

export const getWorkspaceWaiver = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: workspaceWaiverValue,
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const waiver = await getWorkspaceWaiverRecord(ctx, args.workspaceId);
		if (!waiver) {
			throw new ConvexError({
				code: 'not_found',
				message: 'Workspace waiver not found.'
			});
		}

		return await workspaceWaiverSummary(ctx, waiver);
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
		workspaceId: v.id('workspaces')
	},
	returns: v.array(waiverVersionPreviewValue),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		const [waiver, workspace] = await Promise.all([
			getWorkspaceWaiverRecord(ctx, args.workspaceId),
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
			signerName: v.string(),
			signerEmail: v.string(),
			signerDateOfBirth: v.string(),
			signatureDataUrl: v.string(),
			answers: v.record(v.string(), waiverAnswerValueValidator),
			submittedAt: v.number(),
			workspaceName: v.string(),
			waiver: waiverDefinitionValidator,
			minors: v.array(v.string())
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

		return {
			submissionId: submission._id,
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
				fields: version.fields
			},
			minors: submission.minors.map((participant) => participant.fullName)
		};
	}
});

export const listRecentSubmissions = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: v.array(
		v.object({
			submissionId: v.id('waiver_submissions'),
			signerName: v.string(),
			signerEmail: v.string(),
			signerDateOfBirth: v.string(),
			minorCount: v.number(),
			submittedAt: v.number()
		})
	),
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
	returns: v.union(v.null(), publicWaiverValue),
	handler: async (ctx, args) => {
		const waiver = await ctx.db
			.query('workspace_waivers')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', args.slug))
			.unique();

		if (!waiver || !waiver.publishedVersionId) {
			return null;
		}

		const [workspace, version] = await Promise.all([
			ctx.db.get(waiver.workspaceId),
			ctx.db.get(waiver.publishedVersionId)
		]);

		if (!workspace || !version || version.waiverId !== waiver._id) {
			throw new ConvexError({
				code: 'not_found',
				message: 'This public waiver is no longer available.'
			});
		}

		return {
			slug: waiver.publicSlug,
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
	returns: v.object({
		submissionId: v.id('waiver_submissions')
	}),
	handler: async (ctx, args) => {
		const waiver = await ctx.db
			.query('workspace_waivers')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', args.slug))
			.unique();
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

		const version = await ctx.db.get(waiver.publishedVersionId);
		if (!version || version.waiverId !== waiver._id) {
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
			workspaceId: waiver.workspaceId,
			versionId: waiver.publishedVersionId,
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
