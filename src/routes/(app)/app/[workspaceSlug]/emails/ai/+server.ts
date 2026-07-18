import { json, type RequestHandler } from '@sveltejs/kit';
import { ConvexError } from 'convex/values';
import { env } from '$env/dynamic/private';
import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import {
	EMAIL_AI_ALLOWED_VARIABLES,
	EMAIL_AI_RUBRIC_KEYS,
	EMAIL_AI_RUBRIC_MAX
} from '$lib/domain/email-ai';
import {
	EMAIL_AI_MAX_BODY_LENGTH,
	EMAIL_AI_MAX_LIST_ITEMS,
	EMAIL_AI_MAX_SUBJECT_LENGTH,
	parseEmailAIModelJson,
	validateEmailAIResult
} from '$lib/domain/email-ai-validation';
import { sanitizeRichTextHtml } from '$lib/utils/rich-text';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_TIMEOUT_MS = 120_000;
const MAX_GOAL_LENGTH = 240;

type EmailAIRequest = {
	workspaceId: Id<'workspaces'>;
	subject: string;
	body: string;
	sendAfterAmount: number;
	sendAfterUnit: 'minutes' | 'hours' | 'days';
	goal: string;
};

type GeminiInteractionResponse = {
	output_text?: string;
	steps?: Array<{
		type?: string;
		content?: Array<{
			type?: string;
			text?: string;
		}>;
	}>;
};

const emailAIResponseSchema = {
	type: 'object',
	properties: {
		score: { type: 'integer', minimum: 0, maximum: 100 },
		rubric: {
			type: 'object',
			properties: Object.fromEntries(
				EMAIL_AI_RUBRIC_KEYS.map((key) => [
					key,
					{ type: 'integer', minimum: 0, maximum: EMAIL_AI_RUBRIC_MAX }
				])
			),
			required: [...EMAIL_AI_RUBRIC_KEYS],
			additionalProperties: false
		},
		issues: {
			type: 'array',
			items: { type: 'string' },
			maxItems: EMAIL_AI_MAX_LIST_ITEMS
		},
		suggestions: {
			type: 'array',
			items: { type: 'string' },
			maxItems: EMAIL_AI_MAX_LIST_ITEMS
		},
		proposedSubject: { type: 'string' },
		proposedBody: { type: 'string' },
		rationale: { type: 'string' }
	},
	required: [
		'score',
		'rubric',
		'issues',
		'suggestions',
		'proposedSubject',
		'proposedBody',
		'rationale'
	],
	additionalProperties: false
} as const;

function errorResponse(message: string, status = 400, headers?: Record<string, string>) {
	return json({ message }, { status, headers });
}

function isConvexAccessError(error: unknown) {
	if (!(error instanceof ConvexError) || !error.data || typeof error.data !== 'object') {
		return false;
	}
	if (!('code' in error.data)) return false;
	return error.data.code === 'unauthenticated' || error.data.code === 'forbidden';
}

function isRequestBody(value: unknown): value is EmailAIRequest {
	if (!value || typeof value !== 'object') return false;
	const body = value as Partial<EmailAIRequest>;
	return (
		typeof body.workspaceId === 'string' &&
		typeof body.subject === 'string' &&
		typeof body.body === 'string' &&
		typeof body.goal === 'string' &&
		typeof body.sendAfterAmount === 'number' &&
		['minutes', 'hours', 'days'].includes(String(body.sendAfterUnit))
	);
}

function extractGeminiText(payload: GeminiInteractionResponse): string {
	if (typeof payload.output_text === 'string') return payload.output_text;

	for (const step of [...(payload.steps ?? [])].reverse()) {
		if (step.type !== 'model_output') continue;
		for (const content of [...(step.content ?? [])].reverse()) {
			if (content.type === 'text' && typeof content.text === 'string') return content.text;
		}
	}

	return '';
}

function htmlToText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function buildPrompt(args: EmailAIRequest & { sanitizedBody: string; workspaceName: string }) {
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

	if (!subject || subject.length > EMAIL_AI_MAX_SUBJECT_LENGTH) {
		return errorResponse('Subject is required and must be shorter than 240 characters.');
	}
	if (!sanitizedBody || sanitizedBody.length > EMAIL_AI_MAX_BODY_LENGTH) {
		return errorResponse('Email body is required and must be shorter than 20,000 characters.');
	}
	if (!Number.isInteger(body.sendAfterAmount) || body.sendAfterAmount < 1) {
		return errorResponse('Send delay must be a positive whole number.');
	}

	let quota: { allowed: boolean; retryAfterSeconds: number; workspaceName: string };
	try {
		quota = await locals.convex.mutation(api.emailAI.consumeReviewQuota, {
			workspaceId: body.workspaceId
		});
	} catch (error) {
		if (isConvexAccessError(error)) {
			return errorResponse('Only workspace owners may review follow-up content with AI.', 403);
		}
		return errorResponse('Unable to verify AI review access.', 503);
	}
	if (!quota.allowed) {
		return errorResponse('Too many AI review requests. Please try again later.', 429, {
			'Retry-After': String(quota.retryAfterSeconds)
		});
	}

	const apiKey = env.GEMINI_API_KEY?.trim();
	if (!apiKey) {
		return errorResponse('Email AI is not configured. Set GEMINI_API_KEY.', 503);
	}

	const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

	try {
		const response = await fetch(GEMINI_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': apiKey
			},
			body: JSON.stringify({
				model,
				input: buildPrompt({
					...body,
					subject,
					workspaceName: quota.workspaceName,
					goal,
					sanitizedBody
				}),
				response_format: {
					type: 'text',
					mime_type: 'application/json',
					schema: emailAIResponseSchema
				}
			}),
			signal: controller.signal
		});

		if (!response.ok) {
			if (response.status === 429) {
				return errorResponse('Gemini API quota is currently exhausted.', 429);
			}
			if (response.status === 401 || response.status === 403) {
				return errorResponse('Gemini API authentication failed. Check GEMINI_API_KEY.', 502);
			}
			return errorResponse(`Gemini API returned ${response.status}.`, 502);
		}

		const payload = (await response.json()) as GeminiInteractionResponse;
		const content = extractGeminiText(payload);
		const rawResult = parseEmailAIModelJson(content);
		if (!rawResult) {
			return errorResponse('AI response was not valid JSON.', 502);
		}

		const result = validateEmailAIResult(
			rawResult,
			{ subject, body: sanitizedBody },
			sanitizeRichTextHtml
		);
		if (!result.ok) {
			return errorResponse(result.message, 502);
		}

		return json(result.result);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return errorResponse('Gemini API did not respond before the timeout.', 504);
		}
		return errorResponse('Unable to reach Gemini API.', 502);
	} finally {
		clearTimeout(timeout);
	}
};
