import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import {
	EMAIL_AI_ALLOWED_VARIABLES,
	EMAIL_AI_RUBRIC_KEYS,
	EMAIL_AI_RUBRIC_MAX,
	type EmailAIResult,
	type EmailAIRubric
} from '$lib/domain/email-ai';
import { sanitizeRichTextHtml } from '$lib/utils/rich-text';

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma4:e4b';
const OLLAMA_TIMEOUT_MS = 120_000;
const MAX_SUBJECT_LENGTH = 240;
const MAX_BODY_LENGTH = 20_000;
const MAX_GOAL_LENGTH = 240;
const MAX_LIST_ITEMS = 6;

type EmailAIRequest = {
	workspaceId: Id<'workspaces'>;
	subject: string;
	body: string;
	sendAfterAmount: number;
	sendAfterUnit: 'minutes' | 'hours' | 'days';
	workspaceName: string;
	goal: string;
};

type OllamaChatResponse = {
	message?: {
		content?: string;
	};
	response?: string;
};

type RawEmailAIResult = {
	score?: unknown;
	rubric?: unknown;
	issues?: unknown;
	suggestions?: unknown;
	proposedSubject?: unknown;
	proposedBody?: unknown;
	rationale?: unknown;
};

const variableTokenPattern = /\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g;

function errorResponse(message: string, status = 400) {
	return json({ message }, { status });
}

function isRequestBody(value: unknown): value is EmailAIRequest {
	if (!value || typeof value !== 'object') return false;
	const body = value as Partial<EmailAIRequest>;
	return (
		typeof body.workspaceId === 'string' &&
		typeof body.subject === 'string' &&
		typeof body.body === 'string' &&
		typeof body.workspaceName === 'string' &&
		typeof body.goal === 'string' &&
		typeof body.sendAfterAmount === 'number' &&
		['minutes', 'hours', 'days'].includes(String(body.sendAfterUnit))
	);
}

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
		.slice(0, MAX_LIST_ITEMS);
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
	// Models occasionally answer on a 0–100 scale; rescale those into the 0–10 rubric range.
	const normalized = value > EMAIL_AI_RUBRIC_MAX ? value / 10 : value;
	const rounded = Math.round(normalized);
	return Math.max(0, Math.min(EMAIL_AI_RUBRIC_MAX, rounded));
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

function parseModelJson(content: string): RawEmailAIResult | null {
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
			// Try the next candidate; validation still rejects malformed or incomplete objects.
		}
	}
	return null;
}

