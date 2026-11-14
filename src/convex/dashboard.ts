import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import { requireWorkspaceFeature } from './lib/billing';
import { requireWorkspaceMember } from './lib/waivers';
import {
	DAY_MS,
	customerActivityByDay,
	dayCount,
	dayIndexFor,
	resolveDayBoundaries
} from './lib/dayBuckets';

const MAX_RANGE_DAYS = 30;
// A 30-day range that crosses a daylight saving change is 30 days plus an hour.
const MAX_RANGE_MS = MAX_RANGE_DAYS * DAY_MS + 2 * 60 * 60 * 1000;
const MAX_DAY_BOUNDARIES = MAX_RANGE_DAYS + 1;
const DASHBOARD_COUNT_CAP = 1000;

const trendDayValue = v.object({
	dayStartAt: v.number(),
	count: v.number()
});

const kpiComparisonValue = v.object({
	currentTotal: v.number(),
	previousTotal: v.number()
});

function assertDayRange(startAt: number, endAt: number, dayBoundaries: number[] | undefined) {
	if (endAt <= startAt) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'The date range must include at least one day.'
		});
	}
	if (
		endAt - startAt > MAX_RANGE_MS ||
		(dayBoundaries && dayBoundaries.length > MAX_DAY_BOUNDARIES)
	) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'The date range cannot exceed 30 days.'
		});
	}
}

function countByDay(boundaries: number[], timestamps: Iterable<number | undefined>): number[] {
	const counts = new Array<number>(dayCount(boundaries)).fill(0);
	for (const timestamp of timestamps) {
		if (typeof timestamp !== 'number') continue;
		const index = dayIndexFor(boundaries, timestamp);
		if (index >= 0) counts[index] += 1;
	}
	return counts;
}

function sumRange(counts: number[], fromIndex: number, toIndex: number): number {
	let total = 0;
	for (let index = Math.max(0, fromIndex); index < Math.min(counts.length, toIndex); index += 1) {
		total += counts[index];
	}
	return total;
}

function dayBucketsFromCounts(
	boundaries: number[],
	counts: number[],
	fromIndex: number,
	toIndex: number
): Array<{ dayStartAt: number; count: number }> {
	const buckets: Array<{ dayStartAt: number; count: number }> = [];
	for (let index = Math.max(0, fromIndex); index < Math.min(counts.length, toIndex); index += 1) {
		buckets.push({
			dayStartAt: boundaries[index],
			count: counts[index]
		});
	}
	return buckets;
}

function isActiveBooking(booking: { status?: string }) {
	return booking.status !== 'canceled';
}

