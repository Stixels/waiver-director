// Pure helpers for multiple waivers per workspace and activity-specific
// waiver requirements. Kept free of Convex runtime imports so they can be unit
// tested with `node --test`.

export const MAX_WAIVERS_PER_WORKSPACE = 25;
export const MAX_WAIVERS_PER_REQUIREMENT = 5;
export const MAX_ACTIVITY_NAME_LENGTH = 200;

export type WaiverStatus = 'active' | 'archived';

export type WaiverLike<Id extends string = string> = {
	_id: Id;
	_creationTime: number;
	isDefault?: boolean;
	status?: WaiverStatus;
};

export function isWaiverActive(waiver: { status?: WaiverStatus }): boolean {
	return (waiver.status ?? 'active') === 'active';
}

/**
 * Picks the workspace's default waiver. An explicit `isDefault` flag wins;
 * workspaces created before multiple waivers existed have exactly one waiver
 * and no flag, so the oldest active waiver is the fallback.
 */
export function pickDefaultWaiver<T extends WaiverLike>(waivers: T[]): T | null {
	const active = waivers.filter(isWaiverActive);
	if (active.length === 0) return null;

	const flagged = active.find((waiver) => waiver.isDefault === true);
	if (flagged) return flagged;

	return active.reduce((oldest, waiver) =>
		waiver._creationTime < oldest._creationTime ? waiver : oldest
	);
}

/**
 * Normalizes a booking activity name into a stable key. Bookings do not carry a
 * provider activity identity yet, so requirements match on the normalized name.
 */
export function normalizeActivityKey(activityName: string): string {
	return activityName.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolves which waivers a booking needs. An activity-specific requirement
 * replaces the default waiver requirement; archived or unknown waivers in the
 * requirement are skipped, and if nothing usable remains the default applies.
 * The first entry is the primary waiver used for waiver-gap counting.
 */
export function resolveRequiredWaiverIds<Id extends string>(args: {
	defaultWaiverId: Id | null;
	requirementWaiverIds: Id[] | null;
	activeWaiverIds: Set<Id>;
}): Id[] {
	if (args.requirementWaiverIds) {
		const seen = new Set<Id>();
		const usable: Id[] = [];
		for (const waiverId of args.requirementWaiverIds) {
			if (!args.activeWaiverIds.has(waiverId) || seen.has(waiverId)) continue;
			seen.add(waiverId);
			usable.push(waiverId);
		}
		if (usable.length > 0) return usable;
	}

	return args.defaultWaiverId ? [args.defaultWaiverId] : [];
}

export function waiverSlugBase(workspaceSlug: string, waiverTitle: string): string {
	const titlePart = waiverTitle
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
		.replace(/-+$/g, '');

	return `${workspaceSlug}-${titlePart || 'waiver'}`;
}

export function waiverSlugCandidate(base: string, attempt: number): string {
	return attempt <= 1 ? base : `${base}-${attempt}`;
}
