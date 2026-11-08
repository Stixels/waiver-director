import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { workspaceHasBillingFeature } from './lib/billing';
import { submissionsForBooking } from './lib/bookingSignatures';
import { normalizeCustomerEmail } from './lib/customers';
import { configuredFromEmail } from './lib/emailAddress';
import { requireWorkspaceMember, requireWorkspaceOwner } from './lib/waivers';
import { getWorkspacePolicyRecord, policyFromRecord } from './lib/waiverPolicyRecords';
import {
	nextReuseLookupAttempts,
	normalizeReminderLeadHours,
	normalizeValidityDays,
	reuseLookupAllowed,
	submissionReuseEligibility
} from './lib/waiverPolicies';

const MAX_CUSTOMER_SUBMISSIONS_CHECKED = 25;

const policyValue = v.object({
	reuseEnabled: v.boolean(),
	validityDays: v.union(v.number(), v.null()),
	resignOnNewVersion: v.boolean(),
	guestReminders: v.object({
		enabled: v.boolean(),
		leadHours: v.number()
	})
});

export const getWorkspaceWaiverPolicy = query({
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({
		policy: policyValue,
		canEdit: v.boolean(),
		reminderDelivery: v.object({
			hasEmailFeature: v.boolean(),
			replyToVerified: v.boolean(),
			senderConfigured: v.boolean()
		})
	}),
	handler: async (ctx, args) => {
		const { membership } = await requireWorkspaceMember(ctx, args.workspaceId);
		const [record, emailSettings, hasEmailFeature] = await Promise.all([
			getWorkspacePolicyRecord(ctx, args.workspaceId),
			ctx.db
				.query('workspace_email_settings')
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
				.unique(),
			workspaceHasBillingFeature(ctx, args.workspaceId, 'email_followups')
		]);

		return {
			policy: policyFromRecord(record),
			canEdit: membership.role === 'owner',
			reminderDelivery: {
				hasEmailFeature,
				replyToVerified: Boolean(emailSettings?.replyToEmail && emailSettings.replyToVerifiedAt),
				senderConfigured: configuredFromEmail() !== null
			}
		};
	}
});

export const updateWorkspaceWaiverPolicy = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		policy: policyValue
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await requireWorkspaceOwner(ctx, args.workspaceId, 'change re-sign and reminder rules');

		const validityDays = normalizeValidityDays(args.policy.validityDays);
		const guestReminderLeadHours = normalizeReminderLeadHours(args.policy.guestReminders.leadHours);
		const fields = {
			reuseEnabled: args.policy.reuseEnabled,
			validityDays: validityDays ?? undefined,
			resignOnNewVersion: args.policy.resignOnNewVersion,
			guestRemindersEnabled: args.policy.guestReminders.enabled,
			guestReminderLeadHours,
			updatedAt: Date.now()
		};

		const existing = await getWorkspacePolicyRecord(ctx, args.workspaceId);
		if (existing) {
			await ctx.db.patch(existing._id, fields);
		} else {
			await ctx.db.insert('workspace_waiver_policies', {
				workspaceId: args.workspaceId,
				...fields
			});
		}
		return null;
	}
});

/** Loads a booking reachable from a public booking link, enforcing the same checks as the signing page. */
async function requirePublicBooking(ctx: MutationCtx, slug: string, lookupToken: string) {
	const unavailable = () =>
		new ConvexError({
			code: 'not_found',
			message: 'This booking is no longer available for waiver signing.'
		});

	const waiver = await ctx.db
		.query('workspace_waivers')
		.withIndex('by_publicSlug', (q) => q.eq('publicSlug', slug))
		.unique();
	if (!waiver || !waiver.publishedVersionId) throw unavailable();

	const booking = await ctx.db
		.query('bookings')
		.withIndex('by_lookupToken', (q) => q.eq('lookupToken', lookupToken))
		.unique();
	if (!booking || booking.workspaceId !== waiver.workspaceId || booking.status !== 'active') {
		throw unavailable();
	}

	const workspace = await ctx.db.get(waiver.workspaceId);
	if (!workspace || workspace.status === 'archived') throw unavailable();
	if (!(await workspaceHasBillingFeature(ctx, waiver.workspaceId, 'waiver_publishing'))) {
		throw unavailable();
	}

	return { waiver, booking, publishedVersionId: waiver.publishedVersionId };
}

async function recordFailedLookup(ctx: MutationCtx, booking: Doc<'bookings'>, now: number) {
	const attempts = await ctx.db
		.query('booking_waiver_reuse_attempts')
		.withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
		.unique();
	const next = nextReuseLookupAttempts(attempts, now);
	if (attempts) {
		await ctx.db.patch(attempts._id, next);
	} else {
		await ctx.db.insert('booking_waiver_reuse_attempts', {
			workspaceId: booking.workspaceId,
			bookingId: booking._id,
			...next
		});
	}
}

