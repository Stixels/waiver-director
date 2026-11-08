import assert from 'node:assert/strict';
import test from 'node:test';
import {
	canonicalizeAnswers,
	describeCondition,
	findFirstConditionProblem,
	getConditionProblem,
	getVisibleFieldIds,
	pruneHiddenAnswers
} from '../src/lib/domain/waiver-conditions.ts';

const fields = [
	{ id: 'has-medical', type: 'checkbox', label: 'I have a medical condition' },
	{
		id: 'medical-details',
		type: 'text',
		label: 'Describe your condition',
		visibleWhen: { fieldId: 'has-medical', operator: 'equals' as const, value: true }
	},
	{
		id: 'experience',
		type: 'select',
		label: 'Experience level',
		options: [
			{ id: 'new', label: 'First time' },
			{ id: 'pro', label: 'Experienced' }
		]
	},
	{
		id: 'orientation',
		type: 'checkbox',
		label: 'I will attend the safety orientation',
		visibleWhen: { fieldId: 'experience', operator: 'not_equals' as const, value: 'pro' }
	},
	{
		id: 'orientation-time',
		type: 'text',
		label: 'Preferred orientation time',
		visibleWhen: { fieldId: 'orientation', operator: 'equals' as const, value: true }
	}
];

test('shows conditional fields only when their condition is met', () => {
	assert.deepEqual(
		[...getVisibleFieldIds(fields, {})],
		['has-medical', 'experience', 'orientation']
	);
	assert.ok(getVisibleFieldIds(fields, { 'has-medical': true }).has('medical-details'));
	assert.ok(!getVisibleFieldIds(fields, { 'has-medical': false }).has('medical-details'));
	assert.ok(!getVisibleFieldIds(fields, { experience: 'pro' }).has('orientation'));
	assert.ok(getVisibleFieldIds(fields, { experience: 'new' }).has('orientation'));
});

test('hides a field when the field it depends on is hidden', () => {
	const visible = getVisibleFieldIds(fields, { experience: 'pro', orientation: true });
	assert.ok(!visible.has('orientation'));
	assert.ok(!visible.has('orientation-time'));
});

test('matches option answers stored as arrays (multi-select)', () => {
	const multi = [
		{
			id: 'activities',
			type: 'multiselect',
			label: 'Activities',
			options: [{ id: 'zip', label: 'Zip' }]
		},
		{
			id: 'harness',
			type: 'text',
			label: 'Harness size',
			visibleWhen: { fieldId: 'activities', operator: 'equals' as const, value: 'zip' }
		}
	];
	assert.ok(getVisibleFieldIds(multi, { activities: ['zip'] }).has('harness'));
	assert.ok(!getVisibleFieldIds(multi, { activities: [] }).has('harness'));
});

test('drops answers for hidden fields', () => {
	assert.deepEqual(
		pruneHiddenAnswers(fields, {
			'has-medical': false,
			'medical-details': 'stale text',
			experience: 'pro',
			orientation: true,
			'orientation-time': '9am'
		}),
		{ 'has-medical': false, experience: 'pro' }
	);
});

test('rejects conditions that point forward, at themselves, or at missing values', () => {
	assert.equal(findFirstConditionProblem(fields), null);

	const forward = [fields[1]!, fields[0]!];
	assert.match(getConditionProblem(forward, 0) ?? '', /must come after/);

	const self = [
		{
			...fields[0]!,
			visibleWhen: { fieldId: 'has-medical', operator: 'equals' as const, value: true }
		}
	];
	assert.match(getConditionProblem(self, 0) ?? '', /must come after/);

	const missingOption = [
		fields[2]!,
		{
			...fields[3]!,
			visibleWhen: { fieldId: 'experience', operator: 'equals' as const, value: 'gone' }
		}
	];
	assert.match(getConditionProblem(missingOption, 1) ?? '', /option that no longer exists/);

	const wrongValueType = [
		fields[0]!,
		{
			...fields[1]!,
			visibleWhen: { fieldId: 'has-medical', operator: 'equals' as const, value: 'yes' }
		}
	];
	assert.match(getConditionProblem(wrongValueType, 1) ?? '', /checked or unchecked/);

	const textSource = [
		fields[1]!,
		{
			...fields[4]!,
			visibleWhen: { fieldId: 'medical-details', operator: 'equals' as const, value: 'x' }
		}
	];
	assert.match(getConditionProblem(textSource, 1) ?? '', /checkbox or dropdown/);

	assert.match(getConditionProblem([fields[1]!], 0) ?? '', /no longer exists/);
});

test('describes conditions for previews', () => {
	assert.equal(
		describeCondition(fields, fields[1]!.visibleWhen!),
		'Shown when "I have a medical condition" is checked'
	);
	assert.equal(
		describeCondition(fields, fields[3]!.visibleWhen!),
		'Shown when "Experience level" is not Experienced'
	);
});

test('trims answers before evaluating conditions so padded values cannot hide required fields', () => {
	const answers = canonicalizeAnswers(fields, { experience: ' new ', unknown: ' keep ' });
	assert.deepEqual(answers, { experience: 'new', unknown: ' keep ' });
	assert.ok(getVisibleFieldIds(fields, answers).has('orientation'));

	const padded = canonicalizeAnswers(fields, { experience: ' pro' });
	assert.ok(!getVisibleFieldIds(fields, padded).has('orientation'));
});
