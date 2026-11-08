import type { WaiverDefinition, WaiverField } from './waivers';

/**
 * Starter waiver templates for common activities.
 *
 * Templates are starting points only. They are not legal advice and are not
 * reviewed for any jurisdiction; the builder tells owners to have their own
 * counsel review the wording before publishing. Applying a template only
 * replaces the editable draft; nothing is published until the owner publishes.
 */

export const WAIVER_TEMPLATE_LEGAL_NOTICE =
	'Templates are a starting point, not legal advice. Laws differ by location and activity, so have a qualified lawyer review your waiver before you publish it.';

export const BUSINESS_NAME_TOKEN = '{{business}}';
const DEFAULT_BUSINESS_NAME = 'our business';

export type WaiverTemplateId = 'climbing' | 'watersports' | 'guided-tours' | 'fitness';

type TemplateField =
	| { key: string; type: 'text'; label: string; required: boolean; placeholder?: string }
	| { key: string; type: 'checkbox'; label: string; required: boolean }
	| { key: string; type: 'date'; label: string; required: boolean }
	| {
			key: string;
			type: 'select';
			label: string;
			required: boolean;
			options: string[];
	  };

export type WaiverTemplate = {
	id: WaiverTemplateId;
	name: string;
	activities: string;
	description: string;
	title: string;
	introCopy: string;
	fields: TemplateField[];
};

const emergencyContactFields: TemplateField[] = [
	{
		key: 'emergency-name',
		type: 'text',
		label: 'Emergency contact name',
		required: true,
		placeholder: 'Full name'
	},
	{
		key: 'emergency-phone',
		type: 'text',
		label: 'Emergency contact phone',
		required: true,
		placeholder: 'Phone number'
	}
];

const medicalFields: TemplateField[] = [
	{
		key: 'medical-notes',
		type: 'text',
		label: 'Medical conditions, injuries or allergies we should know about',
		required: false,
		placeholder: 'Leave blank if none'
	}
];

const photoReleaseField: TemplateField = {
	key: 'photo-release',
	type: 'checkbox',
	label: 'I allow photos or video of me taken during the activity to be used for marketing',
	required: false
};

const releaseSection = `<h3>Release of liability</h3>
<p>In consideration of being allowed to participate, I, on behalf of myself and any minors listed on this waiver, release ${BUSINESS_NAME_TOKEN}, its owners, staff, and agents from claims arising from my participation, to the fullest extent permitted by law. This release does not apply to gross negligence or intentional misconduct where the law does not allow it.</p>
<h3>Medical treatment</h3>
<p>I authorize ${BUSINESS_NAME_TOKEN} staff to seek emergency medical treatment for me if I am unable to consent, and I accept responsibility for the cost of that treatment.</p>
<h3>Minors</h3>
<p>If I am signing for a minor, I confirm I am their parent or legal guardian and agree to these terms on their behalf.</p>
<p>I have read this agreement, understand it, and sign it voluntarily.</p>`;

