import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
	'mark expired booking connection sessions',
	{ hours: 6 },
	internal.integrations.markExpiredBookingConnectionSessionsCron,
	{}
);

crons.interval(
	'prune old booking connection sessions',
	{ hours: 24 },
	internal.integrations.pruneOldBookingConnectionSessionsCron,
	{}
);

export default crons;
