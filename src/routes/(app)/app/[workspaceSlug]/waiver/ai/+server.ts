import { json, type RequestHandler } from '@sveltejs/kit';
import { ConvexError } from 'convex/values';
import { env } from '$env/dynamic/private';
import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import {
	buildWaiverAIDraft,
	buildWaiverAIPrompt,
	normalizeWaiverAIRequest,
	parseWaiverAIModelJson,
	waiverAIResponseSchema
} from '$lib/domain/waiver-ai';
import {
	AI_GATEWAY_API_URL,
	buildAIGatewayRequest,
	DEFAULT_AI_GATEWAY_MODEL,
	extractAIGatewayText,
	getAIGatewayFailure
} from '$lib/server/email-ai-gateway';
import { sanitizeRichTextHtml } from '$lib/utils/rich-text';

const AI_GATEWAY_TIMEOUT_MS = 120_000;

function errorResponse(message: string, status = 400, headers?: Record<string, string>) {
	return json({ message }, { status, headers });
}

function convexErrorCode(error: unknown): string | null {
	if (!(error instanceof ConvexError) || !error.data || typeof error.data !== 'object') {
		return null;
	}
	return 'code' in error.data && typeof error.data.code === 'string' ? error.data.code : null;
}

/**
 * Generates a waiver draft from an activity description. The response is only
 * a proposal: the builder shows it to the member, who decides whether to
 * replace the draft. Nothing is saved or published here.
 */
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

	const workspaceId =
		body && typeof body === 'object' && 'workspaceId' in body ? body.workspaceId : null;
	if (typeof workspaceId !== 'string' || !workspaceId) {
		return errorResponse('Request body is missing the workspace.');
	}

	const normalized = normalizeWaiverAIRequest(body);
	if (!normalized.ok) {
		return errorResponse(normalized.message);
	}

	let quota: { allowed: boolean; retryAfterSeconds: number; workspaceName: string };
	try {
		quota = await locals.convex.mutation(api.waiverAI.consumeDraftQuota, {
			workspaceId: workspaceId as Id<'workspaces'>
		});
	} catch (error) {
		const code = convexErrorCode(error);
		if (code === 'unauthenticated' || code === 'forbidden') {
			return errorResponse('You do not have access to this workspace.', 403);
		}
		if (code === 'billing_required') {
			return errorResponse(
				'The AI waiver generator is included with Pro. Upgrade, or make this workspace primary on your Pro plan.',
				402
			);
		}
		return errorResponse('Unable to verify AI access.', 503);
	}
	if (!quota.allowed) {
		return errorResponse('Too many AI draft requests. Please try again later.', 429, {
			'Retry-After': String(quota.retryAfterSeconds)
		});
	}

	const apiKey = env.AI_GATEWAY_API_KEY?.trim();
	if (!apiKey) {
		return errorResponse('AI is not configured. Set AI_GATEWAY_API_KEY.', 503);
	}

	const model = env.AI_GATEWAY_MODEL?.trim() || DEFAULT_AI_GATEWAY_MODEL;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AI_GATEWAY_TIMEOUT_MS);

	try {
		const response = await fetch(AI_GATEWAY_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify(
				buildAIGatewayRequest(
					model,
					buildWaiverAIPrompt({ ...normalized.request, workspaceName: quota.workspaceName }),
					waiverAIResponseSchema,
					{
						name: 'waiver_draft',
						description: 'A first-draft liability waiver with sections and custom fields.'
					}
				)
			),
			signal: controller.signal
		});

		if (!response.ok) {
			const failure = getAIGatewayFailure(response.status);
			return errorResponse(failure.message, failure.status);
		}

		const payload = await response.json();
		const raw = parseWaiverAIModelJson(extractAIGatewayText(payload));
		if (!raw) {
			return errorResponse('AI response was not valid JSON.', 502);
		}

		const result = buildWaiverAIDraft(raw, sanitizeRichTextHtml);
		if (!result.ok) {
			return errorResponse(result.message, 502);
		}

		return json(result.draft);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return errorResponse('AI Gateway did not respond before the timeout.', 504);
		}
		return errorResponse('Unable to reach AI Gateway.', 502);
	} finally {
		clearTimeout(timeout);
	}
};