export const waiverTemplates: WaiverTemplate[] = [
	{
		id: 'climbing',
		name: 'Climbing and bouldering',
		activities: 'Climbing gyms, bouldering, ropes courses',
		description: 'Covers falls, belaying, equipment checks and gym rules.',
		title: 'Climbing Release and Waiver of Liability',
		introCopy: `<p>Please read this agreement carefully before climbing at ${BUSINESS_NAME_TOKEN}.</p>
<h3>Assumption of risk</h3>
<p>I understand that climbing, bouldering, and related activities carry inherent risks, including:</p>
<ul>
<li>Falls, including falls onto mats, walls, holds, or other climbers</li>
<li>Equipment failure or improper use of harnesses, ropes, and belay devices</li>
<li>Holds that spin, break, or come loose</li>
<li>Strains, sprains, fractures, and other serious injury</li>
</ul>
<h3>Rules and supervision</h3>
<p>I agree to follow posted rules and staff instructions, to belay only if I have passed a belay check, and to check my own knots and equipment before every climb.</p>
${releaseSection}`,
		fields: [
			...emergencyContactFields,
			{
				key: 'experience',
				type: 'select',
				label: 'Climbing experience',
				required: true,
				options: ['First time', 'Beginner', 'Intermediate', 'Advanced']
			},
			{
				key: 'belay-certified',
				type: 'checkbox',
				label: 'I have passed a belay check at this facility',
				required: false
			},
			...medicalFields,
			{
				key: 'rules-ack',
				type: 'checkbox',
				label: 'I have read and will follow the facility rules',
				required: true
			},
			photoReleaseField
		]
	},
	{
		id: 'watersports',
		name: 'Watersports and rentals',
		activities: 'Kayak, paddleboard, surf, boat and snorkel',
		description: 'Covers drowning risk, weather, swimming ability and life jackets.',
		title: 'Watersports Release and Waiver of Liability',
		introCopy: `<p>Please read this agreement carefully before taking part in any water activity or renting equipment from ${BUSINESS_NAME_TOKEN}.</p>
<h3>Assumption of risk</h3>
<p>I understand that water activities carry inherent risks, including:</p>
<ul>
<li>Drowning, capsizing, and being separated from equipment</li>
<li>Changing weather, currents, tides, waves, and water temperature</li>
<li>Collisions with other people, vessels, rocks, or marine life</li>
<li>Hypothermia, sunburn, dehydration, and exhaustion</li>
</ul>
<h3>Safety and equipment</h3>
<p>I agree to wear a properly fitted life jacket when required, stay within the areas staff describe, return equipment on time and in the condition I received it, and not participate under the influence of alcohol or drugs. I accept responsibility for loss of or damage to rented equipment beyond normal wear.</p>
${releaseSection}`,
		fields: [
			...emergencyContactFields,
			{
				key: 'swim-ability',
				type: 'select',
				label: 'Swimming ability',
				required: true,
				options: ['Cannot swim', 'Weak swimmer', 'Confident swimmer', 'Strong swimmer']
			},
			{
				key: 'experience',
				type: 'select',
				label: 'Experience with this activity',
				required: true,
				options: ['First time', 'Some experience', 'Experienced']
			},
			...medicalFields,
			{
				key: 'life-jacket-ack',
				type: 'checkbox',
				label: 'I will wear a life jacket whenever staff require it',
				required: true
			},
			photoReleaseField
		]
	},
	{
		id: 'guided-tours',
		name: 'Guided tours',
		activities: 'Hiking, bike, ATV, walking and sightseeing tours',
		description: 'Covers terrain, transport, fitness level and following the guide.',
		title: 'Tour Participant Release and Waiver of Liability',
		introCopy: `<p>Please read this agreement carefully before joining a tour with ${BUSINESS_NAME_TOKEN}.</p>
<h3>Assumption of risk</h3>
<p>I understand that tours carry inherent risks, including:</p>
<ul>
<li>Uneven or slippery terrain, trips, and falls</li>
<li>Travel in vehicles, on bikes, or on other equipment</li>
<li>Weather, wildlife, insects, and plants</li>
<li>Remote locations where emergency help may be delayed</li>
</ul>
<h3>Following the guide</h3>
<p>I agree to follow my guide's instructions, stay with the group, tell the guide about any health concerns before the tour starts, and understand that the guide may change or end the tour for safety reasons.</p>
${releaseSection}`,
		fields: [
			...emergencyContactFields,
			{
				key: 'fitness',
				type: 'select',
				label: 'Fitness level',
				required: true,
				options: ['Low', 'Moderate', 'High']
			},
			...medicalFields,
			{
				key: 'guide-ack',
				type: 'checkbox',
				label: 'I will follow the guide and stay with the group',
				required: true
			},
			photoReleaseField
		]
	},
	{
		id: 'fitness',
		name: 'Fitness and general activity',
		activities: 'Classes, trampoline parks, studios, camps',
		description: 'A general-purpose release for physical activities.',
		title: 'Activity Release and Waiver of Liability',
		introCopy: `<p>Please read this agreement carefully before taking part in activities at ${BUSINESS_NAME_TOKEN}.</p>
<h3>Assumption of risk</h3>
<p>I understand that physical activity carries inherent risks, including strains, sprains, fractures, collisions with other participants, and in rare cases serious injury. I confirm I am in suitable health to take part and will stop and tell staff if I feel unwell.</p>
<h3>Rules</h3>
<p>I agree to follow posted rules and staff instructions and to use equipment only as directed.</p>
${releaseSection}`,
		fields: [
			...emergencyContactFields,
			...medicalFields,
			{
				key: 'health-ack',
				type: 'checkbox',
				label: 'I am in good health and able to take part',
				required: true
			},
			photoReleaseField
		]
	}
];

export function getWaiverTemplate(id: string): WaiverTemplate | null {
	return waiverTemplates.find((template) => template.id === id) ?? null;
}

function escapeHtmlText(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function randomSuffix(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID().slice(0, 8)
		: Math.random().toString(36).slice(2, 10);
}

function templateFieldId(templateId: string, key: string, suffix: string): string {
	return `${templateId}-${key}-${suffix}`
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.slice(0, 48);
}

/**
 * Builds a fresh waiver definition from a template. Field and option ids get
 * a new random suffix on each call so a re-applied template never collides
 * with ids from an earlier draft or published version.
 */
export function buildDefinitionFromTemplate(
	template: WaiverTemplate,
	options: { businessName?: string | null; theme?: WaiverDefinition['theme'] } = {}
): WaiverDefinition {
	const businessName = options.businessName?.trim() || DEFAULT_BUSINESS_NAME;
	const suffix = randomSuffix();

	const fields: WaiverField[] = template.fields.map((field) => {
		const id = templateFieldId(template.id, field.key, suffix);
		switch (field.type) {
			case 'text':
				return {
					id,
					type: 'text',
					label: field.label,
					required: field.required,
					placeholder: field.placeholder ?? ''
				};
			case 'checkbox':
			case 'date':
				return { id, type: field.type, label: field.label, required: field.required };
			case 'select':
				return {
					id,
					type: 'select',
					label: field.label,
					required: field.required,
					options: field.options.map((label, index) => ({
						id: templateFieldId(`${field.key}-${index + 1}`, label, suffix),
						label
					}))
				};
		}
	});

	return {
		title: template.title,
		introCopy: template.introCopy
			.split(BUSINESS_NAME_TOKEN)
			.join(escapeHtmlText(businessName))
			.replace(/>\s*\n\s*</g, '><'),
		fields,
		theme: options.theme ?? 'dark'
	};
}

/** True when the draft has content an owner would lose by applying a template. */
export function draftHasContent(definition: WaiverDefinition | null): boolean {
	if (!definition) return false;
	if (definition.fields.length > 0) return true;
	const text = definition.introCopy
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.trim();
	return text.length > 0;
}
