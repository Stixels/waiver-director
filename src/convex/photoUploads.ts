import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import {
	PHOTO_UPLOAD_RATE_LIMIT,
	PHOTO_UPLOAD_RATE_WINDOW_MS,
	PHOTO_UPLOAD_TTL_MS,
	photoCaptureKindLabel,
	photoCaptureKindValidator,
	photoCaptureModeForKind,
	photoCaptureModeValidator,
	photoCaptureSettings,
	photoCaptureSettingsValidator,
	photoUploadMetadataError
} from './lib/photoCapture';
import { requireLivePublicWaiver, storageIdIsAssigned } from './lib/photoUploads';
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
 * Issues a one-time upload URL for a signer's participant photo or photo ID.
 * Public: signers are not signed in. Only works for a live waiver whose
 * workspace has turned that capture kind on.
 */
export const generatePublicPhotoUploadUrl = mutation({
	args: {
		slug: v.string(),
		kind: photoCaptureKindValidator
	},
	returns: v.object({
		uploadUrl: v.string(),
		uploadToken: v.string()
	}),
	handler: async (ctx, args) => {
		const { waiver, workspace } = await requireLivePublicWaiver(ctx, args.slug);
		const mode = photoCaptureModeForKind(photoCaptureSettings(workspace), args.kind);
		if (mode === 'off') {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `This waiver does not accept a ${photoCaptureKindLabel(args.kind)}.`
			});
		}

		const now = Date.now();
		const recentUploads = await ctx.db
			.query('waiver_photo_uploads')
			.withIndex('by_waiverId_and_createdAt', (q) =>
				q.eq('waiverId', waiver._id).gte('createdAt', now - PHOTO_UPLOAD_RATE_WINDOW_MS)
			)
			.take(PHOTO_UPLOAD_RATE_LIMIT);
		if (recentUploads.length >= PHOTO_UPLOAD_RATE_LIMIT) {
			throw new ConvexError({
				code: 'rate_limited',
				message: 'Too many photo uploads right now. Please wait a few minutes and try again.'
			});
		}

		const uploadToken = crypto.randomUUID();
		const uploadUrl = await ctx.storage.generateUploadUrl();
		await ctx.db.insert('waiver_photo_uploads', {
			workspaceId: waiver.workspaceId,
			waiverId: waiver._id,
			kind: args.kind,
			uploadToken,
			status: 'issued',
			createdAt: now,
			expiresAt: now + PHOTO_UPLOAD_TTL_MS
		});
		return { uploadUrl, uploadToken };
	}
});

/**
 * Records the storage file a signer just uploaded against their upload token,
 * so it can be cleaned up if they never submit. Invalid files are deleted
 * straight away.
 */
export const attachPublicPhotoUpload = mutation({
	args: {
		uploadToken: v.string(),
		storageId: v.id('_storage')
	},
	returns: v.union(
		v.object({ ok: v.literal(true) }),
		v.object({ ok: v.literal(false), message: v.string() })
	),
	handler: async (ctx, args) => {
		const upload = await ctx.db
			.query('waiver_photo_uploads')
			.withIndex('by_uploadToken', (q) => q.eq('uploadToken', args.uploadToken.trim()))
			.unique();
		const now = Date.now();
		if (!upload || upload.status !== 'issued' || upload.expiresAt < now) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'This photo upload expired. Please add the photo again.'
			});
		}

		const assigned = await storageIdIsAssigned(ctx, args.storageId);
		if (assigned.photoUpload || assigned.logoUpload) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'This photo is already assigned.'
			});
		}

		const metadata = await ctx.db.system.get(args.storageId);
		// The file must have been uploaded after this token was issued, so a token
		// can never claim a file that already existed in storage.
		if (metadata && metadata._creationTime < upload.createdAt) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'This photo upload does not match. Please add the photo again.'
			});
		}
		const metadataError = photoUploadMetadataError(metadata);
		if (metadataError) {
			if (metadata) {
				await ctx.storage.delete(args.storageId);
			}
			await ctx.db.delete(upload._id);
			return { ok: false as const, message: metadataError };
		}

		await ctx.db.patch(upload._id, { status: 'attached', storageId: args.storageId });
		return { ok: true as const };
	}
});

/** Deletes upload tokens (and their files) that expired without a submission. */
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
		if (hasMore) {
			await ctx.scheduler.runAfter(0, internal.photoUploads.pruneExpiredPhotoUploadsCron, {});
		}
		return null;
	}
});
