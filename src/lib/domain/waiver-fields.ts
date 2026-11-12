// Pure waiver field model shared by the Svelte app and Convex functions.
// Keep this module free of `$lib` aliases and runtime imports so Convex and
// the node test runner can load it directly.

export const MAX_TEXT_ANSWER_LENGTH = 5000;
const MAX_SHORT_ANSWER_LENGTH = 200;
export const MIN_CLAUSE_LENGTH = 2;
export const MAX_CLAUSE_LENGTH = 2000;
export const MAX_INITIALS_LENGTH = 6;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

export type WaiverFieldOption = {
	id: string;
	label: string;
	/** Choosing this option flags the submission for staff review. */
	flagged?: boolean;
};

type BaseField = {
	id: string;
	label: string;
	required: boolean;
};

export type WaiverField =
	| (BaseField & { type: 'text'; placeholder?: string })
	| (BaseField & { type: 'checkbox'; flagWhenChecked?: boolean })
	| (BaseField & { type: 'select'; options: WaiverFieldOption[] })
	| (BaseField & { type: 'multiselect'; options: WaiverFieldOption[] })
	| (BaseField & { type: 'date' })
	| (BaseField & { type: 'phone'; placeholder?: string })
	| (BaseField & { type: 'number'; min?: number; max?: number })
	| (BaseField & { type: 'address' })
	| (BaseField & { type: 'emergency_contact' })
	| (BaseField & { type: 'initials'; clause: string });

export type WaiverFieldType = WaiverField['type'];

export type WaiverAnswerValue = string | boolean | null | string[] | Record<string, string>;
export type WaiverAnswers = Record<string, WaiverAnswerValue>;

const addressParts = [
	{ key: 'line1', label: 'Street address', required: true, autocomplete: 'address-line1' },
	{ key: 'line2', label: 'Apt, suite, unit', required: false, autocomplete: 'address-line2' },
	{ key: 'city', label: 'City', required: true, autocomplete: 'address-level2' },
	{ key: 'region', label: 'State / province', required: false, autocomplete: 'address-level1' },
	{ key: 'postalCode', label: 'Postal code', required: false, autocomplete: 'postal-code' },
	{ key: 'country', label: 'Country', required: false, autocomplete: 'country-name' }
] as const;

const emergencyContactParts = [
	{ key: 'name', label: 'Contact name', required: true, autocomplete: 'off' },
	{ key: 'phone', label: 'Contact phone', required: true, autocomplete: 'off' },
	{ key: 'relationship', label: 'Relationship', required: false, autocomplete: 'off' }
] as const;

type CompositePart = { key: string; label: string; required: boolean };

export function compositeParts(
	type: 'address' | 'emergency_contact'
): ReadonlyArray<CompositePart & { autocomplete: string }> {
	return type === 'address' ? addressParts : emergencyContactParts;
}

function countPhoneDigits(value: string): number {
	return value.replace(/\D/g, '').length;
}

export function isValidPhone(value: string): boolean {
	const trimmed = value.trim();
	if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return false;
	const digits = countPhoneDigits(trimmed);
	return digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;
}

/** True for a real calendar date in YYYY-MM-DD form (rejects e.g. 2024-02-31). */
function isValidIsoDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const [year, month, day] = match.slice(1).map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

function parseNumberAnswer(value: string): number | null {
	const trimmed = value.trim();
	// Matches what <input type="number"> accepts: optional sign, leading or
	// trailing decimal point, and exponent (e.g. "-2", ".5", "3.", "1e3").
	if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) return null;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

export function isOptionField(
	field: WaiverField
): field is Extract<WaiverField, { type: 'select' | 'multiselect' }> {
	return field.type === 'select' || field.type === 'multiselect';
}

