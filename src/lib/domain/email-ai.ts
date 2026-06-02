export const EMAIL_AI_ALLOWED_VARIABLES = [
	'customer_name',
	'booking_id',
	'business_name',
	'activity_date'
] as const;

/** Each rubric criterion is scored on a 0–10 scale (the overall `score` is 0–100). */
export const EMAIL_AI_RUBRIC_MAX = 10;

export const EMAIL_AI_RUBRIC_KEYS = [
	'clarity',
	'tone',
	'personalization',
	'usefulness',
	'variables',
	'cta',
	'deliverability'
] as const;

export type EmailAIRubricKey = (typeof EMAIL_AI_RUBRIC_KEYS)[number];

export type EmailAIRubric = Record<EmailAIRubricKey, number>;

export type EmailAIResult = {
	score: number;
	rubric: EmailAIRubric;
	issues: string[];
	suggestions: string[];
	proposedSubject: string;
	proposedBody: string;
	rationale: string;
};

export const EMAIL_AI_RUBRIC_LABELS: Record<EmailAIRubricKey, string> = {
	clarity: 'Clarity',
	tone: 'Tone',
	personalization: 'Personalization',
	usefulness: 'Usefulness',
	variables: 'Variables',
	cta: 'Call to action',
	deliverability: 'Deliverability'
};