function validateAIResult(raw: RawEmailAIResult, source: { subject: string; body: string }) {
	const score = clampScore(raw.score);
	const rubric = validateRubric(raw.rubric);
	const proposedSubject = typeof raw.proposedSubject === 'string' ? raw.proposedSubject.trim() : '';
	const proposedBody =
		typeof raw.proposedBody === 'string' ? sanitizeRichTextHtml(raw.proposedBody) : '';
	const rationale = typeof raw.rationale === 'string' ? raw.rationale.trim() : '';
	const issues = parseStringList(raw.issues);
	const suggestions = parseStringList(raw.suggestions);

	if (score === null || !rubric) {
		return { ok: false as const, message: 'AI response did not include a valid score rubric.' };
	}
	if (!proposedSubject || proposedSubject.length > MAX_SUBJECT_LENGTH) {
		return { ok: false as const, message: 'AI response returned an invalid subject.' };
	}
	if (!proposedBody || proposedBody.length > MAX_BODY_LENGTH) {
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

function htmlToText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function buildPrompt(args: EmailAIRequest & { sanitizedBody: string }) {
	const allowedVariables = EMAIL_AI_ALLOWED_VARIABLES.map((variable) => `{{${variable}}}`).join(
		', '
	);
	return [
		'You are an email quality assistant for Waiver Director, a waiver operations SaaS.',
		'Rate and improve the provided email template for client-facing waiver, booking, reminder, thank-you, review, or informational emails.',
		'Default tone: friendly, professional, concise, useful, and personalized without sounding sales-heavy.',
		`Allowed variables: ${allowedVariables}. Preserve every variable already present in the original draft. Do not invent new variables.`,
		'Return only valid JSON. Do not wrap it in markdown.',
		'JSON shape: {"score": number 0-100, "rubric": {"clarity": number, "tone": number, "personalization": number, "usefulness": number, "variables": number, "cta": number, "deliverability": number}, "issues": string[], "suggestions": string[], "proposedSubject": string, "proposedBody": string, "rationale": string}.',
		'The overall "score" is 0-100. Every rubric criterion is an integer from 0 to 10.',
		'proposedBody must be safe, simple HTML using paragraphs, links, lists, bold, or italic only.',
		'Keep the message appropriate for the user goal and avoid spammy punctuation, all-caps, misleading urgency, or unverifiable claims.',
		'',
		`Workspace name: ${args.workspaceName}`,
		`Email goal: ${args.goal || 'Improve this operator email template.'}`,
		`Send delay: ${args.sendAfterAmount} ${args.sendAfterUnit} after booking`,
		`Current subject: ${args.subject}`,
		`Current body HTML: ${args.sanitizedBody}`,
		`Current body text: ${htmlToText(args.sanitizedBody)}`
	].join('\n');
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const auth = locals.auth();
	if (!auth.userId) {
		return errorResponse('Not authenticated.', 401);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorResponse('Request body must be valid JSON.');
	}

	if (!isRequestBody(body)) {
		return errorResponse('Request body is missing required email fields.');
	}

	const subject = body.subject.trim();
	const sanitizedBody = sanitizeRichTextHtml(body.body);
	const goal = body.goal.trim().slice(0, MAX_GOAL_LENGTH);
	const workspaceName = body.workspaceName.trim() || 'Your business';

	if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
		return errorResponse('Subject is required and must be shorter than 240 characters.');
	}
	if (!sanitizedBody || sanitizedBody.length > MAX_BODY_LENGTH) {
		return errorResponse('Email body is required and must be shorter than 20,000 characters.');
	}
	if (!Number.isInteger(body.sendAfterAmount) || body.sendAfterAmount < 1) {
		return errorResponse('Send delay must be a positive whole number.');
	}

	try {
		const membership = await locals.convex.query(api.workspaces.currentWorkspaceMembership, {
			workspaceId: body.workspaceId
		});
		if (!membership || membership.status !== 'active') {
			return errorResponse('You do not have access to this workspace.', 403);
		}
	} catch {
		return errorResponse('Unable to verify workspace access.', 403);
	}

	const ollamaBaseUrl = (env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, '');
	const model = env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

	try {
		const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				stream: false,
				format: 'json',
				messages: [
					{
						role: 'system',
						content:
							'You return strict JSON for an email template review tool. You never include markdown or prose outside JSON.'
					},
					{
						role: 'user',
						content: buildPrompt({
							...body,
							subject,
							workspaceName,
							goal,
							sanitizedBody
						})
					}
				],
				options: {
					temperature: 0.35
				}
			}),
			signal: controller.signal
		});

		if (!response.ok) {
			return errorResponse(`Ollama returned ${response.status}.`, 502);
		}

		const payload = (await response.json()) as OllamaChatResponse;
		const content = payload.message?.content ?? payload.response ?? '';
		const rawResult = parseModelJson(content);
		if (!rawResult) {
			return errorResponse('AI response was not valid JSON.', 502);
		}

		const result = validateAIResult(rawResult, { subject, body: sanitizedBody });
		if (!result.ok) {
			return errorResponse(result.message, 502);
		}

		return json(result.result);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return errorResponse('Ollama did not respond before the timeout.', 504);
		}
		return errorResponse('Unable to reach Ollama.', 502);
	} finally {
		clearTimeout(timeout);
	}
};
