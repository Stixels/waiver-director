import {
	MAX_SELECT_OPTION_LABEL_LENGTH,
	MAX_SELECT_OPTIONS,
	MAX_WAIVER_FIELD_LABEL_LENGTH,
	MAX_WAIVER_TITLE_LENGTH,
	MIN_SELECT_OPTION_LABEL_LENGTH,
	MIN_SELECT_OPTIONS,
	MIN_WAIVER_FIELD_LABEL_LENGTH,
	MIN_WAIVER_TITLE_LENGTH
} from './waiver-constraints.ts';
import type { WaiverField } from './waivers.ts';

/**
 * AI waiver generator: the model returns plain-text structure only. This
 * module turns that structure into a waiver draft (escaped HTML copy plus
 * fields that fit the builder's constraints). Nothing here publishes; the
 * result only replaces the editable draft after the owner confirms.
 */

export const WAIVER_AI_LEGAL_NOTICE =
	'AI drafts are a starting point, not legal advice. Laws differ by location and activity, so have a qualified lawyer review your waiver before you publish it.';

export const WAIVER_AI_MIN_DESCRIPTION_LENGTH = 10;
export const WAIVER_AI_MAX_DESCRIPTION_LENGTH = 1000;
export const WAIVER_AI_MAX_LOCATION_LENGTH = 120;
export const WAIVER_AI_MAX_FIELDS = 12;
export const WAIVER_AI_MAX_SECTIONS = 10;
export const WAIVER_AI_MAX_PARAGRAPHS = 4;
export const WAIVER_AI_MAX_BULLETS = 10;
export const WAIVER_AI_MAX_NOTES = 5;
const MAX_HEADING_LENGTH = 120;
const MAX_PARAGRAPH_LENGTH = 1500;
const MAX_BULLET_LENGTH = 300;
const MAX_NOTE_LENGTH = 300;
const MAX_PLACEHOLDER_LENGTH = 120;

export type WaiverAIRequest = {
	description: string;
	location: string;
};

export type WaiverAIDraft = {
	title: string;
	introCopy: string;
	fields: WaiverField[];
	notes: string[];
};

export type RawWaiverAIResult = {
	title?: unknown;
	sections?: unknown;
	fields?: unknown;
	notes?: unknown;
};

export const waiverAIResponseSchema = {
	type: 'object',
	properties: {
		title: { type: 'string' },
		sections: {
			type: 'array',
			maxItems: WAIVER_AI_MAX_SECTIONS,
			items: {
				type: 'object',
				properties: {
					heading: { type: 'string' },
					paragraphs: {
						type: 'array',
						items: { type: 'string' },
						maxItems: WAIVER_AI_MAX_PARAGRAPHS
					},
					bullets: { type: 'array', items: { type: 'string' }, maxItems: WAIVER_AI_MAX_BULLETS }
				},
				required: ['heading', 'paragraphs', 'bullets'],
				additionalProperties: false
			}
		},
		fields: {
			type: 'array',
			maxItems: WAIVER_AI_MAX_FIELDS,
			items: {
				type: 'object',
				properties: {
					type: { type: 'string', enum: ['text', 'checkbox', 'select', 'date'] },
					label: { type: 'string' },
					required: { type: 'boolean' },
					placeholder: { type: 'string' },
					options: { type: 'array', items: { type: 'string' }, maxItems: MAX_SELECT_OPTIONS }
				},
				required: ['type', 'label', 'required', 'placeholder', 'options'],
				additionalProperties: false
			}
		},
		notes: { type: 'array', items: { type: 'string' }, maxItems: WAIVER_AI_MAX_NOTES }
	},
	required: ['title', 'sections', 'fields', 'notes'],
	additionalProperties: false
} as const;

