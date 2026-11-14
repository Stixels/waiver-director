// Pure FareHarbor helpers. Kept free of Convex and relative imports so they can be unit
// tested directly with `node --test`.
//
// Field names follow the FareHarbor External API v1 booking object:
// pk, uuid, display_id ("#344488"), status ("booked" | "cancelled" | "rebooked"),
// customer_count, customers[], contact { name, email }, and
// availability { pk, start_at, end_at, item { pk, name } }.

export const FAREHARBOR_UNKNOWN_ACTIVITY_NAME = 'Unknown activity';
export const FAREHARBOR_SHORTNAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export type FareHarborNormalizedBooking = {
	providerBookingId: string;
	status: 'active' | 'canceled';
	activityName: string;
	startTime?: string;
	endTime?: string;
	startAt?: number;
	endAt?: number;
	serviceDate?: string;
	leadCustomerName?: string;
	leadCustomerEmail?: string;
	participantCount: number;
};

/** Context from the availability a booking was listed under, used when the booking omits it. */
export type FareHarborAvailabilityContext = {
	startAt?: string;
	endAt?: string;
	itemName?: string;
};

function toRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function trimmedString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeEmail(value: string | undefined): string | undefined {
	const email = value?.trim().toLowerCase();
	return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export function normalizeFareHarborShortname(value: string): string | null {
	const shortname = value.trim().toLowerCase();
	return FAREHARBOR_SHORTNAME_PATTERN.test(shortname) ? shortname : null;
}

/**
 * FareHarbor timestamps use a compact UTC offset ("2022-08-18T12:00:00+1000"), which
 * `Date.parse` does not accept everywhere. Rewrite it to the ISO 8601 extended form.
 */
export function normalizeFareHarborDateTime(value: unknown): string | undefined {
	const text = trimmedString(value);
	if (!text) return undefined;
	return text.replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3');
}

function parseDateTime(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : undefined;
}

function serviceDate(value: string | undefined): string | undefined {
	return value?.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/)?.[1];
}

/**
 * The customer-facing booking number. FareHarbor shows `display_id` ("#344488"), which is
 * the booking `pk`; store it without the `#` so guests can type what they see.
 */