export const getDashboardSnapshot = query({
	args: {
		workspaceId: v.id('workspaces'),
		todayStartAt: v.number(),
		todayEndAt: v.number(),
		trendStartAt: v.number(),
		// Exact local midnights from trendStartAt through todayEndAt (15 values).
		// Optional so older clients keep working.
		dayBoundaries: v.optional(v.array(v.number()))
	},
	returns: v.object({
		kpi: v.object({
			bookingsToday: v.number(),
			submissionsToday: v.number(),
			// Capped at 1000; values over the cap are displayed as "1000+"
			followUpsSent: v.number(),
			newCustomersToday: v.number()
		}),
		kpiTrends: v.object({
			bookingsToday: v.array(trendDayValue),
			submissionsToday: v.array(trendDayValue),
			followUpsSent: v.array(trendDayValue),
			newCustomersToday: v.array(trendDayValue)
		}),
		kpiComparisons: v.object({
			bookingsToday: kpiComparisonValue,
			submissionsToday: kpiComparisonValue,
			followUpsSent: kpiComparisonValue,
			newCustomersToday: kpiComparisonValue
		}),
		emailPipeline: v.object({
			queued: v.number(),
			sent: v.number(),
			failed: v.number(),
			blocked: v.number(),
			unscheduled: v.number()
		}),
		recentQueued: v.array(
			v.object({
				followUpId: v.id('email_follow_ups'),
				signerName: v.string(),
				signerEmail: v.string(),
				scheduledAt: v.union(v.number(), v.null()),
				submittedAt: v.number()
			})
		)
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		assertDayRange(args.trendStartAt, args.todayEndAt, args.dayBoundaries);
		const boundaries = resolveDayBoundaries(args.trendStartAt, args.todayEndAt, args.dayBoundaries);

		const [
			trendBookings,
			todaySubmissions,
			trendSubmissions,
			queuedFollowUps,
			trendSentFollowUps,
			todayCustomers,
			trendCustomers
		] = await Promise.all([
			ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_startAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('startAt', args.trendStartAt)
						.lt('startAt', args.todayEndAt)
				)
				.order('desc')
				.take(5000),
			ctx.db
				.query('waiver_submissions')
				.withIndex('by_workspaceId_and_submittedAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('submittedAt', args.todayStartAt)
						.lt('submittedAt', args.todayEndAt)
				)
				.take(DASHBOARD_COUNT_CAP + 1),
			ctx.db
				.query('waiver_submissions')
				.withIndex('by_workspaceId_and_submittedAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('submittedAt', args.trendStartAt)
						.lt('submittedAt', args.todayEndAt)
				)
				.order('desc')
				.take(2000),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'queued')
				)
				.order('desc')
				.take(DASHBOARD_COUNT_CAP + 1),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status_and_sentAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.eq('status', 'sent')
						.gte('sentAt', args.trendStartAt)
						.lt('sentAt', args.todayEndAt)
				)
				.order('desc')
				.take(DASHBOARD_COUNT_CAP + 1),
			ctx.db
				.query('customers')
				.withIndex('by_workspaceId_and_firstSeenAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('firstSeenAt', args.todayStartAt)
						.lt('firstSeenAt', args.todayEndAt)
				)
				.take(DASHBOARD_COUNT_CAP + 1),
			ctx.db
				.query('customers')
				.withIndex('by_workspaceId_and_firstSeenAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('firstSeenAt', args.trendStartAt)
						.lt('firstSeenAt', args.todayEndAt)
				)
				.order('desc')
				.take(5000)
		]);

		// The range ends at the end of today, so today is always its last day.
		const todayIndex = dayCount(boundaries) - 1;
		const currentStartIndex = Math.max(0, todayIndex - 6);
		const trendFor = (counts: number[]) =>
			dayBucketsFromCounts(boundaries, counts, currentStartIndex, todayIndex + 1);
		const comparisonFor = (counts: number[]) => ({
			currentTotal: sumRange(counts, currentStartIndex, todayIndex + 1),
			previousTotal: sumRange(counts, 0, currentStartIndex)
		});

		const activeTrendBookings = trendBookings.filter(isActiveBooking);
		const bookingsToday = activeTrendBookings.filter(
			(b) => (b.startAt ?? 0) >= args.todayStartAt && (b.startAt ?? 0) < args.todayEndAt
		);
		const submissionsToday = todaySubmissions.length;

		const bookingTrendCounts = countByDay(
			boundaries,
			activeTrendBookings.map((booking) => booking.startAt)
		);
		const bookingsTodayTrend = trendFor(bookingTrendCounts);
		const bookingsComparison = comparisonFor(bookingTrendCounts);

		const trendCounts = countByDay(
			boundaries,
			trendSubmissions.map((submission) => submission.submittedAt)
		);
		const submissionsTodayTrend = trendFor(trendCounts);
		const submissionsComparison = comparisonFor(trendCounts);

		const followUpSentTrendCounts = countByDay(
			boundaries,
			trendSentFollowUps.map((followUp) => followUp.sentAt)
		);
		const followUpsSentTrend = trendFor(followUpSentTrendCounts);
		const followUpsComparison = comparisonFor(followUpSentTrendCounts);

		const customerTrendCounts = countByDay(
			boundaries,
			trendCustomers.map((customer) => customer.firstSeenAt)
		);
		const newCustomersTodayTrend = trendFor(customerTrendCounts);
		const customersComparison = comparisonFor(customerTrendCounts);

		// Email pipeline — run all status counts in parallel
		const [sentCount, failedCount, blockedCount, unscheduledCount] = await Promise.all([
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'sent')
				)
				.take(1000)
				.then((r) => r.length),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'failed')
				)
				.take(1000)
				.then((r) => r.length),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'blocked')
				)
				.take(1000)
				.then((r) => r.length),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'unscheduled')
				)
				.take(1000)
				.then((r) => r.length)
		]);

		const recentQueued = queuedFollowUps.slice(0, 10).map((f) => ({
			followUpId: f._id,
			signerName: f.signerName,
			signerEmail: f.signerEmail,
			scheduledAt: f.scheduledAt ?? null,
			submittedAt: f.submittedAt
		}));

		return {
			kpi: {
				bookingsToday: bookingsToday.length,
				submissionsToday,
				followUpsSent: followUpSentTrendCounts[todayIndex] ?? 0,
				newCustomersToday: todayCustomers.length
			},
			kpiTrends: {
				bookingsToday: bookingsTodayTrend,
				submissionsToday: submissionsTodayTrend,
				followUpsSent: followUpsSentTrend,
				newCustomersToday: newCustomersTodayTrend
			},
			kpiComparisons: {
				bookingsToday: bookingsComparison,
				submissionsToday: submissionsComparison,
				followUpsSent: followUpsComparison,
				newCustomersToday: customersComparison
			},
			emailPipeline: {
				queued: queuedFollowUps.length,
				sent: sentCount,
				failed: failedCount,
				blocked: blockedCount,
				unscheduled: unscheduledCount
			},
			recentQueued
		};
	}
});

