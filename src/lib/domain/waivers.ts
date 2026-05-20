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

export type WaiverFieldType = 'text' | 'checkbox' | 'select' | 'date';

export type WaiverField =
	| {
			id: string;
			type: 'text';
			label: string;
			required: boolean;
			placeholder?: string;
	  }
	| {
			id: string;
			type: 'checkbox';
			label: string;
			required: boolean;
	  }
	| {
			id: string;
			type: 'select';
			label: string;
			required: boolean;
			options: Array<{
				id: string;
				label: string;
			}>;
	  }
	| {
			id: string;
			type: 'date';
			label: string;
			required: boolean;
	  };

export type WaiverDefinition = {
	title: string;
	introCopy: string;
	fields: WaiverField[];
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
	{ value: 'date', label: 'Date' }
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
		case 'date':
			return {
				id,
				type,
				label: 'Date',
				required: false
			};
	}
}

export function createBlankDefinition(title = 'New waiver'): WaiverDefinition {
	return {
		title,
		introCopy: '<p></p>',
		fields: []
	};
}

export function cloneDefinition(definition: WaiverDefinition): WaiverDefinition {
	return {
		title: definition.title,
		introCopy: sanitizeRichTextHtml(definition.introCopy),
		fields: definition.fields.map((field) => {
			if (field.type === 'select') {
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

		if (field.type === 'select') {
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

export function normalizeDefinitionForCompare(definition: WaiverDefinition): WaiverDefinition {
	return {
		title: definition.title.trim(),
		introCopy: sanitizeRichTextHtml(definition.introCopy),
		fields: definition.fields.map((field) => {
			if (field.type === 'select') {
				return {
					...field,
					label: field.label.trim(),
					options: field.options.map((option) => ({
						id: option.id.trim(),
						label: option.label.trim()
					}))
				};
			}

			if ('placeholder' in field) {
				return {
					...field,
					label: field.label.trim(),
					placeholder: field.placeholder?.trim() || undefined
				};
			}

			return {
				...field,
				label: field.label.trim()
			};
		})
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
