import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import { requireWorkspaceMember } from './lib/waivers';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_RANGE_MS = 90 * DAY_MS;

const trendDayValue = v.object({
	dayLabel: v.string(),
	dayStartAt: v.number(),
	count: v.number()
});

function floorToDay(epochMs: number): number {
	const d = new Date(epochMs);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
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
			// Capped at 1000; values at the cap are displayed as "1000+"
			followUpsQueued: v.number(),
			totalCustomers: v.number()
		}),
		kpiTrends: v.object({
			bookingsToday: v.array(trendDayValue),
			submissionsToday: v.array(trendDayValue),
			followUpsQueued: v.array(trendDayValue),
			totalCustomers: v.array(trendDayValue)
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
			workspace,
			trendBookings,
			recentSubmissions,
			queuedFollowUps,
			trendSubmissions,
			customers
		] = await Promise.all([
			ctx.db.get(args.workspaceId),
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
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
				.order('desc')
				.take(500),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'queued')
				)
				.order('desc')
				.take(1000),
			ctx.db
				.query('waiver_submissions')
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
				.order('desc')
				.take(2000),
			ctx.db
				.query('customers')
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
				.take(5000)
		]);

		const bookingsToday = trendBookings.filter(
			(b) => (b.startAt ?? 0) >= args.todayStartAt && (b.startAt ?? 0) < args.todayEndAt
		);
		const submissionsToday = recentSubmissions.filter(
			(s) => s._creationTime >= args.todayStartAt && s._creationTime < args.todayEndAt
		).length;

		const bookingTrendCounts = new Map<number, number>();
		for (const booking of trendBookings) {
			if (typeof booking.startAt !== 'number') continue;
			const day = floorToDay(booking.startAt);
			bookingTrendCounts.set(day, (bookingTrendCounts.get(day) ?? 0) + 1);
		}
		const bookingsTodayTrend = buildDayBuckets(
			args.trendStartAt,
			args.todayStartAt,
			bookingTrendCounts,
			dayLabel
		);

		const trendCounts = new Map<number, number>();
		for (const s of trendSubmissions) {
			if (s._creationTime < args.trendStartAt) break;
			const day = floorToDay(s._creationTime);
			trendCounts.set(day, (trendCounts.get(day) ?? 0) + 1);
		}
		const submissionsTodayTrend = buildDayBuckets(
			args.trendStartAt,
			args.todayStartAt,
			trendCounts,
			dayLabel
		);

		const followUpTrendCounts = new Map<number, number>();
		for (const followUp of queuedFollowUps) {
			if (followUp.submittedAt < args.trendStartAt || followUp.submittedAt >= args.todayEndAt) {
				continue;
			}
			const day = floorToDay(followUp.submittedAt);
			followUpTrendCounts.set(day, (followUpTrendCounts.get(day) ?? 0) + 1);
		}
		const followUpsQueuedTrend = buildDayBuckets(
			args.trendStartAt,
			args.todayStartAt,
			followUpTrendCounts,
			dayLabel
		);

		const customerTrendCounts = new Map<number, number>();
		for (const customer of customers) {
			if (customer.firstSeenAt < args.trendStartAt || customer.firstSeenAt >= args.todayEndAt) {
				continue;
			}
			const day = floorToDay(customer.firstSeenAt);
			customerTrendCounts.set(day, (customerTrendCounts.get(day) ?? 0) + 1);
		}
		const totalCustomersTrend = buildDayBuckets(
			args.trendStartAt,
			args.todayStartAt,
			customerTrendCounts,
			dayLabel
		);

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
				followUpsQueued: queuedFollowUps.length,
				totalCustomers: workspace?.customerCount ?? 0
			},
			kpiTrends: {
				bookingsToday: bookingsTodayTrend,
				submissionsToday: submissionsTodayTrend,
				followUpsQueued: followUpsQueuedTrend,
				totalCustomers: totalCustomersTrend
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

		const [submissions, bookings, customers, sentFollowUps, queuedFollowUps, failedFollowUps, blockedFollowUps] = await Promise.all([
			ctx.db
				.query('waiver_submissions')
				.withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
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
				.take(1001),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'failed')
				)
				.take(1001),
			ctx.db
				.query('email_follow_ups')
				.withIndex('by_workspaceId_and_status', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('status', 'blocked')
				)
				.take(1001)
		]);

		// Submissions by day
		const submissionCounts = new Map<number, number>();
		for (const s of submissions) {
			if (s._creationTime < args.rangeStartAt || s._creationTime >= args.rangeEndAt) continue;
			const day = floorToDay(s._creationTime);
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
