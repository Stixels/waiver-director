import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import { requireWorkspaceMember } from './lib/waivers';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_RANGE_MS = 90 * DAY_MS;
const DASHBOARD_COUNT_CAP = 1000;

const trendDayValue = v.object({
	dayLabel: v.string(),
	dayStartAt: v.number(),
	count: v.number()
});

const kpiComparisonValue = v.object({
	currentTotal: v.number(),
	previousTotal: v.number()
});

function floorToDay(epochMs: number): number {
	const d = new Date(epochMs);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dayLabel(epochMs: number): string {
	return new Date(epochMs).toLocaleDateString('en-US', { weekday: 'short' });
}

function analyticsDateLabel(epochMs: number): string {
	return new Date(epochMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildDayBuckets(
	startAt: number,
	endAt: number,
	counts: Map<number, number>,
	labelFn: (epochMs: number) => string
): Array<{ dayLabel: string; dayStartAt: number; count: number }> {
	const buckets: Array<{ dayLabel: string; dayStartAt: number; count: number }> = [];
	let cursor = floorToDay(startAt);
	const end = floorToDay(endAt);
	while (cursor <= end) {
		buckets.push({
			dayLabel: labelFn(cursor),
			dayStartAt: cursor,
			count: counts.get(cursor) ?? 0
		});
		cursor += DAY_MS;
	}
	return buckets;
}

function sumCountsBetween(counts: Map<number, number>, startAt: number, endAt: number): number {
	let total = 0;
	for (const [dayStartAt, count] of counts) {
		if (dayStartAt >= startAt && dayStartAt < endAt) {
			total += count;
		}
	}
	return total;
}

export const getDashboardSnapshot = query({
	args: {
		workspaceId: v.id('workspaces'),
		todayStartAt: v.number(),
		todayEndAt: v.number(),
		trendStartAt: v.number()
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
				.take(5000)
		]);

		const currentTrendStartAt = args.todayStartAt - 6 * DAY_MS;
		const previousTrendEndAt = currentTrendStartAt;

		const bookingsToday = trendBookings.filter(
			(b) => (b.startAt ?? 0) >= args.todayStartAt && (b.startAt ?? 0) < args.todayEndAt
		);
		const submissionsToday = todaySubmissions.length;

		const bookingTrendCounts = new Map<number, number>();
		for (const booking of trendBookings) {
			if (typeof booking.startAt !== 'number') continue;
			const day = floorToDay(booking.startAt);
			bookingTrendCounts.set(day, (bookingTrendCounts.get(day) ?? 0) + 1);
		}
		const bookingsTodayTrend = buildDayBuckets(
			currentTrendStartAt,
			args.todayStartAt,
			bookingTrendCounts,
			dayLabel
		);
		const bookingsComparison = {
			currentTotal: sumCountsBetween(bookingTrendCounts, currentTrendStartAt, args.todayEndAt),
			previousTotal: sumCountsBetween(bookingTrendCounts, args.trendStartAt, previousTrendEndAt)
		};

		const trendCounts = new Map<number, number>();
		for (const s of trendSubmissions) {
			if (s.submittedAt < args.trendStartAt) break;
			const day = floorToDay(s.submittedAt);
			trendCounts.set(day, (trendCounts.get(day) ?? 0) + 1);
		}
		const submissionsTodayTrend = buildDayBuckets(
			currentTrendStartAt,
			args.todayStartAt,
			trendCounts,
			dayLabel
		);
		const submissionsComparison = {
			currentTotal: sumCountsBetween(trendCounts, currentTrendStartAt, args.todayEndAt),
			previousTotal: sumCountsBetween(trendCounts, args.trendStartAt, previousTrendEndAt)
		};

		const followUpSentTrendCounts = new Map<number, number>();
		for (const followUp of trendSentFollowUps) {
			if (
				followUp.sentAt === undefined ||
				followUp.sentAt < args.trendStartAt ||
				followUp.sentAt >= args.todayEndAt
			) {
				continue;
			}
			const day = floorToDay(followUp.sentAt);
			followUpSentTrendCounts.set(day, (followUpSentTrendCounts.get(day) ?? 0) + 1);
		}
		const followUpsSentTrend = buildDayBuckets(
			currentTrendStartAt,
			args.todayStartAt,
			followUpSentTrendCounts,
			dayLabel
		);
		const followUpsComparison = {
			currentTotal: sumCountsBetween(followUpSentTrendCounts, currentTrendStartAt, args.todayEndAt),
			previousTotal: sumCountsBetween(
				followUpSentTrendCounts,
				args.trendStartAt,
				previousTrendEndAt
			)
		};

		const customerTrendCounts = new Map<number, number>();
		for (const customer of trendCustomers) {
			if (customer.firstSeenAt < args.trendStartAt || customer.firstSeenAt >= args.todayEndAt) {
				continue;
			}
			const day = floorToDay(customer.firstSeenAt);
			customerTrendCounts.set(day, (customerTrendCounts.get(day) ?? 0) + 1);
		}
		const newCustomersTodayTrend = buildDayBuckets(
			currentTrendStartAt,
			args.todayStartAt,
			customerTrendCounts,
			dayLabel
		);
		const customersComparison = {
			currentTotal: sumCountsBetween(customerTrendCounts, currentTrendStartAt, args.todayEndAt),
			previousTotal: sumCountsBetween(customerTrendCounts, args.trendStartAt, previousTrendEndAt)
		};

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
				followUpsSent: sumCountsBetween(
					followUpSentTrendCounts,
					args.todayStartAt,
					args.todayEndAt
				),
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
		rangeEndAt: v.number()
	},
	returns: v.object({
		submissionsByDay: v.array(trendDayValue),
		bookingsByDay: v.array(trendDayValue),
		emailTotals: v.object({
			sent: v.number(),
			queued: v.number(),
			failed: v.number(),
			blocked: v.number()
		}),
		customerActivityByDay: v.array(
			v.object({
				dayLabel: v.string(),
				dayStartAt: v.number(),
				newCustomers: v.number(),
				returningCustomers: v.number()
			})
		)
	}),
	handler: async (ctx, args) => {
		await requireWorkspaceMember(ctx, args.workspaceId);

		if (args.rangeEndAt - args.rangeStartAt > MAX_ANALYTICS_RANGE_MS) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Analytics range cannot exceed 90 days.'
			});
		}

		const [
			submissions,
			bookings,
			customers,
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
				.query('bookings')
				.withIndex('by_workspaceId_and_startAt', (q) =>
					q
						.eq('workspaceId', args.workspaceId)
						.gte('startAt', args.rangeStartAt)
						.lt('startAt', args.rangeEndAt)
				)
				.take(5000),
			ctx.db
				.query('customers')
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
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
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'queued')
				)
				.take(1000),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'failed')
				)
				.take(1000),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'blocked')
				)
				.take(1000)
		]);

		// Submissions by day
		const submissionCounts = new Map<number, number>();
		for (const s of submissions) {
			const day = floorToDay(s.submittedAt);
			submissionCounts.set(day, (submissionCounts.get(day) ?? 0) + 1);
		}
		const submissionsByDay = buildDayBuckets(
			args.rangeStartAt,
			args.rangeEndAt - 1,
			submissionCounts,
			analyticsDateLabel
		);

		// Bookings by day
		const bookingCounts = new Map<number, number>();
		for (const b of bookings) {
			if (!b.startAt) continue;
			const day = floorToDay(b.startAt);
			bookingCounts.set(day, (bookingCounts.get(day) ?? 0) + 1);
		}
		const bookingsByDay = buildDayBuckets(
			args.rangeStartAt,
			args.rangeEndAt - 1,
			bookingCounts,
			analyticsDateLabel
		);

		const customersById = new Map(customers.map((customer) => [customer._id, customer]));
		const newCustomerIdsByDay = new Map<number, Set<string>>();
		const returningCustomerIdsByDay = new Map<number, Set<string>>();
		for (const submission of submissions) {
			if (submission.submittedAt < args.rangeStartAt || submission.submittedAt >= args.rangeEndAt) {
				continue;
			}
			if (!submission.customerId) continue;

			const customer = customersById.get(submission.customerId);
			if (!customer) continue;

			const day = floorToDay(submission.submittedAt);
			const firstSeenDay = floorToDay(customer.firstSeenAt);
			const bucket =
				firstSeenDay === day
					? newCustomerIdsByDay
					: firstSeenDay < day
						? returningCustomerIdsByDay
						: null;
			if (!bucket) continue;

			const customerIds = bucket.get(day) ?? new Set<string>();
			customerIds.add(submission.customerId);
			bucket.set(day, customerIds);
		}
		const customerActivityRaw = buildDayBuckets(
			args.rangeStartAt,
			args.rangeEndAt - 1,
			new Map<number, number>(),
			analyticsDateLabel
		);
		const customerActivityByDay = customerActivityRaw.map((bucket) => ({
			dayLabel: bucket.dayLabel,
			dayStartAt: bucket.dayStartAt,
			newCustomers: newCustomerIdsByDay.get(bucket.dayStartAt)?.size ?? 0,
			returningCustomers: returningCustomerIdsByDay.get(bucket.dayStartAt)?.size ?? 0
		}));

		return {
			submissionsByDay,
			bookingsByDay,
			emailTotals: {
				sent: sentFollowUps.length,
				queued: queuedFollowUps.length,
				failed: failedFollowUps.length,
				blocked: blockedFollowUps.length
			},
			customerActivityByDay
		};
	}
});
