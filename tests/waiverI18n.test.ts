import assert from 'node:assert/strict';
import test from 'node:test';
import {
	WAIVER_CHROME_STRINGS,
	WAIVER_LOCALES,
	availableWaiverLocales,
	formatWaiverString,
	localizeWaiver,
	localizedMarketingConsentLabel,
	pickWaiverLocale,
	waiverSourceFingerprint,
	waiverTranslationStatus,
	type WaiverTranslation
} from '../src/lib/domain/waiver-i18n.ts';

const baseWaiver = {
	title: 'Climbing Waiver',
	introCopy: '<p>You accept the risks.</p>',
	theme: 'dark' as const,
	fields: [
		{
			id: 'medical',
			type: 'text' as const,
			label: 'Medical notes',
			required: false,
			placeholder: 'Allergies'
		},
		{
			id: 'experience',
			type: 'select' as const,
			label: 'Experience',
			required: true,
			options: [
				{ id: 'new', label: 'New' },
				{ id: 'pro', label: 'Pro' }
			]
		},
		{ id: 'agree', type: 'checkbox' as const, label: 'I agree', required: true }
	]
};

const spanish: WaiverTranslation = {
	locale: 'es',
	title: 'Exención de escalada',
	introCopy: '<p>Aceptas los riesgos.</p>',
	fields: [
		{ id: 'medical', label: 'Notas médicas' },
		{ id: 'experience', label: 'Experiencia', options: [{ id: 'new', label: 'Principiante' }] },
		{ id: 'deleted-field', label: 'Ignorado' }
	]
};

test('localizeWaiver translates content and falls back per string', () => {
	const result = localizeWaiver(baseWaiver, [spanish], 'es');
	assert.equal(result.title, 'Exención de escalada');
	assert.equal(result.introCopy, '<p>Aceptas los riesgos.</p>');
	assert.equal(result.theme, 'dark');
	assert.deepEqual(
		result.fields.map((field) => field.label),
		['Notas médicas', 'Experiencia', 'I agree']
	);
	const medical = result.fields[0];
	assert.equal(medical.type === 'text' && medical.placeholder, 'Allergies');
	const experience = result.fields[1];
	assert.ok(experience.type === 'select');
	assert.deepEqual(
		experience.options.map((option) => [option.id, option.label]),
		[
			['new', 'Principiante'],
			['pro', 'Pro']
		]
	);
	assert.deepEqual(
		result.fields.map((field) => field.id),
		baseWaiver.fields.map((field) => field.id)
	);
});

test('localizeWaiver keeps the original for blank copy and unknown locales', () => {
	const blank = { ...spanish, title: '  ', introCopy: '<p></p>' };
	const result = localizeWaiver(baseWaiver, [blank], 'es');
	assert.equal(result.title, baseWaiver.title);
	assert.equal(result.introCopy, baseWaiver.introCopy);
	assert.equal(localizeWaiver(baseWaiver, [spanish], 'fr'), baseWaiver);
	assert.equal(localizeWaiver(baseWaiver, undefined, 'es'), baseWaiver);
});

test('pickWaiverLocale prefers explicit and browser languages that exist', () => {
	const available = availableWaiverLocales('en', [spanish]);
	assert.deepEqual(available, ['en', 'es']);
	assert.equal(pickWaiverLocale(available, ['es-MX']), 'es');
	assert.equal(pickWaiverLocale(available, [null, 'fr-FR', 'es']), 'es');
	assert.equal(pickWaiverLocale(available, ['de']), 'en');
	assert.equal(pickWaiverLocale(['fr'], []), 'fr');
});

test('every locale defines every chrome string with matching placeholders', () => {
	const english = WAIVER_CHROME_STRINGS.en;
	for (const locale of WAIVER_LOCALES) {
		const strings = WAIVER_CHROME_STRINGS[locale];
		for (const key of Object.keys(english) as Array<keyof typeof english>) {
			assert.ok(strings[key]?.trim(), `${locale}.${key} is missing`);
			const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort();
			assert.deepEqual(placeholders(strings[key]), placeholders(english[key]), `${locale}.${key}`);
		}
	}
});

test('marketing consent label matches the stored English wording', () => {
	assert.equal(
		localizedMarketingConsentLabel('en', 'Rock Gym'),
		'Yes, I would like to receive marketing emails from Rock Gym.'
	);
	assert.equal(
		localizedMarketingConsentLabel('es', 'Rock Gym'),
		'Sí, quiero recibir correos de marketing de Rock Gym.'
	);
	assert.equal(formatWaiverString('{a} of {b} {c}', { a: 1, b: 2 }), '1 of 2 {c}');
});

test('translations go stale when the primary text changes', () => {
	const fingerprint = waiverSourceFingerprint(baseWaiver);
	assert.match(fingerprint, /^[0-9a-f]{16}$/);
	assert.equal(waiverSourceFingerprint({ ...baseWaiver }), fingerprint);

	const current = { ...spanish, sourceHash: fingerprint };
	assert.equal(waiverTranslationStatus(current, fingerprint), 'ready');

	const newClause = waiverSourceFingerprint({
		...baseWaiver,
		introCopy: '<p>You accept the risks.</p><p>New release clause.</p>'
	});
	const rewordedCheckbox = waiverSourceFingerprint({
		...baseWaiver,
		fields: baseWaiver.fields.map((field) =>
			field.id === 'agree' ? { ...field, label: 'I agree to all terms' } : field
		)
	});
	assert.notEqual(newClause, fingerprint);
	assert.notEqual(rewordedCheckbox, fingerprint);
	assert.equal(waiverTranslationStatus(current, newClause), 'outdated');
	assert.equal(waiverTranslationStatus({ ...spanish }, fingerprint), 'outdated');
});

test('a translation without waiver text is never ready', () => {
	const fingerprint = waiverSourceFingerprint(baseWaiver);
	assert.equal(
		waiverTranslationStatus({ introCopy: '<p></p>', sourceHash: fingerprint }, fingerprint),
		'missing_text'
	);
	assert.equal(
		waiverTranslationStatus({ introCopy: '<p>&nbsp;</p>', sourceHash: fingerprint }, fingerprint),
		'missing_text'
	);
});
