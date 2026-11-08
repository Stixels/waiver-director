import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { bookingStatusValidator } from './lib/bookings';
import { submissionsForBooking } from './lib/bookingSignatures';
import {
	computeRosterTotals,
	isValidParticipantIndex,
	rosterPeopleForSubmission,
	unsignedParticipantCount
} from './lib/checkIns';
import { assertWorkspaceRecord, requireWorkspaceMember } from './lib/waivers';

const MAX_ROSTER_SPAN_MS = 48 * 60 * 60 * 1000;
const MAX_ROSTER_BOOKINGS = 200;
const MAX_ROSTER_WALK_IN_SUBMISSIONS = 300;

const rosterPersonValue = v.object({
	submissionId: v.id('waiver_submissions'),
	participantIndex: v.number(),
	name: v.string(),
	kind: v.union(v.literal('signer'), v.literal('minor')),
	checkedInAt: v.union(v.number(), v.null())
});

const rosterBookingValue = v.object({
	bookingId: v.id('bookings'),
	providerBookingId: v.string(),
	activityName: v.string(),
	startTime: v.union(v.string(), v.null()),
	startAt: v.union(v.number(), v.null()),
	leadCustomerName: v.union(v.string(), v.null()),
	status: bookingStatusValidator,
	participantCount: v.number(),
	signedCount: v.number(),
	unsignedCount: v.number(),
	people: v.array(rosterPersonValue)
});

const rosterWalkInValue = v.object({
	submissionId: v.id('waiver_submissions'),
	submittedAt: v.number(),
	people: v.array(rosterPersonValue)
});

const dayRosterValue = v.object({
	bookings: v.array(rosterBookingValue),
	walkIns: v.array(rosterWalkInValue),
	totals: v.object({
		expected: v.number(),
		signed: v.number(),
		arrived: v.number(),
		unsigned: v.number()
	}),
	hasMoreBookings: v.boolean(),
	hasMoreWalkIns: v.boolean()
});

async function rosterPeopleWithCheckIns(ctx: QueryCtx, submission: Doc<'waiver_submissions'>) {
	const checkIns = await ctx.db
		.query('participant_check_ins')
		.withIndex('by_submissionId_and_participantIndex', (q) => q.eq('submissionId', submission._id))
		.take(submission.minors.length + 1);
	const checkedInAtByIndex = new Map<number, number>();
	for (const checkIn of checkIns) {
		if (checkIn.workspaceId !== submission.workspaceId) continue;
		checkedInAtByIndex.set(checkIn.participantIndex, checkIn.checkedInAt);
	}
	return rosterPeopleForSubmission(submission, checkedInAtByIndex);
}

export const getDayRoster = query({
	args: {
		workspaceId: v.id('workspaces'),
		dayStartAt: v.number(),
		dayEndAt: v.number()
	},
	returns: dayRosterValue,
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		if (
			!Number.isFinite(args.dayStartAt) ||
			!Number.isFinite(args.dayEndAt) ||
			args.dayEndAt <= args.dayStartAt
		) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Choose a valid check-in date.'
			});
		}

		const dayEndAt = Math.min(args.dayEndAt, args.dayStartAt + MAX_ROSTER_SPAN_MS);

		const dayBookings = await ctx.db
			.query('bookings')
			.withIndex('by_workspaceId_and_startAt', (q) =>
				q
					.eq('workspaceId', args.workspaceId)
					.gte('startAt', args.dayStartAt)
					.lt('startAt', dayEndAt)
			)
			.take(MAX_ROSTER_BOOKINGS + 1);
		const hasMoreBookings = dayBookings.length > MAX_ROSTER_BOOKINGS;

		const bookings = await Promise.all(
			dayBookings.slice(0, MAX_ROSTER_BOOKINGS).map(async (booking) => {
				const submissions = (await submissionsForBooking(ctx, booking._id))
					.filter((submission) => submission.workspaceId === args.workspaceId)
					.sort((a, b) => a.submittedAt - b.submittedAt);
				const people = (
					await Promise.all(
						submissions.map((submission) => rosterPeopleWithCheckIns(ctx, submission))
					)
				).flat();

				return {
					bookingId: booking._id,
					providerBookingId: booking.providerBookingId,
					activityName: booking.activityName,
					startTime: booking.startTime ?? null,
					startAt: booking.startAt ?? null,
					leadCustomerName: booking.leadCustomerName ?? null,
					status: booking.status,
					participantCount: booking.participantCount,
					signedCount: booking.signedCount,
					unsignedCount:
						booking.status === 'canceled'
							? 0
							: unsignedParticipantCount(booking.participantCount, people.length),
					people
				};
			})
		);

		const windowSubmissions = await ctx.db
			.query('waiver_submissions')
			.withIndex('by_workspaceId_and_submittedAt', (q) =>
				q
					.eq('workspaceId', args.workspaceId)
					.gte('submittedAt', args.dayStartAt)
					.lt('submittedAt', dayEndAt)
			)
			.take(MAX_ROSTER_WALK_IN_SUBMISSIONS + 1);
		const hasMoreWalkIns = windowSubmissions.length > MAX_ROSTER_WALK_IN_SUBMISSIONS;
		const walkIns = await Promise.all(
			windowSubmissions
				.slice(0, MAX_ROSTER_WALK_IN_SUBMISSIONS)
				.filter((submission) => submission.bookingId === undefined)
				.map(async (submission) => ({
					submissionId: submission._id,
					submittedAt: submission.submittedAt,
					people: await rosterPeopleWithCheckIns(ctx, submission)
				}))
		);

		bookings.sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0));

		return {
			bookings,
			walkIns,
			totals: computeRosterTotals(
				bookings,
				walkIns.flatMap((walkIn) => walkIn.people)
			),
			hasMoreBookings,
			hasMoreWalkIns
		};
	}
});

export const setParticipantArrived = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions'),
		participantIndex: v.number(),
		arrived: v.boolean()
	},
	returns: v.object({
		checkedInAt: v.union(v.number(), v.null())
	}),
	handler: async (ctx, args) => {
		const { user } = await requireWorkspaceMember(ctx, args.workspaceId);
		const submission = assertWorkspaceRecord(
			await ctx.db.get(args.submissionId),
			args.workspaceId,
			'Submission not found.'
		);

		if (!isValidParticipantIndex(args.participantIndex, submission.minors.length)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Choose a valid participant.'
			});
		}

		const existing = await ctx.db
			.query('participant_check_ins')
			.withIndex('by_submissionId_and_participantIndex', (q) =>
				q.eq('submissionId', submission._id).eq('participantIndex', args.participantIndex)
			)
			.first();

		if (!args.arrived) {
			if (existing) await ctx.db.delete(existing._id);
			return { checkedInAt: null };
		}

		if (existing) {
			return { checkedInAt: existing.checkedInAt };
		}

		const checkedInAt = Date.now();
		await ctx.db.insert('participant_check_ins', {
			workspaceId: args.workspaceId,
			submissionId: submission._id,
			bookingId: submission.bookingId,
			participantIndex: args.participantIndex,
			checkedInAt,
			checkedInByUserId: user._id
		});

		return { checkedInAt };
	}
});