export function normalizeWaiverAIRequest(
	value: unknown
): { ok: true; request: WaiverAIRequest } | { ok: false; message: string } {
	if (!value || typeof value !== 'object') {
		return { ok: false, message: 'Request body is missing the activity description.' };
	}
	const body = value as { description?: unknown; location?: unknown };
	const description = typeof body.description === 'string' ? collapse(body.description) : '';
	const location = typeof body.location === 'string' ? collapse(body.location) : '';

	if (description.length < WAIVER_AI_MIN_DESCRIPTION_LENGTH) {
		return {
			ok: false,
			message: `Describe your activity in at least ${WAIVER_AI_MIN_DESCRIPTION_LENGTH} characters.`
		};
	}
	if (description.length > WAIVER_AI_MAX_DESCRIPTION_LENGTH) {
		return {
			ok: false,
			message: `Keep the activity description under ${WAIVER_AI_MAX_DESCRIPTION_LENGTH} characters.`
		};
	}
	if (location.length > WAIVER_AI_MAX_LOCATION_LENGTH) {
		return {
			ok: false,
			message: `Keep the location under ${WAIVER_AI_MAX_LOCATION_LENGTH} characters.`
		};
	}

	return { ok: true, request: { description, location } };
}

export function parseWaiverAIModelJson(content: string): RawWaiverAIResult | null {
	const trimmed = content
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '');
	try {
		const parsed: unknown = JSON.parse(trimmed);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		return parsed as RawWaiverAIResult;
	} catch {
		return null;
	}
}

function collapse(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, max: number): string {
	if (value.length <= max) return value;
	return value.slice(0, max).trimEnd();
}

function cleanString(value: unknown, max: number): string {
	return typeof value === 'string' ? truncate(collapse(value), max) : '';
}

function cleanStringList(value: unknown, maxItems: number, maxLength: number): string[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const result: string[] = [];
	for (const item of value) {
		const text = cleanString(item, maxLength);
		const key = text.toLowerCase();
		if (!text || seen.has(key)) continue;
		seen.add(key);
		result.push(text);
		if (result.length >= maxItems) break;
	}
	return result;
}

function escapeHtmlText(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function slugPart(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 24);
}

function defaultSuffix(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID().slice(0, 8)
		: Math.random().toString(36).slice(2, 10);
}

function buildIntroCopy(sections: unknown): string {
	if (!Array.isArray(sections)) return '';
	const parts: string[] = [];
	for (const section of sections.slice(0, WAIVER_AI_MAX_SECTIONS)) {
		if (!section || typeof section !== 'object') continue;
		const raw = section as { heading?: unknown; paragraphs?: unknown; bullets?: unknown };
		const heading = cleanString(raw.heading, MAX_HEADING_LENGTH);
		const paragraphs = cleanStringList(
			raw.paragraphs,
			WAIVER_AI_MAX_PARAGRAPHS,
			MAX_PARAGRAPH_LENGTH
		);
		const bullets = cleanStringList(raw.bullets, WAIVER_AI_MAX_BULLETS, MAX_BULLET_LENGTH);
		if (paragraphs.length === 0 && bullets.length === 0) continue;

		if (heading) parts.push(`<h3>${escapeHtmlText(heading)}</h3>`);
		for (const paragraph of paragraphs) parts.push(`<p>${escapeHtmlText(paragraph)}</p>`);
		if (bullets.length > 0) {
			parts.push(
				`<ul>${bullets.map((bullet) => `<li>${escapeHtmlText(bullet)}</li>`).join('')}</ul>`
			);
		}
	}
	return parts.join('');
}

function buildFields(value: unknown, suffix: string): WaiverField[] {
	if (!Array.isArray(value)) return [];
	const fields: WaiverField[] = [];
	const usedIds = new Set<string>();
	const usedLabels = new Set<string>();

	const uniqueId = (base: string) => {
		let id = base.slice(0, 48);
		let counter = 2;
		while (usedIds.has(id)) {
			id = `${base.slice(0, 44)}-${counter}`;
			counter += 1;
		}
		usedIds.add(id);
		return id;
	};

	for (const item of value) {
		if (fields.length >= WAIVER_AI_MAX_FIELDS) break;
		if (!item || typeof item !== 'object') continue;
		const raw = item as {
			type?: unknown;
			label?: unknown;
			required?: unknown;
			placeholder?: unknown;
			options?: unknown;
		};
		const label = cleanString(raw.label, MAX_WAIVER_FIELD_LABEL_LENGTH);
		if (label.length < MIN_WAIVER_FIELD_LABEL_LENGTH) continue;
		if (usedLabels.has(label.toLowerCase())) continue;
		const required = raw.required === true;
		const id = uniqueId(`ai-${slugPart(label) || 'field'}-${suffix}`);

		switch (raw.type) {
			case 'text': {
				const placeholder = cleanString(raw.placeholder, MAX_PLACEHOLDER_LENGTH);
				fields.push({ id, type: 'text', label, required, placeholder });
				break;
			}
			case 'checkbox':
			case 'date':
				fields.push({ id, type: raw.type, label, required });
				break;
			case 'select': {
				const labels = cleanStringList(
					raw.options,
					MAX_SELECT_OPTIONS,
					MAX_SELECT_OPTION_LABEL_LENGTH
				).filter((option) => option.length >= MIN_SELECT_OPTION_LABEL_LENGTH);
				if (labels.length < Math.max(MIN_SELECT_OPTIONS, 2)) continue;
				fields.push({
					id,
					type: 'select',
					label,
					required,
					options: labels.map((option, index) => ({
						id: uniqueId(`ai-${slugPart(option) || 'option'}-${index + 1}-${suffix}`),
						label: option
					}))
				});
				break;
			}
			default:
				continue;
		}
		usedLabels.add(label.toLowerCase());
	}
	return fields;
}

