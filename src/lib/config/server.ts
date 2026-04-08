import {
	BOOKEO_API_KEY,
	BOOKEO_SECRET_KEY,
	CLERK_FRONTEND_API_URL,
	CLERK_SECRET_KEY,
	RESEND_API_KEY
} from '$env/static/private';

function requiredEnv(name: string, value: string | undefined): string {
	if (value === undefined || value.trim() === '') {
		throw new Error(`Missing or empty required environment variable: ${name}`);
	}
	return value;
}

const clerkSecretKey = requiredEnv('CLERK_SECRET_KEY', CLERK_SECRET_KEY);
const clerkFrontendApiUrl = requiredEnv('CLERK_FRONTEND_API_URL', CLERK_FRONTEND_API_URL);
const resendApiKey = requiredEnv('RESEND_API_KEY', RESEND_API_KEY);
const bookeoApiKey = requiredEnv('BOOKEO_API_KEY', BOOKEO_API_KEY);
const bookeoSecretKey = requiredEnv('BOOKEO_SECRET_KEY', BOOKEO_SECRET_KEY);

export const serverEnv = {
	clerk: {
		secretKey: clerkSecretKey,
		frontendApiUrl: clerkFrontendApiUrl
	},
	email: {
		resendApiKey
	},
	bookeo: {
		apiKey: bookeoApiKey,
		secretKey: bookeoSecretKey
	}
} as const;
