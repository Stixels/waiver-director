import {
	BOOKEO_API_KEY,
	BOOKEO_SECRET_KEY,
	CLERK_ISSUER_URL,
	CLERK_JWT_AUDIENCE,
	CLERK_PUBLISHABLE_KEY,
	CLERK_SECRET_KEY,
	RESEND_API_KEY
} from '$env/static/private';

function requiredEnv(name: string, value: string | undefined): string {
	if (value === undefined || value.trim() === '') {
		throw new Error(`Missing or empty required environment variable: ${name}`);
	}
	return value;
}

const clerkPublishableKey = requiredEnv('CLERK_PUBLISHABLE_KEY', CLERK_PUBLISHABLE_KEY);
const clerkSecretKey = requiredEnv('CLERK_SECRET_KEY', CLERK_SECRET_KEY);
const clerkIssuerUrl = requiredEnv('CLERK_ISSUER_URL', CLERK_ISSUER_URL);
const clerkJwtAudience = requiredEnv('CLERK_JWT_AUDIENCE', CLERK_JWT_AUDIENCE);
const resendApiKey = requiredEnv('RESEND_API_KEY', RESEND_API_KEY);
const bookeoApiKey = requiredEnv('BOOKEO_API_KEY', BOOKEO_API_KEY);
const bookeoSecretKey = requiredEnv('BOOKEO_SECRET_KEY', BOOKEO_SECRET_KEY);

export const serverEnv = {
	clerk: {
		publishableKey: clerkPublishableKey,
		secretKey: clerkSecretKey,
		issuerUrl: clerkIssuerUrl,
		jwtAudience: clerkJwtAudience
	},
	email: {
		resendApiKey
	},
	bookeo: {
		apiKey: bookeoApiKey,
		secretKey: bookeoSecretKey
	}
} as const;
