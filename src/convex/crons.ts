import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
	'prune old booking connection sessions',
	{ hours: 24 },
	internal.integrations.pruneOldBookingConnectionSessionsCron,
	{}
);

crons.interval(
	'prune old Bookeo webhook events',
	{ hours: 24 },
	internal.integrations.pruneOldBookeoWebhookEventsCron,
	{}
);

// FareHarbor webhooks are set up by the operator and can be missing or lost, so a
// periodic near-term sync keeps bookings current either way.
crons.interval(
	'sync FareHarbor bookings',
	{ hours: 6 },
	internal.fareharbor.scheduleFareHarborSyncsCron,
	{}
);

crons.interval(
	'prune old marketing connection sessions',
	{ hours: 24 },
	internal.marketingIntegrations.pruneOldConnectionSessionsCron,
	{}
);

crons.interval(
	'prune old marketing contact syncs',
	{ hours: 24 },
	internal.marketingIntegrations.pruneOldContactSyncsCron,
	{}
);

export default crons;
