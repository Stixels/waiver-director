import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import {
	PHOTO_UPLOAD_CLIENT_RATE_LIMIT,
	PHOTO_UPLOAD_RATE_WINDOW_MS,
	PHOTO_UPLOAD_RESERVATION_TTL_MS,
	PHOTO_UPLOAD_TTL_MS,
	PHOTO_UPLOAD_WAIVER_RATE_LIMIT,
	PHOTO_VIEW_TOKEN_TTL_MS,
	photoCaptureKindLabel,
	photoCaptureKindValidator,
	photoCaptureModeForKind,
	photoCaptureModeValidator,
	photoCaptureSettings,
	photoCaptureSettingsValidator,
	photoUploadMetadataError
} from './lib/photoCapture';
import { requireLivePublicWaiver } from './lib/photoUploads';
import { requireWorkspaceMember, requireWorkspaceOwner } from './lib/waivers';

const PRUNE_BATCH_SIZE = 100;

export const getWorkspacePhotoCaptureSettings = query({
	args: {
		workspaceId: v.id('workspaces')
	},
	returns: photoCaptureSettingsValidator,
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError({ code: 'not_found', message: 'Workspace not found.' });
		}
		return photoCaptureSettings(workspace);
	}
});

export const updateWorkspacePhotoCaptureSettings = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		participantPhoto: photoCaptureModeValidator,
		idPhoto: photoCaptureModeValidator
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change photo capture settings');
		await ctx.db.patch(args.workspaceId, {
			participantPhotoCapture: args.participantPhoto,
			idPhotoCapture: args.idPhoto
		});
		return null;
	}
});

/**
 * Reserves an upload slot for a signer's photo. Called only by the
 * `/photo-uploads` HTTP endpoint, after it has checked the declared size and
 * type and before it stores the file. Rate limited per client and per waiver.
 */
export const reservePublicPhotoUpload = internalMutation({
	args: {
		slug: v.string(),
		kind: photoCaptureKindValidator,
		clientKey: v.string()
	},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			uploadId: v.id('waiver_photo_uploads'),
			uploadToken: v.string()
		}),
		v.object({ ok: v.literal(false), status: v.number(), message: v.string() })
	),
	handler: async (ctx, args) => {
		let resolved;
		try {
			resolved = await requireLivePublicWaiver(ctx, args.slug);
		} catch {
			return {
				ok: false as const,
				status: 404,
				message: 'This public waiver is no longer available.'
			};
		}
		const { waiver, workspace } = resolved;
		const mode = photoCaptureModeForKind(photoCaptureSettings(workspace), args.kind);
		if (mode === 'off') {
			return {
				ok: false as const,
				status: 400,
				message: `This waiver does not accept a ${photoCaptureKindLabel(args.kind)}.`
			};
		}

		const now = Date.now();
		const windowStart = now - PHOTO_UPLOAD_RATE_WINDOW_MS;
		const clientUploads = await ctx.db
			.query('waiver_photo_uploads')
			.withIndex('by_waiverId_and_clientKey_and_createdAt', (q) =>
				q.eq('waiverId', waiver._id).eq('clientKey', args.clientKey).gte('createdAt', windowStart)
			)
			.take(PHOTO_UPLOAD_CLIENT_RATE_LIMIT);
		// Without a client address every signer would share one bucket, so only the
		// waiver-wide cap applies then.
		if (args.clientKey !== 'unknown' && clientUploads.length >= PHOTO_UPLOAD_CLIENT_RATE_LIMIT) {
			return {
				ok: false as const,
				status: 429,
				message: 'Too many photo uploads from this device. Please wait a few minutes and try again.'
			};
		}
		const waiverUploads = await ctx.db
			.query('waiver_photo_uploads')
			.withIndex('by_waiverId_and_createdAt', (q) =>
				q.eq('waiverId', waiver._id).gte('createdAt', windowStart)
			)
			.take(PHOTO_UPLOAD_WAIVER_RATE_LIMIT);
		if (waiverUploads.length >= PHOTO_UPLOAD_WAIVER_RATE_LIMIT) {
			return {
				ok: false as const,
				status: 429,
				message: 'Too many photo uploads right now. Please wait a few minutes and try again.'
			};
		}

		const uploadToken = crypto.randomUUID();
		const uploadId = await ctx.db.insert('waiver_photo_uploads', {
			workspaceId: waiver.workspaceId,
			waiverId: waiver._id,
			kind: args.kind,
			uploadToken,
			clientKey: args.clientKey,
			status: 'issued',
			createdAt: now,
			expiresAt: now + PHOTO_UPLOAD_RESERVATION_TTL_MS
		});
		return { ok: true as const, uploadId, uploadToken };
	}
});

/**
 * Records the file the `/photo-uploads` endpoint just stored. If the stored
 * file fails the checks, or the reservation is gone, the file is deleted so
 * nothing is left in storage without a row pointing to it.
 */
