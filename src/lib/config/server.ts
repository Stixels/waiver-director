import {
	BOOKEO_API_KEY,
	BOOKEO_SECRET_KEY,
	CLERK_ISSUER_URL,
	CLERK_JWT_AUDIENCE,
	CLERK_PUBLISHABLE_KEY,
	CLERK_SECRET_KEY,
	RESEND_API_KEY
} from '$env/static/private';

export const serverEnv = {
	clerk: {
		publishableKey: CLERK_PUBLISHABLE_KEY,
		secretKey: CLERK_SECRET_KEY,
		issuerUrl: CLERK_ISSUER_URL,
		jwtAudience: CLERK_JWT_AUDIENCE
	},
	email: {
		resendApiKey: RESEND_API_KEY
	},
	bookeo: {
		apiKey: BOOKEO_API_KEY,
		secretKey: BOOKEO_SECRET_KEY
	}
} as const;
