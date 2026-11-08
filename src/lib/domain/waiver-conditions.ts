/**
 * Conditional field logic shared by the builder, the public signing form, the
 * signed-record views, and the Convex submission validator.
 *
 * Keep this module free of `$lib` aliases and framework imports so the Convex
 * runtime can import it with a relative path.
 *
 * A field with `visibleWhen` is shown (and its `required` flag enforced) only
 * when the referenced earlier field's answer satisfies the condition. Hidden
 * fields are never required and their answers are dropped before storage.
 */

export type WaiverConditionOperator = 'equals' | 'not_equals';

export type WaiverFieldCondition = {
	fieldId: string;
	operator: WaiverConditionOperator;
	value: string | boolean;
};

type ConditionalFieldLike = {
	id: string;
	type: string;
	label: string;
	options?: Array<{ id: string; label: string }>;
	visibleWhen?: WaiverFieldCondition;
};

/**
 * Field types that can drive a condition. Option-based types use an option id
 * as the condition value; checkboxes use a boolean.
 */
const BOOLEAN_SOURCE_TYPES = new Set(['checkbox']);
const OPTION_SOURCE_TYPES = new Set(['select', 'multiselect']);

export function isConditionSourceType(type: string): boolean {
	return BOOLEAN_SOURCE_TYPES.has(type) || OPTION_SOURCE_TYPES.has(type);
}

function answerMatches(sourceType: string, answer: unknown, value: string | boolean): boolean {
	if (BOOLEAN_SOURCE_TYPES.has(sourceType)) {
		return (answer === true) === (value === true);
	}
	if (Array.isArray(answer)) {
		return answer.includes(value);
	}
	return typeof answer === 'string' && answer === value;
}

export function isConditionSatisfied(
	condition: WaiverFieldCondition,
	sourceType: string,
	answer: unknown
): boolean {
	const matches = answerMatches(sourceType, answer, condition.value);
	return condition.operator === 'equals' ? matches : !matches;
}

/**
 * Returns the ids of fields that should be shown for the given answers. A
 * field whose source field is hidden is hidden too, so chains collapse.
 */
export function getVisibleFieldIds(
	fields: ReadonlyArray<ConditionalFieldLike>,
	answers: Record<string, unknown>
): Set<string> {
	const visible = new Set<string>();
	const typeById = new Map<string, string>();

	for (const field of fields) {
		typeById.set(field.id, field.type);
		const condition = field.visibleWhen;
		if (!condition) {
			visible.add(field.id);
			continue;
		}

		const sourceType = typeById.get(condition.fieldId);
		if (!sourceType || !visible.has(condition.fieldId)) {
			continue;
		}
		if (isConditionSatisfied(condition, sourceType, answers[condition.fieldId])) {
			visible.add(field.id);
		}
	}

	return visible;
}

/**
 * Trims string answers for known fields so visibility, validation and storage
 * all see the same value (e.g. a select answer of " yes" becomes "yes").
 */
export function canonicalizeAnswers<T>(
	fields: ReadonlyArray<ConditionalFieldLike>,
	answers: Record<string, T>
): Record<string, T> {
	const fieldIds = new Set(fields.map((field) => field.id));
	const next: Record<string, T> = {};
	for (const [key, value] of Object.entries(answers)) {
		next[key] = fieldIds.has(key) && typeof value === 'string' ? (value.trim() as T) : value;
	}
	return next;
}

/** Drops answers for fields that are hidden by their conditions. */
export function pruneHiddenAnswers<T>(
	fields: ReadonlyArray<ConditionalFieldLike>,
	answers: Record<string, T>
): Record<string, T> {
	const conditionalIds = new Set(
		fields.filter((field) => field.visibleWhen).map((field) => field.id)
	);
	if (conditionalIds.size === 0) {
		return answers;
	}

	const visible = getVisibleFieldIds(fields, answers);
	const next: Record<string, T> = {};
	for (const [key, value] of Object.entries(answers)) {
		if (conditionalIds.has(key) && !visible.has(key)) continue;
		next[key] = value;
	}
	return next;
}

/**
 * Returns a human-readable problem with the field's condition, or null when it
 * is valid. Conditions must point at an earlier checkbox or option field, use
 * a value that field can produce, and never point at the field itself.
 */
export function getConditionProblem(
	fields: ReadonlyArray<ConditionalFieldLike>,
	index: number
): string | null {
	const field = fields[index];
	const condition = field?.visibleWhen;
	if (!field || !condition) return null;

	if (condition.operator !== 'equals' && condition.operator !== 'not_equals') {
		return `"${field.label}" has an unknown condition operator.`;
	}

	const sourceIndex = fields.findIndex((entry) => entry.id === condition.fieldId);
	if (sourceIndex === -1) {
		return `"${field.label}" depends on a field that no longer exists.`;
	}
	if (sourceIndex >= index) {
		return `"${field.label}" must come after the field its condition depends on.`;
	}

	const source = fields[sourceIndex]!;
	if (BOOLEAN_SOURCE_TYPES.has(source.type)) {
		if (typeof condition.value !== 'boolean') {
			return `"${field.label}" needs a checked or unchecked condition value.`;
		}
		return null;
	}
	if (OPTION_SOURCE_TYPES.has(source.type)) {
		if (
			typeof condition.value !== 'string' ||
			!source.options?.some((option) => option.id === condition.value)
		) {
			return `"${field.label}" depends on an option that no longer exists.`;
		}
		return null;
	}

	return `"${field.label}" can only depend on a checkbox or dropdown field.`;
}

export function findFirstConditionProblem(
	fields: ReadonlyArray<ConditionalFieldLike>
): string | null {
	for (let index = 0; index < fields.length; index += 1) {
		const problem = getConditionProblem(fields, index);
		if (problem) return problem;
	}
	return null;
}

/** "Shown when "Any medical conditions?" is Yes" style summary for previews. */
export function describeCondition(
	fields: ReadonlyArray<ConditionalFieldLike>,
	condition: WaiverFieldCondition
): string {
	const source = fields.find((entry) => entry.id === condition.fieldId);
	if (!source) return 'Shown conditionally';

	let valueLabel: string;
	if (BOOLEAN_SOURCE_TYPES.has(source.type)) {
		valueLabel = condition.value === true ? 'checked' : 'unchecked';
	} else {
		valueLabel =
			source.options?.find((option) => option.id === condition.value)?.label ??
			String(condition.value);
	}

	const verb = condition.operator === 'equals' ? 'is' : 'is not';
	return `Shown when "${source.label}" ${verb} ${valueLabel}`;
}
