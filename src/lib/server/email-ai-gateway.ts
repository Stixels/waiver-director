export const AI_GATEWAY_API_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
export const DEFAULT_AI_GATEWAY_MODEL = 'zai/glm-5.3-flash';

type AIGatewayContentPart = {
	type?: string;
	text?: string;
};

type AIGatewayResponse = {
	choices?: Array<{
		message?: {
			content?: string | AIGatewayContentPart[] | null;
		};
	}>;
};

export function buildAIGatewayRequest(model: string, prompt: string, responseSchema: object) {
	return {
		model,
		messages: [{ role: 'user' as const, content: prompt }],
		stream: false,
		response_format: {
			type: 'json_schema' as const,
			json_schema: {
				name: 'email_review',
				description: 'A scored review and improved version of an operator email template.',
				schema: responseSchema
			}
		},
		providerOptions: {
			gateway: {
				disallowPromptTraining: true
			}
		}
	};
}

export function extractAIGatewayText(payload: AIGatewayResponse): string {
	const content = payload.choices?.[0]?.message?.content;
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';

	return content
		.filter((part) => part.type === 'text' && typeof part.text === 'string')
		.map((part) => part.text)
		.join('');
}

export function getAIGatewayFailure(status: number): { message: string; status: number } {
	if (status === 429) {
		return { message: 'AI Gateway quota is currently exhausted.', status: 429 };
	}
	if (status === 401 || status === 403) {
		return {
			message: 'AI Gateway authentication failed. Check AI_GATEWAY_API_KEY.',
			status: 502
		};
	}
	if (status === 402) {
		return { message: 'AI Gateway credits are currently exhausted.', status: 503 };
	}
	if (status === 404) {
		return {
			message: 'The configured AI Gateway model is unavailable. Check AI_GATEWAY_MODEL.',
			status: 502
		};
	}
	return { message: `AI Gateway returned ${status}.`, status: 502 };
}
