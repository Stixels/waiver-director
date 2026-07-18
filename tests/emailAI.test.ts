import assert from 'node:assert/strict';
import test from 'node:test';
import {
	parseEmailAIModelJson,
	validateEmailAIResult,
	type RawEmailAIResult
} from '../src/lib/domain/email-ai-validation.ts';

const validRubric = {
	clarity: 8,
	tone: 8,
	personalization: 8,
	usefulness: 8,
	variables: 8,
	cta: 8,
	deliverability: 8
};

function validResult(overrides: Partial<RawEmailAIResult> = {}): RawEmailAIResult {
	return {
		score: 82,
		rubric: validRubric,
		issues: ['Needs a clearer call to action.'],
		suggestions: ['Make the next step explicit.'],
		proposedSubject: 'Your waiver for {{business_name}}',
		proposedBody: '<p>Hello {{customer_name}}, please complete your waiver.</p>',
		rationale: 'The proposal is shorter and more direct.',
		...overrides
	};
}

const source = {
	subject: 'A note from {{business_name}}',
	body: '<p>Hello {{customer_name}}</p>'
};

test('parses strict and fenced model JSON', () => {
	assert.deepEqual(parseEmailAIModelJson('{"score":82}'), { score: 82 });
	assert.deepEqual(parseEmailAIModelJson('```json\n{"score":82}\n```'), { score: 82 });
	assert.equal(parseEmailAIModelJson('not json'), null);
});

test('accepts a valid proposal and preserves supported variables', () => {
	const validation = validateEmailAIResult(validResult(), source, (body) => body);

	assert.equal(validation.ok, true);
	if (!validation.ok) return;
	assert.equal(validation.result.score, 82);
	assert.equal(validation.result.proposedSubject, 'Your waiver for {{business_name}}');
});

test('rejects proposals that remove original variables', () => {
	const validation = validateEmailAIResult(
		validResult({ proposedBody: '<p>Hello there, please complete your waiver.</p>' }),
		source,
		(body) => body
	);

	assert.equal(validation.ok, false);
	if (validation.ok) return;
	assert.match(validation.message, /removed existing variables: customer_name/);
});

test('rejects proposals that introduce unsupported variables', () => {
	const validation = validateEmailAIResult(
		validResult({ proposedBody: '<p>Hello {{customer_name}} on {{booking_date}}</p>' }),
		source,
		(body) => body
	);

	assert.equal(validation.ok, false);
	if (validation.ok) return;
	assert.match(validation.message, /unsupported variables: booking_date/);
});

test('validates the sanitized body rather than raw model HTML', () => {
	const validation = validateEmailAIResult(validResult(), source, () => '');

	assert.equal(validation.ok, false);
	if (validation.ok) return;
	assert.equal(validation.message, 'AI response returned an invalid body.');
});
