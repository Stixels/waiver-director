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

/** Youngest age, in whole years, someone can be to sign a waiver themselves. */
export const DEFAULT_MINIMUM_SIGNER_AGE = 18;
export const MIN_MINIMUM_SIGNER_AGE = 18;
export const MAX_MINIMUM_SIGNER_AGE = 99;

export function isValidMinimumSignerAge(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= MIN_MINIMUM_SIGNER_AGE &&
		value <= MAX_MINIMUM_SIGNER_AGE
	);
}

/** Age in whole years on `today` for someone born on `dateOfBirth` (both YYYY-MM-DD). */
export function ageOnDate(dateOfBirth: string, today: string): number {
	const [birthYear] = dateOfBirth.split('-').map(Number);
	const [todayYear] = today.split('-').map(Number);
	// Someone born on Feb 29 turns a year older on Mar 1 in non-leap years.
	const hadBirthdayThisYear = today.slice(5) >= dateOfBirth.slice(5);
	return todayYear - birthYear - (hadBirthdayThisYear ? 0 : 1);
}

/**
 * Inclusive ISO date bounds for a signer's date of birth on a given signing day
 * (`today` is a YYYY-MM-DD string in the signer's calendar). The latest date is
 * the last birthday that makes them at least `minimumAge` today.
 */
export function signerBirthDateBounds(
	today: string,
	minimumAge: number
): { min: string; max: string } {
	const [year, month, day] = today.split('-').map(Number);
	let max = isoDate(year - minimumAge, month - 1, day);
	if (ageOnDate(max, today) < minimumAge) {
		// Today is Feb 29 and the cutoff year is not a leap year.
		max = isoDate(year - minimumAge, month - 1, day - 1);
	}
	return { min: MIN_MINOR_BIRTH_DATE, max };
}

/** True when `dateOfBirth` makes the person at least `minimumAge` on `today`. */
export function isSignerBirthDate(dateOfBirth: string, today: string, minimumAge: number): boolean {
	if (!isValidIsoDate(dateOfBirth)) return false;
	const { min, max } = signerBirthDateBounds(today, minimumAge);
	return dateOfBirth >= min && dateOfBirth <= max;
}

/** Whether a stored waiver or version asks for each minor's date of birth. Off for older records. */
export function collectsMinorDateOfBirth(record: { collectMinorDateOfBirth?: boolean }): boolean {
	return record.collectMinorDateOfBirth ?? false;
}
