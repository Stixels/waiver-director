import { v, type Infer } from 'convex/values';

// Shared by schema.ts and function validators so the stored field shape and
// the API shape cannot drift apart. Keep this file free of runtime imports
// beyond `convex/values`.

const waiverFieldOptionValidator = v.object({
	id: v.string(),
	label: v.string(),
	flagged: v.optional(v.boolean())
});

export const waiverFieldValidator = v.union(
	v.object({
		id: v.string(),
		type: v.literal('text'),
		label: v.string(),
		required: v.boolean(),
		placeholder: v.optional(v.string())
	}),
	v.object({
		id: v.string(),
		type: v.literal('checkbox'),
		label: v.string(),
		required: v.boolean(),
		flagWhenChecked: v.optional(v.boolean())
	}),
	v.object({
		id: v.string(),
		type: v.literal('select'),
		label: v.string(),
		required: v.boolean(),
		options: v.array(waiverFieldOptionValidator)
	}),
	v.object({
		id: v.string(),
		type: v.literal('multiselect'),
		label: v.string(),
		required: v.boolean(),
		options: v.array(waiverFieldOptionValidator)
	}),
	v.object({
		id: v.string(),
		type: v.literal('date'),
		label: v.string(),
		required: v.boolean()
	}),
	v.object({
		id: v.string(),
		type: v.literal('phone'),
		label: v.string(),
		required: v.boolean(),
		placeholder: v.optional(v.string())
	}),
	v.object({
		id: v.string(),
		type: v.literal('number'),
		label: v.string(),
		required: v.boolean(),
		min: v.optional(v.number()),
		max: v.optional(v.number())
	}),
	v.object({
		id: v.string(),
		type: v.literal('address'),
		label: v.string(),
		required: v.boolean()
	}),
	v.object({
		id: v.string(),
		type: v.literal('emergency_contact'),
		label: v.string(),
		required: v.boolean()
	}),
	v.object({
		id: v.string(),
		type: v.literal('initials'),
		label: v.string(),
		required: v.boolean(),
		clause: v.string()
	})
);

export type WaiverFieldValue = Infer<typeof waiverFieldValidator>;

export const waiverAnswerValueValidator = v.union(
	v.string(),
	v.boolean(),
	v.null(),
	v.array(v.string()),
	v.record(v.string(), v.string())
);
