import { ConvexError, v } from 'convex/values';
import { sanitizeRichTextHtml } from '../../lib/utils/rich-text';
import {
	MAX_SELECT_OPTION_LABEL_LENGTH,
	MAX_WAIVER_FIELD_LABEL_LENGTH,
	MAX_WAIVER_TITLE_LENGTH
} from '../../lib/domain/waiver-constraints';
import {
	DEFAULT_WAIVER_LOCALE,
	MAX_WAIVER_TRANSLATIONS,
	WAIVER_LOCALE_ENGLISH_NAMES,
	availableWaiverLocales,
	isWaiverLocale,
	localizeWaiver,
	type WaiverLocale,
	type WaiverTranslation
} from '../../lib/domain/waiver-i18n';
import type { WaiverDefinition } from './waivers';

// Keep in sync with WAIVER_LOCALES in src/lib/domain/waiver-i18n.ts.
export const waiverLocaleValidator = v.union(
	v.literal('en'),
	v.literal('es'),
	v.literal('fr'),
	v.literal('de'),
	v.literal('pt'),
	v.literal('it'),
	v.literal('zh'),
	v.literal('ja')
);

export const waiverFieldTranslationValidator = v.object({
	id: v.string(),
	label: v.optional(v.string()),
	placeholder: v.optional(v.string()),
	options: v.optional(v.array(v.object({ id: v.string(), label: v.string() })))
});

export const waiverTranslationValidator = v.object({
	locale: waiverLocaleValidator,
	title: v.string(),
	introCopy: v.string(),
	fields: v.array(waiverFieldTranslationValidator)
});

const MAX_PLACEHOLDER_LENGTH = 200;

function assertMaxLength(value: string, max: number, message: string) {
	if (value.length > max) {
		throw new ConvexError({ code: 'invalid_argument', message });
	}
}

/**
 * Cleans owner-entered translations against the current waiver fields. Entries for
 * fields or options that no longer exist are dropped, blank strings are dropped (they
 * fall back to the primary language when signing), and intro copy is sanitized the same
 * way as the primary copy.
 */
export function normalizeWaiverTranslations(
	defaultLocale: WaiverLocale,
	fields: WaiverDefinition['fields'],
	translations: WaiverTranslation[]
): WaiverTranslation[] {
	if (translations.length > MAX_WAIVER_TRANSLATIONS) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Add at most ${MAX_WAIVER_TRANSLATIONS} translations.`
		});
	}

	const seenLocales = new Set<WaiverLocale>();
	const fieldsById = new Map(fields.map((field) => [field.id, field]));

	return translations.map((translation) => {
		if (!isWaiverLocale(translation.locale)) {
			throw new ConvexError({ code: 'invalid_argument', message: 'Unsupported language.' });
		}
		if (translation.locale === defaultLocale) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `${WAIVER_LOCALE_ENGLISH_NAMES[translation.locale]} is already the waiver's primary language.`
			});
		}
		if (seenLocales.has(translation.locale)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `${WAIVER_LOCALE_ENGLISH_NAMES[translation.locale]} was added more than once.`
			});
		}
		seenLocales.add(translation.locale);

		const title = translation.title.trim();
		assertMaxLength(
			title,
			MAX_WAIVER_TITLE_LENGTH,
			`Translated titles must be at most ${MAX_WAIVER_TITLE_LENGTH} characters.`
		);

		const fieldTranslations: WaiverTranslation['fields'] = [];
		const seenFieldIds = new Set<string>();
		for (const fieldTranslation of translation.fields) {
			const field = fieldsById.get(fieldTranslation.id);
			if (!field || seenFieldIds.has(field.id)) continue;
			seenFieldIds.add(field.id);

			const label = fieldTranslation.label?.trim() ?? '';
			assertMaxLength(
				label,
				MAX_WAIVER_FIELD_LABEL_LENGTH,
				`Translated field labels must be at most ${MAX_WAIVER_FIELD_LABEL_LENGTH} characters.`
			);
			const entry: WaiverTranslation['fields'][number] = { id: field.id };
			if (label) entry.label = label;

			if (field.type === 'text') {
				const placeholder = fieldTranslation.placeholder?.trim() ?? '';
				assertMaxLength(
					placeholder,
					MAX_PLACEHOLDER_LENGTH,
					`Translated placeholders must be at most ${MAX_PLACEHOLDER_LENGTH} characters.`
				);
				if (placeholder) entry.placeholder = placeholder;
			}

			if (field.type === 'select') {
				const optionIds = new Set(field.options.map((option) => option.id));
				const options = (fieldTranslation.options ?? [])
					.map((option) => ({ id: option.id, label: option.label.trim() }))
					.filter((option) => optionIds.has(option.id) && option.label.length > 0);
				for (const option of options) {
					assertMaxLength(
						option.label,
						MAX_SELECT_OPTION_LABEL_LENGTH,
						`Translated option labels must be at most ${MAX_SELECT_OPTION_LABEL_LENGTH} characters.`
					);
				}
				if (options.length > 0) entry.options = options;
			}

			if (entry.label || entry.placeholder || entry.options) {
				fieldTranslations.push(entry);
			}
		}

		return {
			locale: translation.locale,
			title,
			introCopy: sanitizeRichTextHtml(translation.introCopy),
			fields: fieldTranslations
		};
	});
}

/** Stable comparison key for unpublished-change detection. */
export function waiverTranslationsKey(
	defaultLocale: WaiverLocale | undefined,
	translations: WaiverTranslation[] | undefined
): string {
	return JSON.stringify({
		defaultLocale: defaultLocale ?? DEFAULT_WAIVER_LOCALE,
		translations: translations ?? []
	});
}

/**
 * Validates the language a signer chose against the published version. Falls back to
 * the primary language when the client sends nothing (older clients).
 */
export function resolveSignedLocale(
	version: { defaultLocale?: WaiverLocale; translations?: WaiverTranslation[] },
	requested: string | undefined
): WaiverLocale {
	const defaultLocale = version.defaultLocale ?? DEFAULT_WAIVER_LOCALE;
	if (requested === undefined) return defaultLocale;
	const available = availableWaiverLocales(defaultLocale, version.translations);
	if (!isWaiverLocale(requested) || !available.includes(requested)) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'This waiver is not available in the selected language.'
		});
	}
	return requested;
}

export { localizeWaiver };
