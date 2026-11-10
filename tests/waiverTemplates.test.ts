import assert from 'node:assert/strict';
import test from 'node:test';
import {
	BUSINESS_NAME_TOKEN,
	buildDefinitionFromTemplate,
	draftHasContent,
	waiverTemplates
} from '../src/lib/domain/waiver-templates.ts';
import {
	MAX_SELECT_OPTION_LABEL_LENGTH,
	MAX_SELECT_OPTIONS,
	MAX_WAIVER_FIELD_LABEL_LENGTH,
	MAX_WAIVER_FIELDS,
	MAX_WAIVER_TITLE_LENGTH,
	MIN_SELECT_OPTIONS,
	MIN_WAIVER_FIELD_LABEL_LENGTH,
	MIN_WAIVER_TITLE_LENGTH
} from '../src/lib/domain/waiver-constraints.ts';
import { ALLOWED_TAGS } from '../src/lib/utils/rich-text-shared.ts';

test('every template fits the waiver constraints the server enforces', () => {
	assert.ok(waiverTemplates.length >= 3);

	for (const template of waiverTemplates) {
		const definition = buildDefinitionFromTemplate(template, { businessName: 'Acme' });

		assert.ok(definition.title.length >= MIN_WAIVER_TITLE_LENGTH, template.id);
		assert.ok(definition.title.length <= MAX_WAIVER_TITLE_LENGTH, template.id);
		assert.ok(definition.fields.length <= MAX_WAIVER_FIELDS, template.id);

		const ids = new Set<string>();
		for (const field of definition.fields) {
			assert.ok(field.label.length >= MIN_WAIVER_FIELD_LABEL_LENGTH, field.label);
			assert.ok(field.label.length <= MAX_WAIVER_FIELD_LABEL_LENGTH, field.label);
			assert.ok(!ids.has(field.id), `duplicate id ${field.id}`);
			ids.add(field.id);

			if (field.type === 'select') {
				assert.ok(field.options.length >= MIN_SELECT_OPTIONS);
				assert.ok(field.options.length <= MAX_SELECT_OPTIONS);
				const optionIds = new Set(field.options.map((option) => option.id));
				assert.equal(optionIds.size, field.options.length, `duplicate option id in ${field.label}`);
				for (const option of field.options) {
					assert.ok(option.label.length <= MAX_SELECT_OPTION_LABEL_LENGTH);
				}
			}
		}
	}
});

test('template copy only uses rich-text tags the sanitizer keeps', () => {
	const allowed = new Set(ALLOWED_TAGS);
	for (const template of waiverTemplates) {
		const tags = [...template.introCopy.matchAll(/<\/?([a-z0-9]+)/g)].map((match) => match[1]);
		for (const tag of tags) {
			assert.ok(allowed.has(tag), `${template.id} uses <${tag}>`);
		}
	}
});

test('fills in and escapes the business name', () => {
	const definition = buildDefinitionFromTemplate(waiverTemplates[0], {
		businessName: 'Rock & <Roll> Gym'
	});

	assert.ok(!definition.introCopy.includes(BUSINESS_NAME_TOKEN));
	assert.ok(definition.introCopy.includes('Rock &amp; &lt;Roll&gt; Gym'));
	assert.ok(!definition.introCopy.includes('<Roll>'));
});

test('falls back to a generic business name and keeps the theme', () => {
	const definition = buildDefinitionFromTemplate(waiverTemplates[0], {
		businessName: '  ',
		theme: 'light'
	});

	assert.ok(definition.introCopy.includes('our business'));
	assert.equal(definition.theme, 'light');
});

test('re-applying a template creates fresh field ids', () => {
	const first = buildDefinitionFromTemplate(waiverTemplates[1]);
	const second = buildDefinitionFromTemplate(waiverTemplates[1]);

	assert.notEqual(first.fields[0].id, second.fields[0].id);
});

test('draftHasContent detects copy and fields', () => {
	assert.equal(draftHasContent(null), false);
	assert.equal(
		draftHasContent({ title: 'New waiver', introCopy: '<p></p>', fields: [], theme: 'dark' }),
		false
	);
	assert.equal(
		draftHasContent({ title: 'New waiver', introCopy: '<p>Terms</p>', fields: [], theme: 'dark' }),
		true
	);
	assert.equal(
		draftHasContent({
			title: 'New waiver',
			introCopy: '<p></p>',
			fields: [{ id: 'a', type: 'checkbox', label: 'I agree', required: true }],
			theme: 'dark'
		}),
		true
	);
});