export const claimExistingWaiverForBooking = mutation({
	args: {
		slug: v.string(),
		lookupToken: v.string(),
		email: v.string(),
		dateOfBirth: v.string()
	},
	returns: v.union(
		v.object({
			status: v.literal('covered'),
			signerName: v.string(),
			signedAt: v.number(),
			expiresAt: v.union(v.number(), v.null()),
			minorNames: v.array(v.string())
		}),
		v.object({ status: v.literal('already_covered'), signerName: v.string() }),
		v.object({
			status: v.literal('needs_new_signature'),
			reason: v.union(v.literal('expired'), v.literal('new_version'))
		}),
		v.object({ status: v.literal('not_found') }),
		v.object({ status: v.literal('rate_limited') })
	),
	handler: async (ctx, args) => {
		const { booking, publishedVersionId } = await requirePublicBooking(
			ctx,
			args.slug,
			args.lookupToken
		);
		const policy = policyFromRecord(await getWorkspacePolicyRecord(ctx, booking.workspaceId));
		if (!policy.reuseEnabled) {
			throw new ConvexError({
				code: 'forbidden',
				message: 'This business asks every guest to sign for each visit.'
			});
		}

		const email = normalizeCustomerEmail(args.email);
		const dateOfBirth = args.dateOfBirth.trim();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			throw new ConvexError({ code: 'invalid_argument', message: 'Enter a valid email address.' });
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || isNaN(Date.parse(dateOfBirth))) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter a valid date of birth.'
			});
		}

		const now = Date.now();
		const attempts = await ctx.db
			.query('booking_waiver_reuse_attempts')
			.withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
			.unique();
		if (!reuseLookupAllowed(attempts, now)) {
			return { status: 'rate_limited' as const };
		}

		const customer = await ctx.db
			.query('customers')
			.withIndex('by_workspaceId_and_normalizedEmail', (q) =>
				q.eq('workspaceId', booking.workspaceId).eq('normalizedEmail', email)
			)
			.unique();
		// Email and date of birth must both match a signed submission before anything is revealed.
		const submissions = customer
			? await ctx.db
					.query('waiver_submissions')
					.withIndex('by_customerId_and_submittedAt', (q) => q.eq('customerId', customer._id))
					.order('desc')
					.take(MAX_CUSTOMER_SUBMISSIONS_CHECKED)
			: [];
		const submission = submissions.find(
			(candidate) =>
				candidate.workspaceId === booking.workspaceId && candidate.signerDateOfBirth === dateOfBirth
		);
		if (!customer || !submission) {
			await recordFailedLookup(ctx, booking, now);
			return { status: 'not_found' as const };
		}

		const existingReuse = await ctx.db
			.query('booking_waiver_reuses')
			.withIndex('by_bookingId_and_customerId', (q) =>
				q.eq('bookingId', booking._id).eq('customerId', customer._id)
			)
			.first();
		const bookingSubmissions = existingReuse ? [] : await submissionsForBooking(ctx, booking._id);
		if (existingReuse || bookingSubmissions.some((entry) => entry.customerId === customer._id)) {
			return { status: 'already_covered' as const, signerName: submission.signerName };
		}

		const eligibility = submissionReuseEligibility({
			policy,
			submission: { submittedAt: submission.submittedAt, versionId: submission.versionId },
			publishedVersionId,
			now
		});
		if (!eligibility.eligible) {
			return {
				status: 'needs_new_signature' as const,
				reason:
					eligibility.reason === 'new_version' ? ('new_version' as const) : ('expired' as const)
			};
		}

		const minorNames = submission.minors.map((minor) => minor.fullName);
		await ctx.db.insert('booking_waiver_reuses', {
			workspaceId: booking.workspaceId,
			bookingId: booking._id,
			customerId: customer._id,
			submissionId: submission._id,
			signerName: submission.signerName,
			signerEmail: submission.signerEmail,
			minorNames,
			reusedAt: now
		});
		// The reused waiver covers the signer and every minor listed on it, matching how a
		// fresh signature is counted.
		await ctx.db.patch(booking._id, {
			signedCount: booking.signedCount + 1 + minorNames.length
		});
		await ctx.db.patch(customer._id, {
			lastSeenAt: Math.max(customer.lastSeenAt, now),
			visitCount: customer.visitCount + 1,
			latestBookingId: booking._id
		});

		return {
			status: 'covered' as const,
			signerName: submission.signerName,
			signedAt: submission.submittedAt,
			expiresAt: eligibility.expiresAt,
			minorNames
		};
	}
});
