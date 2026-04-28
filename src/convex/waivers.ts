import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { bookingSnapshot, bookingSnapshotValidator } from './lib/bookings';
import { upsertSignerCustomer } from './lib/customers';
import { submissionSearchText } from './lib/submissions';
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

const publicBookingWaiverValue = v.object({
	slug: v.string(),
	versionId: v.id('waiver_versions'),
	workspaceName: v.string(),
	title: v.string(),
	introCopy: v.string(),
	fields: v.array(waiverFieldValidator),
	booking: v.object({
		lookupToken: v.string(),
		activityName: v.string(),
		startTime: v.union(v.string(), v.null()),
		endTime: v.union(v.string(), v.null()),
		leadCustomerName: v.union(v.string(), v.null()),
		participantCount: v.number(),
		signedCount: v.number()
	})
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
			customerId: v.union(v.id('customers'), v.null()),
			bookingId: v.union(v.id('bookings'), v.null()),
			signerName: v.string(),
			signerEmail: v.string(),
			signerDateOfBirth: v.string(),
			signatureDataUrl: v.string(),
			answers: v.record(v.string(), waiverAnswerValueValidator),
			submittedAt: v.number(),
			workspaceName: v.string(),
			waiver: waiverDefinitionValidator,
			minors: v.array(v.string()),
			booking: v.union(v.null(), bookingSnapshotValidator)
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
			customerId: submission.customerId ?? null,
			bookingId: submission.bookingId ?? null,
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
			minors: submission.minors.map((participant) => participant.fullName),
			booking: submission.bookingSnapshot ?? null
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

export const getPublicWaiverForBooking = query({
	args: {
		slug: v.string(),
		lookupToken: v.string()
	},
	returns: v.union(v.null(), publicBookingWaiverValue),
	handler: async (ctx, args) => {
		const waiver = await ctx.db
			.query('workspace_waivers')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', args.slug))
			.unique();
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
			fields: version.fields,
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

		await ctx.scheduler.runAfter(0, internal.emails.scheduleFollowUpOnSubmission, {
			workspaceId: waiver.workspaceId,
			submissionId,
			signerName,
			signerEmail: originalSignerEmail,
			submittedAt
		});

		if (booking) {
			await ctx.db.patch(booking._id, {
				signedCount: booking.signedCount + 1 + minors.length
			});
		}
		return { submissionId };
	}
});
