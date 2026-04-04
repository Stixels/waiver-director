export type CapturedGuest = {
	name: string;
	email: string;
};

export type SessionParticipant = CapturedGuest & {
	id: string;
	status: 'signed' | 'pending';
};

export type ChartBar = {
	day: string;
	pct: number;
};

export const capturedGuests: CapturedGuest[] = [
	{ name: 'Alex Martinez', email: 'alex@email.com' },
	{ name: 'Jamie Chen', email: 'jchen@email.com' },
	{ name: 'Sam Wilson', email: 'swilson@email.com' },
	{ name: 'Taylor Brown', email: 'taylor@email.com' },
	{ name: 'Morgan Davis', email: 'mdavis@email.com' },
	{ name: 'Riley Kim', email: 'rileyk@email.com' }
];

export const sessionParticipants: SessionParticipant[] = [
	...capturedGuests.map((guest) => ({ ...guest, id: guest.email, status: 'signed' as const })),
	{ id: 'pending-casey-patel', name: 'Casey Patel', email: '—', status: 'pending' },
	{ id: 'pending-jordan-lee', name: 'Jordan Lee', email: '—', status: 'pending' }
];

export const chartBars: ChartBar[] = [
	{ day: 'Mon', pct: 64 },
	{ day: 'Tue', pct: 81 },
	{ day: 'Wed', pct: 57 },
	{ day: 'Thu', pct: 94 },
	{ day: 'Fri', pct: 86 },
	{ day: 'Sat', pct: 77 },
	{ day: 'Sun', pct: 100 }
];