/** True when a stored answer should flag the submission for staff review. */
export function isAnswerFlagged(field: WaiverField, value: WaiverAnswerValue | undefined): boolean {
	if (field.type === 'checkbox') {
		return field.flagWhenChecked === true && value === true;
	}
	if (field.type === 'select' && typeof value === 'string') {
		return field.options.some((option) => option.id === value && option.flagged === true);
	}
	if (field.type === 'multiselect' && Array.isArray(value)) {
		return field.options.some((option) => option.flagged === true && value.includes(option.id));
	}
	return false;
}

type NormalizedAnswersResult =
	| { ok: true; answers: WaiverAnswers; flaggedFieldIds: string[] }
	| { ok: false; fieldId: string; message: string };

function fail(field: WaiverField, message: string): NormalizedAnswersResult {
	return { ok: false, fieldId: field.id, message };
}

function stringAnswer(value: WaiverAnswerValue | undefined): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validates raw answers against the signed version's fields and returns only
 * the answers the waiver asked for, trimmed and in canonical shape. Unknown
 * keys are dropped so a signed record never stores data the signer was not
 * shown.
 */
export function normalizeSubmissionAnswers(
	fields: WaiverField[],
	raw: Record<string, WaiverAnswerValue | undefined>
): NormalizedAnswersResult {
	const answers: WaiverAnswers = {};
	const flaggedFieldIds: string[] = [];

	for (const field of fields) {
		const value = Object.prototype.hasOwnProperty.call(raw, field.id) ? raw[field.id] : undefined;
		let normalized: WaiverAnswerValue;

		switch (field.type) {
			case 'checkbox': {
				if (value !== undefined && value !== null && typeof value !== 'boolean') {
					return fail(field, `Please answer "${field.label}".`);
				}
				if (field.required && value !== true) {
					return fail(field, `Please accept "${field.label}".`);
				}
				normalized = value === true;
				break;
			}
			case 'multiselect': {
				if (value !== undefined && value !== null && !Array.isArray(value)) {
					return fail(field, `Please choose valid options for "${field.label}".`);
				}
				const selected = Array.isArray(value) ? value.map((entry) => String(entry).trim()) : [];
				const unique = field.options
					.map((option) => option.id)
					.filter((optionId) => selected.includes(optionId));
				if (unique.length !== new Set(selected.filter(Boolean)).size) {
					return fail(field, `Please choose valid options for "${field.label}".`);
				}
				if (field.required && unique.length === 0) {
					return fail(field, `Please choose at least one option for "${field.label}".`);
				}
				normalized = unique;
				break;
			}
			case 'address':
			case 'emergency_contact': {
				if (
					value !== undefined &&
					value !== null &&
					(typeof value !== 'object' || Array.isArray(value))
				) {
					return fail(field, `Please complete "${field.label}".`);
				}
				const parts = compositeParts(field.type);
				const record = (value ?? {}) as Record<string, unknown>;
				const result: Record<string, string> = {};
				let anyFilled = false;
				for (const part of parts) {
					const partValue = typeof record[part.key] === 'string' ? record[part.key] : '';
					const trimmed = (partValue as string).trim();
					if (trimmed.length > MAX_SHORT_ANSWER_LENGTH) {
						return fail(field, `"${part.label}" in "${field.label}" is too long.`);
					}
					if (trimmed) {
						result[part.key] = trimmed;
						anyFilled = true;
					}
				}
				if (field.required || anyFilled) {
					const missing = parts.find((part) => part.required && !result[part.key]);
					if (missing) {
						return fail(field, `Please add "${missing.label}" for "${field.label}".`);
					}
				}
				if (field.type === 'emergency_contact' && result.phone && !isValidPhone(result.phone)) {
					return fail(field, `Enter a valid phone number for "${field.label}".`);
				}
				normalized = anyFilled ? result : null;
				break;
			}
			default: {
				if (value !== undefined && value !== null && typeof value !== 'string') {
					return fail(field, `Please complete "${field.label}".`);
				}
				const text = stringAnswer(value);
				if (field.required && text.length === 0) {
					return fail(field, `Please complete "${field.label}".`);
				}
				if (text.length === 0) {
					normalized = null;
					break;
				}
				if (text.length > MAX_TEXT_ANSWER_LENGTH) {
					return fail(field, `"${field.label}" is too long.`);
				}

				if (field.type === 'select') {
					if (!field.options.some((option) => option.id === text)) {
						return fail(field, `Please choose a valid option for "${field.label}".`);
					}
				} else if (field.type === 'date') {
					if (!isValidIsoDate(text)) {
						return fail(field, `Enter a valid date for "${field.label}".`);
					}
				} else if (field.type === 'phone') {
					if (!isValidPhone(text)) {
						return fail(field, `Enter a valid phone number for "${field.label}".`);
					}
				} else if (field.type === 'number') {
					const parsed = parseNumberAnswer(text);
					if (parsed === null) {
						return fail(field, `Enter a number for "${field.label}".`);
					}
					if (field.min !== undefined && parsed < field.min) {
						return fail(field, `"${field.label}" must be at least ${field.min}.`);
					}
					if (field.max !== undefined && parsed > field.max) {
						return fail(field, `"${field.label}" must be at most ${field.max}.`);
					}
					// Keep what the signer typed so the signed record matches it exactly;
					// String(parsed) would round long numbers like IDs.
					normalized = text;
					break;
				} else if (field.type === 'initials') {
					if (text.length > MAX_INITIALS_LENGTH || !/^[\p{L}][\p{L}.\s'-]*$/u.test(text)) {
						return fail(field, `Enter your initials for "${field.label}".`);
					}
					normalized = text.toUpperCase();
					break;
				}
				normalized = text;
			}
		}

		answers[field.id] = normalized;
		if (isAnswerFlagged(field, normalized)) {
			flaggedFieldIds.push(field.id);
		}
	}

	return { ok: true, answers, flaggedFieldIds };
}

/** Human-readable answer text for read-only views. */
export function formatAnswerDisplay(
	field: WaiverField,
	value: WaiverAnswerValue | undefined
): string {
	if (value === null || value === undefined || value === '') return '—';
	if (field.type === 'checkbox') return value === true ? 'Yes' : 'No';
	if (field.type === 'select' && typeof value === 'string') {
		return field.options.find((option) => option.id === value)?.label ?? value;
	}
	if (field.type === 'multiselect' && Array.isArray(value)) {
		if (value.length === 0) return '—';
		return value
			.map((optionId) => field.options.find((option) => option.id === optionId)?.label ?? optionId)
			.join(', ');
	}
	if ((field.type === 'address' || field.type === 'emergency_contact') && isRecord(value)) {
		if (field.type === 'address') {
			const cityLine = [value.city, value.region, value.postalCode].filter(Boolean).join(', ');
			const lines = [value.line1, value.line2, cityLine, value.country].filter(Boolean);
			return lines.length > 0 ? lines.join('\n') : '—';
		}
		const lines = [
			[value.name, value.relationship ? `(${value.relationship})` : ''].filter(Boolean).join(' '),
			value.phone
		].filter(Boolean);
		return lines.length > 0 ? lines.join('\n') : '—';
	}
	if (typeof value === 'string') return value;
	return '—';
}

/** Trimmed, canonical field shape used to compare drafts with published versions. */
export function normalizeFieldForCompare<T extends WaiverField>(field: T): T {
	const label = field.label.trim();
	switch (field.type) {
		case 'select':
		case 'multiselect':
			return {
				...field,
				label,
				options: field.options.map((option) => ({
					id: option.id.trim(),
					label: option.label.trim(),
					...(option.flagged ? { flagged: true } : {})
				}))
			};
		case 'checkbox':
			return {
				id: field.id,
				type: field.type,
				label,
				required: field.required,
				...(field.flagWhenChecked ? { flagWhenChecked: true } : {})
			} as T;
		case 'text':
		case 'phone':
			return { ...field, label, placeholder: field.placeholder?.trim() || undefined };
		case 'initials':
			return { ...field, label, clause: field.clause.trim() };
		default:
			return { ...field, label };
	}
}

function isRecord(value: WaiverAnswerValue): value is Record<string, string> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
