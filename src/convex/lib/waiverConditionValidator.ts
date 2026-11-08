import { v } from 'convex/values';

/**
 * Optional "show this field only when..." rule on a waiver field. Semantics
 * live in `src/lib/domain/waiver-conditions.ts`.
 */
export const waiverFieldConditionValidator = v.object({
	fieldId: v.string(),
	operator: v.union(v.literal('equals'), v.literal('not_equals')),
	value: v.union(v.string(), v.boolean())
});
