import { ConvexError, v } from 'convex/values';
import { internalMutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { bookingSearchText } from './lib/bookings';

// Dev-only helpers for trying the kiosk and check-in pages without a real booking provider.
// Internal functions, so they can only be run by someone with deploy access:
//   npx convex run devSeed:seedTestBookings '{"workspaceSlug":"my-workspace"}'
//   npx convex run devSeed:clearTestBookings '{"workspaceSlug":"my-workspace"}'

const TEST_BOOKING_PREFIX = 'TEST-';
const HOUR_MS = 60 * 60 * 1000;

type SampleBooking = {
	number: string;
	activityName: string;
	/** Hours from now, rounded to the half hour. */
	startsInHours: number;
	durationHours: number;
	leadCustomerName: string;
	leadCustomerEmail: string;
	participantCount: number;
	status?: 'active' | 'canceled';
};

const SAMPLE_BOOKINGS: SampleBooking[] = [
	{
		number: '1001',
		activityName: 'Sunset Kayak Tour',
		startsInHours: -1,
		durationHours: 2,
		leadCustomerName: 'Maria Lopez',
		leadCustomerEmail: 'maria.test@example.com',
		participantCount: 4
	},
	{
		number: '1002',
		activityName: 'Zipline Adventure',
		startsInHours: 1,
		durationHours: 1.5,
		leadCustomerName: 'James Carter',
		leadCustomerEmail: 'james.test@example.com',
		participantCount: 3
	},
	{
		number: '1003',
		activityName: 'Zipline Adventure',
		startsInHours: 3,
		durationHours: 1.5,
		leadCustomerName: 'Aisha Patel',
		leadCustomerEmail: 'aisha.test@example.com',
		participantCount: 2
	},
	{
		number: '1004',
		activityName: 'Family ATV Ride',
		startsInHours: 5,
		durationHours: 2,
		leadCustomerName: 'Tom Nguyen',
		leadCustomerEmail: 'tom.test@example.com',
		participantCount: 5
	},
	{
		number: '1005',
		activityName: 'Sunset Kayak Tour',
		startsInHours: 24,
		durationHours: 2,
		leadCustomerName: 'Sofia Rossi',
		leadCustomerEmail: 'sofia.test@example.com',
		participantCount: 2
	},
	{
		// Outside the kiosk search window (more than 36 hours out): should NOT be found.
		number: '1006',
		activityName: 'Family ATV Ride',
		startsInHours: 72,
		durationHours: 2,
		leadCustomerName: 'Liam Brown',
		leadCustomerEmail: 'liam.test@example.com',
		participantCount: 4
	},
	{
		// Canceled: should NOT be found on the kiosk.
		number: '1007',
		activityName: 'Zipline Adventure',
		startsInHours: 2,
		durationHours: 1.5,
		leadCustomerName: 'Emma Wilson',
		leadCustomerEmail: 'emma.test@example.com',
		participantCount: 2,
		status: 'canceled'
	}
];

async function requireWorkspaceBySlug(ctx: MutationCtx, slug: string): Promise<Doc<'workspaces'>> {
	const workspace = await ctx.db
		.query('workspaces')
		.withIndex('by_slug', (q) => q.eq('slug', slug))
		.unique();
	if (!workspace) {
		throw new ConvexError({ code: 'not_found', message: `No workspace with slug "${slug}".` });
	}
	return workspace;
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Formats a timestamp as a local wall-clock time with offset, like Bookeo: 2026-11-10T14:00:00-05:00 */
function localDateTime(timestamp: number, utcOffsetHours: number): string {
	const local = new Date(timestamp + utcOffsetHours * HOUR_MS);
	const sign = utcOffsetHours < 0 ? '-' : '+';
	const absMinutes = Math.round(Math.abs(utcOffsetHours) * 60);
	const offset = `${sign}${String(Math.floor(absMinutes / 60)).padStart(2, '0')}:${String(absMinutes % 60).padStart(2, '0')}`;
	return `${local.toISOString().slice(0, 19)}${offset}`;
}

export const seedTestBookings = internalMutation({
	args: {
		workspaceSlug: v.string(),
		/** Your timezone's offset from UTC in hours, e.g. -5 for US Eastern (standard time). */
		utcOffsetHours: v.optional(v.number())
	},
	returns: v.object({
		created: v.number(),
		updated: v.number(),
		bookingNumbers: v.array(v.string()),
		emails: v.array(v.string())
	}),
	handler: async (ctx, args) => {
		const workspace = await requireWorkspaceBySlug(ctx, args.workspaceSlug);
		const utcOffsetHours = args.utcOffsetHours ?? -5;
		const now = Date.now();
		const halfHour = HOUR_MS / 2;
		const baseTime = Math.round(now / halfHour) * halfHour;

		// Bookings must belong to a booking integration. Reuse an existing one, otherwise add a
		// disconnected placeholder so nothing tries to sync with a real provider.
		const existingIntegration = await ctx.db
			.query('booking_integrations')
			.withIndex('by_workspaceId', (q) => q.eq('workspaceId', workspace._id))
			.first();
		const integration: Pick<
			Doc<'booking_integrations'>,
			'_id' | 'provider'
		> = existingIntegration ??
		(await (async () => {
			const integrationId: Id<'booking_integrations'> = await ctx.db.insert(
				'booking_integrations',
				{
					workspaceId: workspace._id,
					provider: 'bookeo',
					status: 'disconnected',
					permissions: [],
					disconnectedAt: now,
					updatedAt: now
				}
			);
			return { _id: integrationId, provider: 'bookeo' as const };
		})());

		let created = 0;
		let updated = 0;
		for (const sample of SAMPLE_BOOKINGS) {
			const providerBookingId = `${TEST_BOOKING_PREFIX}${sample.number}`;
			const startAt = baseTime + sample.startsInHours * HOUR_MS;
			const endAt = startAt + sample.durationHours * HOUR_MS;
			const startTime = localDateTime(startAt, utcOffsetHours);
			const fields = {
				workspaceId: workspace._id,
				integrationId: integration._id,
				provider: integration.provider,
				providerBookingId,
				searchText: bookingSearchText({
					providerBookingId,
					activityName: sample.activityName,
					leadCustomerName: sample.leadCustomerName,
					leadCustomerEmail: sample.leadCustomerEmail
				}),
				status: sample.status ?? ('active' as const),
				activityName: sample.activityName,
				startTime,
				endTime: localDateTime(endAt, utcOffsetHours),
				startAt,
				endAt,
				serviceDate: startTime.slice(0, 10),
				leadCustomerName: sample.leadCustomerName,
				leadCustomerEmail: sample.leadCustomerEmail,
				participantCount: sample.participantCount,
				updatedAt: now
			};

			const existing = await ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_provider_and_providerBookingId', (q) =>
					q
						.eq('workspaceId', workspace._id)
						.eq('provider', integration.provider)
						.eq('providerBookingId', providerBookingId)
				)
				.unique();
			if (existing) {
				// Re-running moves the sample bookings relative to "now" again.
				await ctx.db.patch(existing._id, fields);
				updated += 1;
			} else {
				await ctx.db.insert('bookings', { ...fields, lookupToken: randomToken(), signedCount: 0 });
				created += 1;
			}
		}

		return {
			created,
			updated,
			bookingNumbers: SAMPLE_BOOKINGS.map((sample) => `${TEST_BOOKING_PREFIX}${sample.number}`),
			emails: SAMPLE_BOOKINGS.map((sample) => sample.leadCustomerEmail)
		};
	}
});

// Deletes only the sample bookings. Signatures made against them are kept (signed records are
// never changed); they just stop showing under a booking on the Check-in page.
export const clearTestBookings = internalMutation({
	args: { workspaceSlug: v.string() },
	returns: v.object({ deleted: v.number() }),
	handler: async (ctx, args) => {
		const workspace = await requireWorkspaceBySlug(ctx, args.workspaceSlug);
		let deleted = 0;
		for (const sample of SAMPLE_BOOKINGS) {
			const matches = await ctx.db
				.query('bookings')
				.withIndex('by_workspaceId_and_providerBookingId', (q) =>
					q
						.eq('workspaceId', workspace._id)
						.eq('providerBookingId', `${TEST_BOOKING_PREFIX}${sample.number}`)
				)
				.take(10);
			for (const booking of matches) {
				await ctx.db.delete(booking._id);
				deleted += 1;
			}
		}
		return { deleted };
	}
});
