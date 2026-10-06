import {
	EMAIL_AI_ALLOWED_VARIABLES,
	EMAIL_AI_RUBRIC_KEYS,
	EMAIL_AI_RUBRIC_MAX,
	type EmailAIResult,
	type EmailAIRubric
} from './email-ai.ts';

export const EMAIL_AI_MAX_SUBJECT_LENGTH = 240;
export const EMAIL_AI_MAX_BODY_LENGTH = 20_000;
export const EMAIL_AI_MAX_LIST_ITEMS = 6;

export type RawEmailAIResult = {
	score?: unknown;
	rubric?: unknown;
	issues?: unknown;
	suggestions?: unknown;
	proposedSubject?: unknown;
	proposedBody?: unknown;
	rationale?: unknown;
};

const variableTokenPattern = /(?<!\{)\{\{\s*([a-zA-Z0-9_]+)\s*\}\}(?!\})/g;

function clampScore(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const rounded = Math.round(value);
	if (rounded < 0 || rounded > 100) return null;
	return rounded;
}

function parseStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, EMAIL_AI_MAX_LIST_ITEMS);
}

function extractVariables(value: string): Set<string> {
	const variables = new Set<string>();
	for (const match of value.matchAll(variableTokenPattern)) {
		const variableName = match[1];
		if (variableName) variables.add(variableName);
	}
	return variables;
}

function unsupportedVariables(value: string): string[] {
	const allowed = new Set<string>(EMAIL_AI_ALLOWED_VARIABLES);
	return [...extractVariables(value)].filter((variable) => !allowed.has(variable));
}

function missingOriginalVariables(source: string, proposed: string): string[] {
	const original = extractVariables(source);
	const next = extractVariables(proposed);
	return [...original].filter((variable) => !next.has(variable));
}

function clampRubricScore(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	if (value < 0 || value > EMAIL_AI_RUBRIC_MAX) return null;
	return Math.round(value);
}

function validateRubric(value: unknown): EmailAIRubric | null {
	if (!value || typeof value !== 'object') return null;
	const source = value as Record<string, unknown>;
	const rubric = {} as EmailAIRubric;
	for (const key of EMAIL_AI_RUBRIC_KEYS) {
		const score = clampRubricScore(source[key]);
		if (score === null) return null;
		rubric[key] = score;
	}
	return rubric;
}

export function parseEmailAIModelJson(content: string): RawEmailAIResult | null {
	const trimmed = content.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim();
	const primaryCandidate = fenced ?? trimmed;
	const candidates = [primaryCandidate];
	const objectStart = primaryCandidate.indexOf('{');
	const objectEnd = primaryCandidate.lastIndexOf('}');
	if (objectStart >= 0 && objectEnd > objectStart) {
		candidates.push(primaryCandidate.slice(objectStart, objectEnd + 1));
	}

	for (const candidate of candidates) {
		try {
			const parsed = JSON.parse(candidate) as unknown;
			if (parsed && typeof parsed === 'object') return parsed as RawEmailAIResult;
		} catch {
			// Try the next candidate; semantic validation still rejects incomplete objects.
		}
	}
	return null;
}

export function validateEmailAIResult(
	raw: RawEmailAIResult,
	source: { subject: string; body: string },
	sanitizeBody: (body: string) => string
) {
	const score = clampScore(raw.score);
	const rubric = validateRubric(raw.rubric);
	const proposedSubject = typeof raw.proposedSubject === 'string' ? raw.proposedSubject.trim() : '';
	const proposedBody = typeof raw.proposedBody === 'string' ? sanitizeBody(raw.proposedBody) : '';
	const rationale = typeof raw.rationale === 'string' ? raw.rationale.trim() : '';
	const issues = parseStringList(raw.issues);
	const suggestions = parseStringList(raw.suggestions);

	if (score === null || !rubric) {
		return { ok: false as const, message: 'AI response did not include a valid score rubric.' };
	}
	if (!proposedSubject || proposedSubject.length > EMAIL_AI_MAX_SUBJECT_LENGTH) {
		return { ok: false as const, message: 'AI response returned an invalid subject.' };
	}
	if (!proposedBody || proposedBody.length > EMAIL_AI_MAX_BODY_LENGTH) {
		return { ok: false as const, message: 'AI response returned an invalid body.' };
	}

	const unsupported = unsupportedVariables(`${proposedSubject}\n${proposedBody}`);
	if (unsupported.length > 0) {
		return {
			ok: false as const,
			message: `AI response used unsupported variables: ${unsupported.join(', ')}.`
		};
	}
	const missing = missingOriginalVariables(
		`${source.subject}\n${source.body}`,
		`${proposedSubject}\n${proposedBody}`
	);
	if (missing.length > 0) {
		return {
			ok: false as const,
			message: `AI response removed existing variables: ${missing.join(', ')}.`
		};
	}

	return {
		ok: true as const,
		result: {
			score,
			rubric,
			issues,
			suggestions,
			proposedSubject,
			proposedBody,
			rationale
		} satisfies EmailAIResult
	};
}
