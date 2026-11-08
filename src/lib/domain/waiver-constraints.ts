export const MAX_WAIVER_FIELDS = 25;
export const MIN_WAIVER_TITLE_LENGTH = 3;
export const MAX_WAIVER_TITLE_LENGTH = 120;
export const MIN_WAIVER_FIELD_LABEL_LENGTH = 2;
export const MAX_WAIVER_FIELD_LABEL_LENGTH = 120;
export const MIN_SELECT_OPTIONS = 1;
export const MAX_SELECT_OPTIONS = 20;
export const MIN_SELECT_OPTION_LABEL_LENGTH = 1;
export const MAX_SELECT_OPTION_LABEL_LENGTH = 80;
export const MAX_MINORS = 50;
export const MIN_MINOR_NAME_LENGTH = 2;
export const MAX_MINOR_NAME_LENGTH = 120;

/** Age at which a participant is no longer a minor. */
export const MINOR_AGE_LIMIT_YEARS = 18;
export const MIN_MINOR_BIRTH_DATE = '1900-01-01';

export function isValidIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00Z`);
	return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isoDate(year: number, monthIndex: number, day: number): string {
	return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

/**
 * Inclusive ISO date bounds for a minor's date of birth on a given signing day
 * (`today` is a YYYY-MM-DD string in the signer's calendar). The earliest date
 * is the day after the person would turn 18; the latest is today.
 */
export function minorBirthDateBounds(today: string): { min: string; max: string } {
	const [year, month, day] = today.split('-').map(Number);
	// Day after the 18th birthday cutoff: someone born exactly 18 years ago is an adult.
	const min = isoDate(year - MINOR_AGE_LIMIT_YEARS, month - 1, day + 1);
	return { min: min < MIN_MINOR_BIRTH_DATE ? MIN_MINOR_BIRTH_DATE : min, max: today };
}

/** True when `dateOfBirth` makes the person under 18 on `today` (both YYYY-MM-DD). */
export function isMinorBirthDate(dateOfBirth: string, today: string): boolean {
	if (!isValidIsoDate(dateOfBirth)) return false;
	const { min, max } = minorBirthDateBounds(today);
	return dateOfBirth >= min && dateOfBirth <= max;
}
