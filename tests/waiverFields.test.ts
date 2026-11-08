import assert from 'node:assert/strict';
import test from 'node:test';
import {
	formatAnswerDisplay,
	isValidPhone,
	normalizeSubmissionAnswers,
	type WaiverField
} from '../src/lib/domain/waiver-fields.ts';

const medical: WaiverField = {
	id: 'medical',
	type: 'select',
	label: 'Any medical conditions?',
	required: true,
	options: [
		{ id: 'yes', label: 'Yes', flagged: true },
		{ id: 'no', label: 'No' }
	]
};

const fields: WaiverField[] = [
	medical,
	{ id: 'phone', type: 'phone', label: 'Phone', required: true },
	{ id: 'age', type: 'number', label: 'Age', required: false, min: 0, max: 120 },
	{
		id: 'diet',
		type: 'multiselect',
		label: 'Allergies',
		required: false,
		options: [
			{ id: 'nuts', label: 'Nuts', flagged: true },
			{ id: 'dairy', label: 'Dairy' }
		]
	},
	{ id: 'home', type: 'address', label: 'Address', required: false },
	{ id: 'ec', type: 'emergency_contact', label: 'Emergency contact', required: true },
	{ id: 'risk', type: 'initials', label: 'Risk', required: true, clause: 'I accept the risks.' },
	{ id: 'pregnant', type: 'checkbox', label: 'Pregnant', required: false, flagWhenChecked: true }
];

const validAnswers = {
	medical: 'no',
	phone: '+1 (555) 123-4567',
	age: '34',
	diet: ['dairy'],
	home: { line1: ' 1 Main St ', city: 'Austin', country: '' },
	ec: { name: 'Sam', phone: '555 987 6543', relationship: 'Sibling' },
	risk: 'jv',
	pregnant: false
};

test('normalizes valid answers and drops unknown keys', () => {
	const result = normalizeSubmissionAnswers(fields, { ...validAnswers, injected: 'nope' });
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal('injected' in result.answers, false);
	assert.deepEqual(result.answers.home, { line1: '1 Main St', city: 'Austin' });
	assert.deepEqual(result.flaggedFieldIds, []);
});

test('flags select, multiselect, and checkbox answers configured to flag', () => {
	const result = normalizeSubmissionAnswers(fields, {
		...validAnswers,
		medical: 'yes',
		diet: ['nuts', 'dairy'],
		pregnant: true
	});
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.deepEqual(result.flaggedFieldIds, ['medical', 'diet', 'pregnant']);
});

test('rejects invalid phone, number range, and unknown options', () => {
	const cases: Array<[string, unknown]> = [
		['phone', '12'],
		['age', '200'],
		['age', 'abc'],
		['diet', ['nuts', 'gluten']],
		['medical', 'maybe'],
		['risk', '1234567'],
		['ec', { name: 'Sam', phone: '' }]
	];
	for (const [fieldId, value] of cases) {
		const result = normalizeSubmissionAnswers(fields, {
			...validAnswers,
			[fieldId]: value
		} as never);
		assert.equal(result.ok, false, `${fieldId}=${JSON.stringify(value)} should fail`);
		if (!result.ok) assert.equal(result.fieldId, fieldId);
	}
});

test('requires initials and at least one multiselect option when required', () => {
	const required: WaiverField[] = [
		{
			id: 'pick',
			type: 'multiselect',
			label: 'Pick',
			required: true,
			options: [{ id: 'a', label: 'A' }]
		}
	];
	assert.equal(normalizeSubmissionAnswers(required, { pick: [] }).ok, false);
	assert.equal(normalizeSubmissionAnswers(fields, { ...validAnswers, risk: '' }).ok, false);
});

test('phone validation counts digits', () => {
	assert.equal(isValidPhone('555-1234'), true);
	assert.equal(isValidPhone('call me'), false);
	assert.equal(isValidPhone('+1234567890123456'), false);
});

test('formats composite and multi-select answers for display', () => {
	assert.equal(formatAnswerDisplay(fields[3], ['nuts', 'dairy']), 'Nuts, Dairy');
	assert.equal(
		formatAnswerDisplay(fields[4], { line1: '1 Main St', city: 'Austin', region: 'TX' }),
		'1 Main St\nAustin, TX'
	);
	assert.equal(
		formatAnswerDisplay(fields[5], { name: 'Sam', phone: '555', relationship: 'Sibling' }),
		'Sam (Sibling)\n555'
	);
});