export function fareHarborBookingId(booking: Record<string, unknown>): string | undefined {
	const pk = booking.pk;
	if (typeof pk === 'number' && Number.isSafeInteger(pk) && pk > 0) return String(pk);
	const pkText = trimmedString(pk);
	if (pkText && /^\d+$/.test(pkText)) return pkText;
	const displayId = trimmedString(booking.display_id)?.replace(/^#/, '');
	return displayId && /^[A-Za-z0-9-]+$/.test(displayId) ? displayId : undefined;
}

function fareHarborParticipantCount(booking: Record<string, unknown>): number {
	const count = booking.customer_count;
	if (typeof count === 'number' && Number.isInteger(count) && count > 0) return count;
	if (Array.isArray(booking.customers) && booking.customers.length > 0) {
		return booking.customers.length;
	}
	return 1;
}

export function normalizeFareHarborBooking(
	value: unknown,
	context: FareHarborAvailabilityContext = {}
): FareHarborNormalizedBooking | null {
	const booking = toRecord(value);
	const providerBookingId = fareHarborBookingId(booking);
	if (!providerBookingId) return null;

	const availability = toRecord(booking.availability);
	const item = toRecord(availability.item);
	const contact = toRecord(booking.contact);
	const startTime = normalizeFareHarborDateTime(availability.start_at ?? context.startAt);
	const endTime = normalizeFareHarborDateTime(availability.end_at ?? context.endAt);
	const startAt = parseDateTime(startTime);
	const endAt = parseDateTime(endTime);
	const date = serviceDate(startTime);
	const leadCustomerName = trimmedString(contact.name);
	const leadCustomerEmail = normalizeEmail(trimmedString(contact.email));
	const status = trimmedString(booking.status)?.toLowerCase();

	return {
		providerBookingId,
		// A rebooked booking is replaced by a new booking with its own pk.
		status: status === 'cancelled' || status === 'rebooked' ? 'canceled' : 'active',
		activityName:
			trimmedString(item.name) ??
			trimmedString(context.itemName) ??
			FAREHARBOR_UNKNOWN_ACTIVITY_NAME,
		...(startTime ? { startTime } : {}),
		...(endTime ? { endTime } : {}),
		...(startAt !== undefined ? { startAt } : {}),
		...(endAt !== undefined ? { endAt } : {}),
		...(date ? { serviceDate: date } : {}),
		...(leadCustomerName ? { leadCustomerName } : {}),
		...(leadCustomerEmail ? { leadCustomerEmail } : {}),
		participantCount: fareHarborParticipantCount(booking)
	};
}

/** Webhook bodies wrap the booking as `{ "booking": { ... } }`; accept a bare booking too. */
export function fareHarborWebhookBooking(body: unknown): Record<string, unknown> {
	const record = toRecord(body);
	return 'booking' in record ? toRecord(record.booking) : record;
}

export function fareHarborWebhookEventType(booking: Record<string, unknown>): string {
	const status = trimmedString(booking.status)?.toLowerCase();
	if (status === 'cancelled' || status === 'rebooked') return status;
	return status === 'booked' ? 'booked' : 'updated';
}

/** Split [start, end] into inclusive YYYY-MM-DD ranges of at most `maxDays` days. */
export function fareHarborDateRanges(
	start: Date,
	end: Date,
	maxDays = 31
): Array<{ start: string; end: string }> {
	const dayMs = 24 * 60 * 60 * 1000;
	const ranges: Array<{ start: string; end: string }> = [];
	const first = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
	const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
	for (let cursor = first; cursor <= last; cursor += maxDays * dayMs) {
		const rangeEnd = Math.min(cursor + (maxDays - 1) * dayMs, last);
		ranges.push({
			start: new Date(cursor).toISOString().slice(0, 10),
			end: new Date(rangeEnd).toISOString().slice(0, 10)
		});
	}
	return ranges;
}

export type FareHarborSyncSlot = {
	availabilityPk: string;
	itemName?: string;
	startAt?: string;
	endAt?: string;
	/** Sort key: epoch ms of start_at, or Infinity when it can't be parsed. */
	sortAt: number;
};

/**
 * Orders availabilities for a sync run: by start time across every item, beginning at the
 * resume cursor (the first slot the previous run did not reach) and wrapping around to the
 * start of the window. Consecutive truncated runs therefore cover the whole window instead
 * of repeating the same first slots.
 */
export function orderFareHarborSyncSlots(
	slots: FareHarborSyncSlot[],
	resumeAfter?: string
): FareHarborSyncSlot[] {
	const sorted = [...slots].sort(
		(a, b) => a.sortAt - b.sortAt || a.availabilityPk.localeCompare(b.availabilityPk)
	);
	const cursorAt = parseDateTime(normalizeFareHarborDateTime(resumeAfter));
	if (cursorAt === undefined) return sorted;
	const index = sorted.findIndex((slot) => slot.sortAt >= cursorAt);
	if (index <= 0) return sorted;
	return [...sorted.slice(index), ...sorted.slice(0, index)];
}

export function fareHarborSyncSlot(
	availability: Record<string, unknown>,
	itemName: string | undefined
): FareHarborSyncSlot | null {
	const pk = availability.pk;
	const availabilityPk =
		typeof pk === 'number' && Number.isSafeInteger(pk) && pk > 0
			? String(pk)
			: typeof pk === 'string' && /^\d+$/.test(pk.trim())
				? pk.trim()
				: null;
	if (!availabilityPk) return null;
	const startAt = trimmedString(availability.start_at);
	const endAt = trimmedString(availability.end_at);
	return {
		availabilityPk,
		...(itemName ? { itemName } : {}),
		...(startAt ? { startAt } : {}),
		...(endAt ? { endAt } : {}),
		sortAt: parseDateTime(normalizeFareHarborDateTime(startAt)) ?? Number.POSITIVE_INFINITY
	};
}