/**
 * Validates the model output and builds a draft. Returns an error when the
 * result is unusable (no title or no waiver copy). Invalid individual fields
 * are dropped rather than failing the whole draft.
 */
export function buildWaiverAIDraft(
	raw: RawWaiverAIResult,
	sanitizeIntroCopy: (html: string) => string,
	idSuffix: string = defaultSuffix()
): { ok: true; draft: WaiverAIDraft } | { ok: false; message: string } {
	const title = cleanString(raw.title, MAX_WAIVER_TITLE_LENGTH);
	if (title.length < MIN_WAIVER_TITLE_LENGTH) {
		return { ok: false, message: 'AI response did not include a usable waiver title.' };
	}

	const introCopy = sanitizeIntroCopy(buildIntroCopy(raw.sections));
	if (!introCopy.replace(/<[^>]*>/g, '').trim()) {
		return { ok: false, message: 'AI response did not include any waiver copy.' };
	}

	const suffix = slugPart(idSuffix) || defaultSuffix();
	return {
		ok: true,
		draft: {
			title,
			introCopy,
			fields: buildFields(raw.fields, suffix),
			notes: cleanStringList(raw.notes, WAIVER_AI_MAX_NOTES, MAX_NOTE_LENGTH)
		}
	};
}

export function buildWaiverAIPrompt(args: WaiverAIRequest & { workspaceName: string }): string {
	return [
		'You draft liability waivers for Waiver Director, a waiver operations SaaS used by activity and tour businesses.',
		'Write a first draft of a waiver for the business described below. The owner will edit it and is told to have a lawyer review it.',
		'Use plain, readable language. Be specific to the activity: name the real risks of this activity, the safety rules participants should follow, and any equipment involved.',
		'Include sections for: what the activity involves, assumption of risk (with a bullet list of specific risks), participant responsibilities and rules, health and fitness, release of liability, medical treatment consent, minors (a parent or guardian signs for them), and a short closing acknowledgement.',
		'Refer to the business by its name. Do not invent facts about the business such as prices, insurance, certifications, staff qualifications, or locations beyond what the description says.',
		'Do not claim the waiver complies with any specific law, and do not cite statutes. If a location is given you may use its spelling and conventions, but do not give legal conclusions.',
		'The signing form already collects the signer full name, email, a drawn signature, the signing date, and names of covered minors. Do NOT add fields for any of these.',
		'Add 3 to 8 custom fields that suit the activity, such as emergency contact name and phone (text), experience level (select), relevant health questions, and acknowledgement checkboxes for key rules. Use "select" only with 2 to 6 short options. Use an empty string for placeholder when it does not apply and an empty options array for non-select fields.',
		'Section text is plain text only: no HTML, no markdown, no placeholders like [Business Name].',
		'In notes, list 2 to 4 short things the owner should check or customize before publishing (for example age limits, local rules, or details only they know).',
		'Return only valid JSON matching the requested schema. Do not wrap it in markdown.',
		'',
		`Business name: ${args.workspaceName}`,
		`Location: ${args.location || 'Not provided'}`,
		`Activity description: ${args.description}`
	].join('\n');
}