export const getAnalyticsSeries = query({
	args: {
		workspaceId: v.id('workspaces'),
		rangeStartAt: v.number(),
		rangeEndAt: v.number(),
		// Exact local midnights from rangeStartAt through rangeEndAt.
		dayBoundaries: v.optional(v.array(v.number()))
	},
	returns: v.object({
		submissionsByDay: v.array(trendDayValue),
		bookingsByDay: v.array(trendDayValue),
		comparisons: v.object({
			submissions: kpiComparisonValue,
			bookings: kpiComparisonValue,
			customerActivity: kpiComparisonValue
		}),
		emailTotals: v.object({
			sent: v.number(),
			queued: v.number(),
			failed: v.number(),
			blocked: v.number()
		}),
		customerActivityByDay: v.array(
			v.object({
				dayStartAt: v.number(),
				newCustomers: v.number(),
				returningCustomers: v.number()
			})
		)
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);
		await requireWorkspaceFeature(ctx, args.workspaceId, 'analytics');

		assertDayRange(args.rangeStartAt, args.rangeEndAt, args.dayBoundaries);
		const boundaries = resolveDayBoundaries(args.rangeStartAt, args.rangeEndAt, args.dayBoundaries);
		const rangeDays = dayCount(boundaries);

		const rangeDurationMs = args.rangeEndAt - args.rangeStartAt;
		const previousRangeStartAt = args.rangeStartAt - rangeDurationMs;
		const previousRangeEndAt = args.rangeStartAt;
		// The client only sends the selected range's local midnights, so the
		// previous period is split into 24-hour days counted back from its end.
		const previousBoundaries = resolveDayBoundaries(previousRangeStartAt, previousRangeEndAt);

		const [
			submissions,
			previousSubmissions,
			bookings,
			previousBookings,
			recentCustomers,
			sentFollowUps,
			queuedFollowUps,
			failedFollowUps,
			blockedFollowUps
		] = await Promise.all([
			ctx.db
				.query('waiver_submissions')
				.withIndex('by_workspaceId_and_submittedAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('submittedAt', args.rangeStartAt)
						.lt('submittedAt', args.rangeEndAt)
				)
				.order('desc')
				.take(10000),
			ctx.db
				.query('waiver_submissions')
				.withIndex('by_workspaceId_and_submittedAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('submittedAt', previousRangeStartAt)
						.lt('submittedAt', previousRangeEndAt)
				)
				.order('desc')
				.take(10000),
			ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_startAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('startAt', args.rangeStartAt)
						.lt('startAt', args.rangeEndAt)
				)
				.take(5000),
			ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_startAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('startAt', previousRangeStartAt)
						.lt('startAt', previousRangeEndAt)
				)
				.take(5000),
			// Customers first seen in either range, newest first. Anyone who
			// signed in these ranges but is not in this list was first seen
			// earlier, so they count as returning.
			ctx.db
				.query('customers')
				.withIndex('by_workspaceId_and_firstSeenAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('firstSeenAt', previousRangeStartAt)
						.lt('firstSeenAt', args.rangeEndAt)
				)
				.order('desc')
				.take(5000),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status_and_sentAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.eq('status', 'sent')
						.gte('sentAt', args.rangeStartAt)
						.lt('sentAt', args.rangeEndAt)
				)
				.take(1000),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status_and_scheduledAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.eq('status', 'queued')
						.gte('scheduledAt', args.rangeStartAt)
						.lt('scheduledAt', args.rangeEndAt)
				)
				.take(1000),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status_and_failedAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.eq('status', 'failed')
						.gte('failedAt', args.rangeStartAt)
						.lt('failedAt', args.rangeEndAt)
				)
				.take(1000),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'blocked')
				)
				.filter((q) =>
					q.or(
						q.and(
							q.gte(q.field('scheduledAt'), args.rangeStartAt),
							q.lt(q.field('scheduledAt'), args.rangeEndAt)
						),
						q.eq(q.field('scheduledAt'), undefined),
						q.eq(q.field('scheduledAt'), null)
					)
				)
				.take(1000)
		]);

		// Submissions by day
		const submissionCounts = countByDay(
			boundaries,
			submissions.map((submission) => submission.submittedAt)
		);
		const submissionsByDay = dayBucketsFromCounts(boundaries, submissionCounts, 0, rangeDays);

		// Bookings by day (canceled bookings are not counted)
		const activeBookings = bookings.filter(isActiveBooking);
		const activePreviousBookings = previousBookings.filter(isActiveBooking);
		const bookingCounts = countByDay(
			boundaries,
			activeBookings.map((booking) => booking.startAt)
		);
		const bookingsByDay = dayBucketsFromCounts(boundaries, bookingCounts, 0, rangeDays);

		const firstSeenAtByCustomerId = new Map<string, number>(
			recentCustomers.map((customer) => [customer._id, customer.firstSeenAt])
		);
		const customerActivity = customerActivityByDay(
			boundaries,
			submissions,
			firstSeenAtByCustomerId
		).map((day, index) => ({ dayStartAt: boundaries[index], ...day }));
		const previousCustomerActivity = customerActivityByDay(
			previousBoundaries,
			previousSubmissions,
			firstSeenAtByCustomerId
		);
		const totalCustomerActivity = (days: typeof previousCustomerActivity) =>
			days.reduce((total, day) => total + day.newCustomers + day.returningCustomers, 0);

		return {
			submissionsByDay,
			bookingsByDay,
			comparisons: {
				submissions: {
					currentTotal: submissions.length,
					previousTotal: previousSubmissions.length
				},
				bookings: {
					currentTotal: activeBookings.length,
					previousTotal: activePreviousBookings.length
				},
				customerActivity: {
					currentTotal: totalCustomerActivity(customerActivity),
					previousTotal: totalCustomerActivity(previousCustomerActivity)
				}
			},
			emailTotals: {
				sent: sentFollowUps.length,
				queued: queuedFollowUps.length,
				failed: failedFollowUps.length,
				blocked: blockedFollowUps.length
			},
			customerActivityByDay: customerActivity
		};
	}
});
