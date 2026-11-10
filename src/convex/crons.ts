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

crons.interval(
	'prune old webhook deliveries',
	{ hours: 24 },
	internal.webhooks.pruneOldWebhookDeliveriesCron,
	{}
);

export default crons;
