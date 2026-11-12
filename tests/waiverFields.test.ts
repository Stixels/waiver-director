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

test('accepts every number form the browser number input allows', () => {
	for (const [raw, stored] of [
		['.5', '.5'],
		['1e2', '1e2'],
		['3.', '3.'],
		['+42', '+42'],
		['0.25e1', '0.25e1'],
		[' 7 ', '7']
	]) {
		const result = normalizeSubmissionAnswers(fields, { ...validAnswers, age: raw });
		assert.equal(result.ok, true, `${raw} should be accepted`);
		if (result.ok) assert.equal(result.answers.age, stored);
	}
	for (const raw of ['1e', '.', '1.2.3', 'Infinity', '0x10']) {
		const result = normalizeSubmissionAnswers(fields, { ...validAnswers, age: raw });
		assert.equal(result.ok, false, `${raw} should be rejected`);
	}
});

test('stores long numbers exactly as typed', () => {
	const result = normalizeSubmissionAnswers(
		[{ id: 'member', type: 'number', label: 'Member number', required: true }],
		{ member: '12345678901234567890' }
	);
	assert.equal(result.ok, true);
	if (result.ok) assert.equal(result.answers.member, '12345678901234567890');
});

test('rejects impossible calendar dates', () => {
	const dateFields: WaiverField[] = [
		{ id: 'visit', type: 'date', label: 'Visit date', required: true }
	];
	for (const raw of ['2024-02-31', '2023-02-29', '2024-13-01', '2024-00-10']) {
		const result = normalizeSubmissionAnswers(dateFields, { visit: raw });
		assert.equal(result.ok, false, `${raw} should be rejected`);
	}
	const leapDay = normalizeSubmissionAnswers(dateFields, { visit: '2024-02-29' });
	assert.equal(leapDay.ok, true);
});

test('stores initials in uppercase', () => {
	const result = normalizeSubmissionAnswers(
		[{ id: 'init', type: 'initials', label: 'Initials', required: true, clause: 'I agree.' }],
		{ init: 'jv' }
	);
	assert.equal(result.ok, true);
	if (result.ok) assert.equal(result.answers.init, 'JV');
});
