import assert from 'node:assert/strict';
import test from 'node:test';
import {
	parseEmailAIModelJson,
	validateEmailAIResult,
	type RawEmailAIResult
} from '../src/lib/domain/email-ai-validation.ts';
import {
	buildAIGatewayRequest,
	extractAIGatewayText,
	getAIGatewayFailure
} from '../src/lib/server/email-ai-gateway.ts';

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

test('rejects out-of-range rubric scores and rounds in-range scores', () => {
	for (const clarity of [-0.1, 10.1, 80]) {
		const validation = validateEmailAIResult(
			validResult({ rubric: { ...validRubric, clarity } }),
			source,
			(body) => body
		);
		assert.equal(validation.ok, false);
	}

	const validation = validateEmailAIResult(
		validResult({ rubric: { ...validRubric, clarity: 8.6 } }),
		source,
		(body) => body
	);
	assert.equal(validation.ok, true);
	if (!validation.ok) return;
	assert.equal(validation.result.rubric.clarity, 9);
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

test('recognizes only double-braced variables while preserving inner whitespace', () => {
	const singleBraced = validateEmailAIResult(
		validResult({ proposedBody: '<p>Hello {{customer_name}} on {booking_date}</p>' }),
		source,
		(body) => body
	);
	assert.equal(singleBraced.ok, true);

	const doubleBraced = validateEmailAIResult(
		validResult({ proposedBody: '<p>Hello {{customer_name}} on {{ booking_date }}</p>' }),
		source,
		(body) => body
	);
	assert.equal(doubleBraced.ok, false);
	if (doubleBraced.ok) return;
	assert.match(doubleBraced.message, /unsupported variables: booking_date/);
});

test('validates the sanitized body rather than raw model HTML', () => {
	const validation = validateEmailAIResult(validResult(), source, () => '');

	assert.equal(validation.ok, false);
	if (validation.ok) return;
	assert.equal(validation.message, 'AI response returned an invalid body.');
});

test('builds a provider-neutral AI Gateway structured-output request', () => {
	const schema = { type: 'object', properties: { score: { type: 'integer' } } };
	const request = buildAIGatewayRequest('anthropic/claude-sonnet-4.6', 'Review this.', schema);

	assert.equal(request.model, 'anthropic/claude-sonnet-4.6');
	assert.deepEqual(request.messages, [{ role: 'user', content: 'Review this.' }]);
	assert.equal(request.stream, false);
	assert.equal(request.response_format.type, 'json_schema');
	assert.equal(request.response_format.json_schema.name, 'email_review');
	assert.equal(request.response_format.json_schema.schema, schema);
	assert.equal(request.providerOptions.gateway.disallowPromptTraining, true);
});

test('extracts text from AI Gateway chat completion responses', () => {
	assert.equal(
		extractAIGatewayText({ choices: [{ message: { content: '{"score":82}' } }] }),
		'{"score":82}'
	);
	assert.equal(
		extractAIGatewayText({
			choices: [
				{
					message: {
						content: [
							{ type: 'text', text: '{"score":' },
							{ type: 'text', text: '82}' }
						]
					}
				}
			]
		}),
		'{"score":82}'
	);
	assert.equal(extractAIGatewayText({}), '');
});

test('maps AI Gateway failures to safe application errors', () => {
	assert.deepEqual(getAIGatewayFailure(401), {
		message: 'AI Gateway authentication failed. Check AI_GATEWAY_API_KEY.',
		status: 502
	});
	assert.deepEqual(getAIGatewayFailure(402), {
		message: 'AI Gateway credits are currently exhausted.',
		status: 503
	});
	assert.deepEqual(getAIGatewayFailure(404), {
		message: 'The configured AI Gateway model is unavailable. Check AI_GATEWAY_MODEL.',
		status: 502
	});
	assert.deepEqual(getAIGatewayFailure(429), {
		message: 'AI Gateway quota is currently exhausted.',
		status: 429
	});
	assert.deepEqual(getAIGatewayFailure(500), {
		message: 'AI Gateway returned 500.',
		status: 502
	});
});
