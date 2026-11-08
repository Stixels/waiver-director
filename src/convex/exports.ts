import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { bookingProviderValidator } from './lib/bookings';
import { requireWorkspaceOwner } from './lib/waivers';

// Exports are fetched page by page by the client and assembled into a CSV in
// the browser. Submission docs carry signature data URLs, so pages are also
// capped by bytes read: Convex returns a partial page and the client follows
// continueCursor, which keeps every query inside the per-query read limit.
const MAX_EXPORT_PAGE_SIZE = 200;
const MAX_EXPORT_PAGE_BYTES = 4 * 1024 * 1024;

const exportAnswerValue = v.object({
	fieldId: v.string(),
	label: v.string(),
	value: v.string()
});

const submissionExportRow = v.object({
	submissionId: v.id('waiver_submissions'),
	submittedAt: v.number(),
	signerName: v.string(),
	signerEmail: v.string(),
	signerDateOfBirth: v.string(),
	minors: v.array(v.string()),
	waiverTitle: v.string(),
	waiverVersionNumber: v.number(),
	bookingProvider: v.union(bookingProviderValidator, v.null()),
	providerBookingId: v.union(v.string(), v.null()),
	bookingActivityName: v.union(v.string(), v.null()),
	bookingStartTime: v.union(v.string(), v.null()),
	marketingConsent: v.boolean(),
	answers: v.array(exportAnswerValue)
});

const customerExportRow = v.object({
	customerId: v.id('customers'),
	displayName: v.string(),
	primaryEmail: v.string(),
	firstSeenAt: v.number(),
	lastSeenAt: v.number(),
	visitCount: v.number()
});

function exportPageOpts<T extends { numItems: number }>(paginationOpts: T): T {
	return {
		...paginationOpts,
		numItems: Math.min(MAX_EXPORT_PAGE_SIZE, Math.max(1, Math.floor(paginationOpts.numItems))),
		maximumBytesRead: MAX_EXPORT_PAGE_BYTES
	};
}

function formatAnswer(value: string | boolean | null | undefined): string {
	if (value === true) return 'Yes';
	if (value === false) return 'No';
	return value ?? '';
}

function historicalAnswers(submission: Doc<'waiver_submissions'>, version: Doc<'waiver_versions'>) {
	// Answers are read against the published version the signer accepted, so
	// labels reflect what the signer saw rather than the current template.
	return version.fields.map((field) => {
		const answer = submission.answers[field.id];
		// Select answers are stored as option ids; export the label the signer
		// picked, falling back to the raw value if the option is missing.
		const value =
			field.type === 'select' && typeof answer === 'string'
				? (field.options.find((option) => option.id === answer)?.label ?? answer)
				: formatAnswer(answer);
		return { fieldId: field.id, label: field.label, value };
	});
}

export const exportSubmissionsPage = query({
	args: {
		workspaceId: v.id('workspaces'),
		paginationOpts: paginationOptsValidator
	},
	returns: paginationResultValidator(submissionExportRow),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'export signed submissions');

		const result = await ctx.db
			.query('waiver_submissions')
			.withIndex('by_workspaceId_and_submittedAt', (q) => q.eq('workspaceId', args.workspaceId))
			.order('asc')
			.paginate(exportPageOpts(args.paginationOpts));

		const versions = new Map<Id<'waiver_versions'>, Doc<'waiver_versions'>>();
		const page = [];
		for (const submission of result.page) {
			let version = versions.get(submission.versionId);
			if (!version) {
				const loaded = await ctx.db.get(submission.versionId);
				if (!loaded || loaded.workspaceId !== args.workspaceId) {
					throw new ConvexError({
						code: 'data_integrity_error',
						message: 'Signed waiver version not found for this workspace.',
						submissionId: submission._id
					});
				}
				version = loaded;
				versions.set(version._id, version);
			}

			page.push({
				submissionId: submission._id,
				submittedAt: submission.submittedAt,
				signerName: submission.signerName,
				signerEmail: submission.signerEmail,
				signerDateOfBirth: submission.signerDateOfBirth,
				minors: submission.minors.map((minor) => minor.fullName),
				waiverTitle: version.title,
				waiverVersionNumber: version.versionNumber,
				bookingProvider: submission.bookingSnapshot?.provider ?? null,
				providerBookingId: submission.bookingSnapshot?.providerBookingId ?? null,
				bookingActivityName: submission.bookingSnapshot?.activityName ?? null,
				bookingStartTime: submission.bookingSnapshot?.startTime ?? null,
				marketingConsent: submission.marketingConsent ?? false,
				answers: historicalAnswers(submission, version)
			});
		}

		return { ...result, page };
	}
});

export const exportCustomersPage = query({
	args: {
		workspaceId: v.id('workspaces'),
		paginationOpts: paginationOptsValidator
	},
	returns: paginationResultValidator(customerExportRow),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'export customer lists');

		const result = await ctx.db
			.query('customers')
			.withIndex('by_workspaceId_and_firstSeenAt', (q) => q.eq('workspaceId', args.workspaceId))
			.order('asc')
			.paginate(exportPageOpts(args.paginationOpts));

		return {
			...result,
			page: result.page.map((customer) => ({
				customerId: customer._id,
				displayName: customer.displayName,
				primaryEmail: customer.primaryEmail,
				firstSeenAt: customer.firstSeenAt,
				lastSeenAt: customer.lastSeenAt,
				visitCount: customer.visitCount
			}))
		};
	}
});
