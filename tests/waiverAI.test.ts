import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildWaiverAIDraft,
	buildWaiverAIPrompt,
	normalizeWaiverAIRequest,
	parseWaiverAIModelJson,
	WAIVER_AI_MAX_FIELDS,
	type RawWaiverAIResult
} from '../src/lib/domain/waiver-ai.ts';
import {
	MAX_WAIVER_FIELD_LABEL_LENGTH,
	MAX_WAIVER_TITLE_LENGTH
} from '../src/lib/domain/waiver-constraints.ts';
import { buildAIGatewayRequest } from '../src/lib/server/email-ai-gateway.ts';

const identity = (html: string) => html;
const FIELD_ID_PATTERN = /^[a-z0-9-]{3,64}$/;

function validRaw(overrides: Partial<RawWaiverAIResult> = {}): RawWaiverAIResult {
	return {
		title: 'Sea Kayak Tour Release and Waiver',
		sections: [
			{
				heading: 'Assumption of risk',
				paragraphs: ['I understand sea kayaking carries risks.'],
				bullets: ['Capsizing', 'Cold water']
			},
			{
				heading: 'Release of liability',
				paragraphs: ['I release Acme Kayaks from claims.'],
				bullets: []
			}
		],
		fields: [
			{
				type: 'text',
				label: 'Emergency contact name',
				required: true,
				placeholder: 'Full name',
				options: []
			},
			{
				type: 'select',
				label: 'Paddling experience',
				required: true,
				placeholder: '',
				options: ['First time', 'Some', 'Experienced']
			},
			{
				type: 'checkbox',
				label: 'I will wear a life jacket',
				required: true,
				placeholder: '',
				options: []
			}
		],
		notes: ['Confirm your minimum age.'],
		...overrides
	};
}

test('normalizes the request and enforces description length', () => {
	assert.deepEqual(
		normalizeWaiverAIRequest({ description: '  Guided   kayak tours  ', location: ' BC ' }),
		{ ok: true, request: { description: 'Guided kayak tours', location: 'BC' } }
	);
	assert.equal(normalizeWaiverAIRequest({ description: 'short' }).ok, false);
	assert.equal(normalizeWaiverAIRequest({ description: 'x'.repeat(1001) }).ok, false);
	assert.equal(normalizeWaiverAIRequest(null).ok, false);
	assert.equal(
		normalizeWaiverAIRequest({ description: 'Guided kayak tours', location: 'x'.repeat(121) }).ok,
		false
	);
});

test('parses model JSON, including fenced output', () => {
	assert.deepEqual(parseWaiverAIModelJson('```json\n{"title":"A"}\n```'), { title: 'A' });
	assert.equal(parseWaiverAIModelJson('not json'), null);
	assert.equal(parseWaiverAIModelJson('[1,2]'), null);
});

test('builds escaped waiver copy from plain-text sections', () => {
	const result = buildWaiverAIDraft(
		validRaw({
			sections: [
				{
					heading: 'Risks & <rules>',
					paragraphs: ['<script>alert(1)</script> Be careful.'],
					bullets: ['<b>Falls</b>']
				}
			]
		}),
		identity,
		'abc123'
	);
	assert.ok(result.ok);
	assert.equal(
		result.draft.introCopy,
		'<h3>Risks &amp; &lt;rules&gt;</h3><p>&lt;script&gt;alert(1)&lt;/script&gt; Be careful.</p><ul><li>&lt;b&gt;Falls&lt;/b&gt;</li></ul>'
	);
});

test('produces fields that pass the server field rules', () => {
	const result = buildWaiverAIDraft(validRaw(), identity, 'abc123');
	assert.ok(result.ok);
	const { fields } = result.draft;
	assert.equal(fields.length, 3);
	const ids = new Set<string>();
	for (const field of fields) {
		assert.match(field.id, FIELD_ID_PATTERN);
		assert.ok(!ids.has(field.id));
		ids.add(field.id);
		if (field.type === 'select') {
			assert.equal(field.options.length, 3);
			for (const option of field.options) {
				assert.match(option.id, FIELD_ID_PATTERN);
				assert.ok(!ids.has(option.id));
				ids.add(option.id);
			}
		}
	}
	assert.deepEqual(result.draft.notes, ['Confirm your minimum age.']);
});

test('drops invalid fields and caps the field count', () => {
	const many = Array.from({ length: WAIVER_AI_MAX_FIELDS + 5 }, (_, index) => ({
		type: 'checkbox',
		label: `Acknowledgement ${index + 1}`,
		required: false,
		placeholder: '',
		options: []
	}));
	const result = buildWaiverAIDraft(
		validRaw({
			fields: [
				{ type: 'signature', label: 'Sign here', required: true },
				{ type: 'text', label: 'x', required: true },
				{ type: 'select', label: 'One option only', required: true, options: ['Yes'] },
				{ type: 'text', label: 'Emergency contact', required: 'yes' },
				{ type: 'text', label: 'Emergency contact', required: true },
				...many
			]
		}),
		identity,
		'abc123'
	);
	assert.ok(result.ok);
	assert.equal(result.draft.fields.length, WAIVER_AI_MAX_FIELDS);
	assert.equal(result.draft.fields[0].label, 'Emergency contact');
	assert.equal(result.draft.fields[0].required, false);
});

test('truncates long titles and labels to the builder limits', () => {
	const result = buildWaiverAIDraft(
		validRaw({
			title: 'T'.repeat(300),
			fields: [{ type: 'date', label: 'L'.repeat(300), required: false }]
		}),
		identity
	);
	assert.ok(result.ok);
	assert.equal(result.draft.title.length, MAX_WAIVER_TITLE_LENGTH);
	assert.equal(result.draft.fields[0].label.length, MAX_WAIVER_FIELD_LABEL_LENGTH);
});

test('rejects drafts without a title or copy', () => {
	assert.equal(buildWaiverAIDraft(validRaw({ title: ' ' }), identity).ok, false);
	assert.equal(buildWaiverAIDraft(validRaw({ sections: [] }), identity).ok, false);
	assert.equal(
		buildWaiverAIDraft(validRaw({ sections: [{ heading: 'Only a heading' }] }), identity).ok,
		false
	);
});

test('fresh suffixes give fresh ids', () => {
	const first = buildWaiverAIDraft(validRaw(), identity);
	const second = buildWaiverAIDraft(validRaw(), identity);
	assert.ok(first.ok && second.ok);
	assert.notEqual(first.draft.fields[0].id, second.draft.fields[0].id);
});

test('prompt carries the inputs and tells the model not to duplicate built-in fields', () => {
	const prompt = buildWaiverAIPrompt({
		description: 'Bouldering gym',
		location: '',
		workspaceName: 'Acme Climbing'
	});
	assert.ok(prompt.includes('Business name: Acme Climbing'));
	assert.ok(prompt.includes('Location: Not provided'));
	assert.ok(prompt.includes('Do NOT add fields'));
});

test('gateway request uses the supplied schema name', () => {
	const request = buildAIGatewayRequest(
		'model',
		'prompt',
		{},
		{
			name: 'waiver_draft',
			description: 'Draft'
		}
	);
	assert.equal(request.response_format.json_schema.name, 'waiver_draft');
	assert.equal(
		buildAIGatewayRequest('model', 'prompt', {}).response_format.json_schema.name,
		'email_review'
	);
});