export const completePublicPhotoUpload = internalMutation({
	args: {
		uploadId: v.id('waiver_photo_uploads'),
		storageId: v.id('_storage')
	},
	returns: v.union(
		v.object({ ok: v.literal(true) }),
		v.object({ ok: v.literal(false), message: v.string() })
	),
	handler: async (ctx, args) => {
		const upload = await ctx.db.get(args.uploadId);
		const metadataError = photoUploadMetadataError(await ctx.db.system.get(args.storageId));
		if (!upload || upload.status !== 'issued' || metadataError) {
			await ctx.storage.delete(args.storageId);
			if (upload?.status === 'issued') {
				await ctx.db.delete(upload._id);
			}
			return {
				ok: false as const,
				message: metadataError ?? 'This photo upload expired. Please add the photo again.'
			};
		}
		const now = Date.now();
		await ctx.db.patch(upload._id, {
			status: 'attached',
			storageId: args.storageId,
			expiresAt: now + PHOTO_UPLOAD_TTL_MS
		});
		return { ok: true as const };
	}
});

/** Releases a reservation whose file never reached storage. */
export const cancelPublicPhotoUpload = internalMutation({
	args: { uploadId: v.id('waiver_photo_uploads') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const upload = await ctx.db.get(args.uploadId);
		if (upload?.status === 'issued') {
			await ctx.db.delete(upload._id);
		}
		return null;
	}
});

/**
 * Issues short-lived view links for a submission's photos. Only workspace
 * members get links, and each link stops working after a few minutes or as
 * soon as the member loses access.
 */
export const issueSubmissionPhotoViewUrls = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions')
	},
	returns: v.object({
		participantPhotoUrl: v.union(v.string(), v.null()),
		idPhotoUrl: v.union(v.string(), v.null()),
		expiresAt: v.number()
	}),
	handler: async (ctx, args) => {
		const access = await requireWorkspaceMember(ctx, args.workspaceId);
		const submission = await ctx.db.get(args.submissionId);
		if (!submission || submission.workspaceId !== args.workspaceId) {
			throw new ConvexError({ code: 'not_found', message: 'Submission not found.' });
		}
		const siteUrl = process.env.CONVEX_SITE_URL;
		if (!siteUrl) {
			throw new ConvexError({ code: 'misconfigured', message: 'Photo links are unavailable.' });
		}
		const expiresAt = Date.now() + PHOTO_VIEW_TOKEN_TTL_MS;

		const issue = async (storageId: Id<'_storage'> | undefined) => {
			if (!storageId) return null;
			const token = crypto.randomUUID();
			await ctx.db.insert('submission_photo_view_tokens', {
				workspaceId: args.workspaceId,
				userId: access.user._id,
				storageId,
				token,
				expiresAt
			});
			const url = new URL('/submission-photos', siteUrl);
			url.searchParams.set('token', token);
			return url.toString();
		};

		return {
			participantPhotoUrl: await issue(submission.participantPhotoStorageId),
			idPhotoUrl: await issue(submission.idPhotoStorageId),
			expiresAt
		};
	}
});

/** Resolves a view link for the `/submission-photos` endpoint. */
export const resolveSubmissionPhotoViewToken = internalQuery({
	args: { token: v.string() },
	returns: v.union(v.null(), v.id('_storage')),
	handler: async (ctx, args) => {
		const viewToken = await ctx.db
			.query('submission_photo_view_tokens')
			.withIndex('by_token', (q) => q.eq('token', args.token))
			.unique();
		if (!viewToken || viewToken.expiresAt < Date.now()) {
			return null;
		}
		const membership = await ctx.db
			.query('workspace_memberships')
			.withIndex('by_workspaceId_and_userId', (q) =>
				q.eq('workspaceId', viewToken.workspaceId).eq('userId', viewToken.userId)
			)
			.unique();
		if (!membership || membership.status !== 'active') {
			return null;
		}
		return viewToken.storageId;
	}
});

/**
 * Deletes upload reservations and photos that expired without a submission,
 * and expired photo view links.
 */
export const pruneExpiredPhotoUploadsCron = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const now = Date.now();
		let hasMore = false;
		for (const status of ['issued', 'attached'] as const) {
			const expired = await ctx.db
				.query('waiver_photo_uploads')
				.withIndex('by_status_and_expiresAt', (q) => q.eq('status', status).lt('expiresAt', now))
				.take(PRUNE_BATCH_SIZE);
			for (const upload of expired) {
				if (upload.storageId) {
					try {
						await ctx.storage.delete(upload.storageId);
					} catch (error) {
						console.warn('[pruneExpiredPhotoUploads] failed to delete storage', {
							uploadId: upload._id,
							error
						});
					}
				}
				await ctx.db.delete(upload._id);
			}
			if (expired.length === PRUNE_BATCH_SIZE) {
				hasMore = true;
			}
		}

		const expiredViewTokens = await ctx.db
			.query('submission_photo_view_tokens')
			.withIndex('by_expiresAt', (q) => q.lt('expiresAt', now))
			.take(PRUNE_BATCH_SIZE);
		for (const viewToken of expiredViewTokens) {
			await ctx.db.delete(viewToken._id);
		}
		if (expiredViewTokens.length === PRUNE_BATCH_SIZE) {
			hasMore = true;
		}

		if (hasMore) {
			await ctx.scheduler.runAfter(0, internal.photoUploads.pruneExpiredPhotoUploadsCron, {});
		}
		return null;
	}
});
