import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { workspaceHasBillingFeature } from './billing';
import {
	photoCaptureKindLabel,
	photoCaptureSettings,
	photoSubmissionError,
	type PhotoCaptureKind,
	type PhotoCaptureSettings
} from './photoCapture';

const WAIVER_UNAVAILABLE_MESSAGE = 'This public waiver is no longer available.';

/** Resolves a public slug to a live, published waiver and its workspace, or throws. */
export async function requireLivePublicWaiver(
	ctx: MutationCtx,
	slug: string
): Promise<{ waiver: Doc<'workspace_waivers'>; workspace: Doc<'workspaces'> }> {
	const waiver = await ctx.db
		.query('workspace_waivers')
		.withIndex('by_publicSlug', (q) => q.eq('publicSlug', slug))
		.unique();
	if (!waiver || !waiver.publishedVersionId) {
		throw new ConvexError({ code: 'not_found', message: WAIVER_UNAVAILABLE_MESSAGE });
	}
	const workspace = await ctx.db.get(waiver.workspaceId);
	if (!workspace || workspace.status === 'archived') {
		throw new ConvexError({ code: 'not_found', message: WAIVER_UNAVAILABLE_MESSAGE });
	}
	if (!(await workspaceHasBillingFeature(ctx, waiver.workspaceId, 'waiver_publishing'))) {
		throw new ConvexError({ code: 'not_found', message: WAIVER_UNAVAILABLE_MESSAGE });
	}
	return { waiver, workspace };
}

type PhotoTokens = { participant?: string; id?: string };

/**
 * Validates the photo upload tokens a signer sent against the workspace's
 * capture settings. Returns the attached upload rows to consume once the
 * submission exists.
 */
export async function resolveSubmissionPhotoUploads(
	ctx: MutationCtx,
	args: {
		waiver: Doc<'workspace_waivers'>;
		workspace: Doc<'workspaces'>;
		tokens: PhotoTokens;
		now: number;
	}
): Promise<Partial<Record<PhotoCaptureKind, Doc<'waiver_photo_uploads'>>>> {
	const settings: PhotoCaptureSettings = photoCaptureSettings(args.workspace);
	const tokens = {
		participant: args.tokens.participant?.trim() || undefined,
		id: args.tokens.id?.trim() || undefined
	};
	const settingsError = photoSubmissionError(settings, {
		participant: Boolean(tokens.participant),
		id: Boolean(tokens.id)
	});
	if (settingsError) {
		throw new ConvexError({ code: 'invalid_argument', message: settingsError });
	}

	const resolved: Partial<Record<PhotoCaptureKind, Doc<'waiver_photo_uploads'>>> = {};
	for (const kind of ['participant', 'id'] as const) {
		const token = tokens[kind];
		if (!token) continue;
		const upload = await ctx.db
			.query('waiver_photo_uploads')
			.withIndex('by_uploadToken', (q) => q.eq('uploadToken', token))
			.unique();
		if (
			!upload ||
			upload.waiverId !== args.waiver._id ||
			upload.workspaceId !== args.waiver.workspaceId ||
			upload.kind !== kind ||
			upload.status !== 'attached' ||
			!upload.storageId ||
			upload.expiresAt < args.now
		) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `The ${photoCaptureKindLabel(kind)} upload expired. Please add it again.`
			});
		}
		resolved[kind] = upload;
	}
	return resolved;
}

export async function consumeSubmissionPhotoUploads(
	ctx: MutationCtx,
	uploads: Partial<Record<PhotoCaptureKind, Doc<'waiver_photo_uploads'>>>,
	submissionId: Id<'waiver_submissions'>,
	now: number
) {
	for (const upload of Object.values(uploads)) {
		if (!upload) continue;
		await ctx.db.patch(upload._id, {
			status: 'consumed',
			submissionId,
			consumedAt: now
		});
	}
}
