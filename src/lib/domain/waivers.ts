import { sanitizeRichTextHtml } from '$lib/utils/rich-text-client';
import {
	MAX_SELECT_OPTION_LABEL_LENGTH,
	MAX_SELECT_OPTIONS,
	MAX_WAIVER_FIELD_LABEL_LENGTH,
	MAX_WAIVER_FIELDS,
	MAX_WAIVER_TITLE_LENGTH,
	MIN_SELECT_OPTION_LABEL_LENGTH,
	MIN_SELECT_OPTIONS,
	MIN_WAIVER_FIELD_LABEL_LENGTH,
	MIN_WAIVER_TITLE_LENGTH
} from '$lib/domain/waiver-constraints';
import {
	MAX_CLAUSE_LENGTH,
	MIN_CLAUSE_LENGTH,
	isOptionField,
	type WaiverField,
	type WaiverFieldType
} from '$lib/domain/waiver-fields';

export type {
	WaiverAnswers,
	WaiverAnswerValue,
	WaiverField,
	WaiverFieldOption,
	WaiverFieldType
} from '$lib/domain/waiver-fields';
export type WaiverTheme = 'light' | 'dark';

export type WaiverDefinition = {
	title: string;
	introCopy: string;
	fields: WaiverField[];
	theme: WaiverTheme;
};

export type WorkspaceWaiverRecord = WaiverDefinition & {
	waiverId: string;
	publicSlug: string;
	publishedVersionId: string | null;
	hasUnpublishedChanges: boolean;
};

export type PublicWaiverRecord = {
	slug: string;
	versionId: string;
	workspaceName: string;
	title: string;
	introCopy: string;
	fields: WaiverField[];
	theme: WaiverTheme;
};

export type WaiverMinor = {
	fullName: string;
};

export const waiverFieldTypeOptions: Array<{
	value: WaiverFieldType;
	label: string;
}> = [
	{ value: 'text', label: 'Text' },
	{ value: 'checkbox', label: 'Checkbox' },
	{ value: 'select', label: 'Dropdown' },
	{ value: 'multiselect', label: 'Multi-select' },
	{ value: 'date', label: 'Date' },
	{ value: 'phone', label: 'Phone' },
	{ value: 'number', label: 'Number' },
	{ value: 'address', label: 'Address' },
	{ value: 'emergency_contact', label: 'Emergency contact' },
	{ value: 'initials', label: 'Initials' }
];

export function createFieldId(prefix = 'field'): string {
	const randomId =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	return `${prefix}-${randomId}`
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.slice(0, 48);
}

export function createOptionId(label = 'option'): string {
	return createFieldId(label);
}

export function createBlankField(type: WaiverFieldType): WaiverField {
	const id = createFieldId(type);

	switch (type) {
		case 'text':
			return {
				id,
				type,
				label: 'Text answer',
				required: false,
				placeholder: ''
			};
		case 'checkbox':
			return {
				id,
				type,
				label: 'I agree',
				required: false
			};
		case 'select':
			return {
				id,
				type,
				label: 'Choose one',
				required: false,
				options: [
					{ id: createOptionId('option-a'), label: 'Option A' },
					{ id: createOptionId('option-b'), label: 'Option B' }
				]
			};
		case 'multiselect':
			return {
				id,
				type,
				label: 'Choose all that apply',
				required: false,
				options: [
					{ id: createOptionId('option-a'), label: 'Option A' },
					{ id: createOptionId('option-b'), label: 'Option B' }
				]
			};
		case 'date':
			return {
				id,
				type,
				label: 'Date',
				required: false
			};
		case 'phone':
			return {
				id,
				type,
				label: 'Phone number',
				required: false
			};
		case 'number':
			return {
				id,
				type,
				label: 'Number',
				required: false
			};
		case 'address':
			return {
				id,
				type,
				label: 'Home address',
				required: false
			};
		case 'emergency_contact':
			return {
				id,
				type,
				label: 'Emergency contact',
				required: true
			};
		case 'initials':
			return {
				id,
				type,
				label: 'Assumption of risk',
				required: true,
				clause: 'I understand this activity carries inherent risks and I voluntarily accept them.'
			};
	}
}

export function createBlankDefinition(title = 'New waiver'): WaiverDefinition {
	return {
		title,
		introCopy: '<p></p>',
		fields: [],
		theme: 'dark'
	};
}

export function cloneDefinition(definition: WaiverDefinition): WaiverDefinition {
	return {
		title: definition.title,
		introCopy: sanitizeRichTextHtml(definition.introCopy),
		theme: definition.theme ?? 'dark',
		fields: definition.fields.map((field) => {
			if (isOptionField(field)) {
				return {
					...field,
					options: field.options.map((option) => ({ ...option }))
				};
			}

			return { ...field };
		})
	};
}

export function formatFieldTypeLabel(type: WaiverFieldType): string {
	return waiverFieldTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function isWaiverDefinitionAutosaveable(definition: WaiverDefinition | null): boolean {
	if (!definition) return false;

	const title = definition.title.trim();
	if (title.length < MIN_WAIVER_TITLE_LENGTH || title.length > MAX_WAIVER_TITLE_LENGTH) {
		return false;
	}
	if (definition.fields.length > MAX_WAIVER_FIELDS) return false;

	for (const field of definition.fields) {
		const label = field.label.trim();
		if (
			label.length < MIN_WAIVER_FIELD_LABEL_LENGTH ||
			label.length > MAX_WAIVER_FIELD_LABEL_LENGTH
		) {
			return false;
		}

		if (field.type === 'initials') {
			const clause = field.clause.trim();
			if (clause.length < MIN_CLAUSE_LENGTH || clause.length > MAX_CLAUSE_LENGTH) return false;
		}

		if (field.type === 'number') {
			if (field.min !== undefined && !Number.isFinite(field.min)) return false;
			if (field.max !== undefined && !Number.isFinite(field.max)) return false;
			if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
				return false;
			}
		}

		if (isOptionField(field)) {
			if (field.options.length < MIN_SELECT_OPTIONS || field.options.length > MAX_SELECT_OPTIONS) {
				return false;
			}

			for (const option of field.options) {
				const optionLabel = option.label.trim();
				if (
					optionLabel.length < MIN_SELECT_OPTION_LABEL_LENGTH ||
					optionLabel.length > MAX_SELECT_OPTION_LABEL_LENGTH
				) {
					return false;
				}
			}
		}
	}

	return true;
}

function normalizeFieldForCompare(field: WaiverField): WaiverField {
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
			};
		case 'text':
		case 'phone':
			return { ...field, label, placeholder: field.placeholder?.trim() || undefined };
		case 'initials':
			return { ...field, label, clause: field.clause.trim() };
		default:
			return { ...field, label };
	}
}

export function normalizeDefinitionForCompare(definition: WaiverDefinition): WaiverDefinition {
	return {
		title: definition.title.trim(),
		introCopy: sanitizeRichTextHtml(definition.introCopy),
		theme: definition.theme ?? 'dark',
		fields: definition.fields.map(normalizeFieldForCompare)
	};
}

export function definitionsEqual(a: WaiverDefinition | null, b: WaiverDefinition | null): boolean {
	if (!a || !b) {
		return a === b;
	}

	return (
		JSON.stringify(normalizeDefinitionForCompare(a)) ===
		JSON.stringify(normalizeDefinitionForCompare(b))
	);
}
