'use node';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action, internalAction } from './_generated/server';
import type { Id } from './_generated/dataModel';

const CONNECTION_STATE_TTL_MS = 30 * 60 * 1000;
const MAILCHIMP_REQUEST_TIMEOUT_MS = 20_000;
const MAX_SYNC_ATTEMPTS = 3;

type MailchimpAudience = {
	id: string;
	name: string;
	stats?: { member_count?: number };
};

function requiredEnv(name: string) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: `Missing Convex environment variable: ${name}.`
		});
	}
	return value;
}

function appUrl() {
	const configured =
		process.env.APP_URL?.trim() ||
		process.env.PUBLIC_APP_URL?.trim() ||
		process.env.SITE_URL?.trim() ||
		'http://localhost:5173';
	try {
		return new URL(configured).origin;
	} catch {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'APP_URL, PUBLIC_APP_URL, or SITE_URL must be an absolute URL.'
		});
	}
}

function callbackUrl() {
	const siteUrl = process.env.CONVEX_SITE_URL?.trim() || process.env.PUBLIC_CONVEX_SITE_URL?.trim();
	if (!siteUrl) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'CONVEX_SITE_URL or PUBLIC_CONVEX_SITE_URL is required for Mailchimp OAuth.'
		});
	}
	return `${new URL(siteUrl).origin}/mailchimp/callback`;
}

function credentialsKey() {
	const secret =
		process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY?.trim() ||
		process.env.BOOKING_CREDENTIALS_ENCRYPTION_KEY?.trim();
	if (!secret) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message: 'INTEGRATION_CREDENTIALS_ENCRYPTION_KEY is required to store Mailchimp credentials.'
		});
	}
	return createHash('sha256').update(secret).digest();
}

function encryptAccessToken(value: string) {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', credentialsKey(), iv);
	const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [
		'v1',
		iv.toString('base64url'),
		tag.toString('base64url'),
		ciphertext.toString('base64url')
	].join('.');
}

function decryptAccessToken(value: string) {
	const [version, ivValue, tagValue, ciphertextValue] = value.split('.');
	if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
		throw new ConvexError({
			code: 'invalid_state',
			message: 'Stored Mailchimp credential is invalid.'
		});
	}
	const decipher = createDecipheriv(
		'aes-256-gcm',
		credentialsKey(),
		Buffer.from(ivValue, 'base64url')
	);
	decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
	return Buffer.concat([
		decipher.update(Buffer.from(ciphertextValue, 'base64url')),
		decipher.final()
	]).toString('utf8');
}

function connectionState() {
	return randomBytes(24).toString('base64url');
}

function providerErrorMessage(error: unknown) {
	if (error instanceof ConvexError) {
		const data = error.data as { message?: string };
		if (typeof data?.message === 'string') return data.message;
	}
	if (error instanceof Error) return error.message;
	return 'Mailchimp request failed.';
}

async function mailchimpFetch(
	serverPrefix: string,
	accessToken: string,
	path: string,
	init: RequestInit = {}
) {
	if (!/^[a-z0-9-]+$/i.test(serverPrefix)) {
		throw new ConvexError({ code: 'invalid_state', message: 'Invalid Mailchimp server prefix.' });
	}
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), MAILCHIMP_REQUEST_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(`https://${serverPrefix}.api.mailchimp.com/3.0${path}`, {
			...init,
			signal: controller.signal,
			headers: {
				Accept: 'application/json',
				Authorization: `OAuth ${accessToken}`,
				...(init.body ? { 'Content-Type': 'application/json' } : {}),
				...init.headers
			}
		});
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ConvexError({ code: 'provider_error', message: 'Mailchimp request timed out.' });
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		let detail = `Mailchimp request failed with ${response.status}.`;
		try {
			const body = (await response.json()) as { detail?: string; title?: string };
			detail = body.detail || body.title || detail;
		} catch {
			// Keep the status fallback.
		}
		throw new ConvexError({
			code: response.status === 429 ? 'rate_limited' : 'provider_error',
			message: detail
		});
	}

	return response;
}

async function fetchAudiences(serverPrefix: string, accessToken: string) {
	const fields = encodeURIComponent('lists.id,lists.name,lists.stats.member_count,total_items');
	const response = await mailchimpFetch(
		serverPrefix,
		accessToken,
		`/lists?count=1000&fields=${fields}`
	);
	const body = (await response.json()) as { lists?: MailchimpAudience[] };
	return (body.lists ?? [])
		.filter((audience) => Boolean(audience.id && audience.name))
		.map((audience) => ({
			id: audience.id,
			name: audience.name,
			memberCount: audience.stats?.member_count ?? 0
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}

export const startConnect = action({
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({ authorizationUrl: v.string() }),
	handler: async (ctx, args): Promise<{ authorizationUrl: string }> => {
		const access: { userId: Id<'users'>; workspaceSlug: string } = await ctx.runQuery(
			internal.marketingIntegrations.getOwnerAccessForAction,
			{ workspaceId: args.workspaceId }
		);
		const state = connectionState();
		await ctx.runMutation(internal.marketingIntegrations.createConnectionSession, {
			workspaceId: args.workspaceId,
			requestedByUserId: access.userId,
			state,
			expiresAt: Date.now() + CONNECTION_STATE_TTL_MS
		});

		const url = new URL('https://login.mailchimp.com/oauth2/authorize');
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('client_id', requiredEnv('MAILCHIMP_CLIENT_ID'));
		url.searchParams.set('redirect_uri', callbackUrl());
		url.searchParams.set('state', state);
		return { authorizationUrl: url.toString() };
	}
});

export const completeOAuthCallback = internalAction({
	args: {
		state: v.string(),
		code: v.optional(v.string()),
		error: v.optional(v.string())
	},
	returns: v.object({ redirectUrl: v.string() }),
	handler: async (ctx, args): Promise<{ redirectUrl: string }> => {
		const session: {
			sessionId: Id<'marketing_connection_sessions'>;
			workspaceId: Id<'workspaces'>;
			workspaceSlug: string;
			expiresAt: number;
		} | null = await ctx.runQuery(internal.marketingIntegrations.getPendingConnectionSession, {
			state: args.state
		});
		if (!session) return { redirectUrl: `${appUrl()}/app?mailchimp=callback-error` };

		const integrationUrl: string = `${appUrl()}/app/${session.workspaceSlug}/integrations`;
		if (session.expiresAt <= Date.now()) {
			await ctx.runMutation(internal.marketingIntegrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'expired'
			});
			return { redirectUrl: `${integrationUrl}?mailchimp=expired` };
		}
		if (args.error || !args.code) {
			await ctx.runMutation(internal.marketingIntegrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'failed'
			});
			return { redirectUrl: `${integrationUrl}?mailchimp=denied` };
		}

		try {
			const tokenResponse = await fetch('https://login.mailchimp.com/oauth2/token', {
				method: 'POST',
				body: new URLSearchParams({
					grant_type: 'authorization_code',
					client_id: requiredEnv('MAILCHIMP_CLIENT_ID'),
					client_secret: requiredEnv('MAILCHIMP_CLIENT_SECRET'),
					redirect_uri: callbackUrl(),
					code: args.code
				})
			});
			if (!tokenResponse.ok) {
				throw new ConvexError({
					code: 'provider_error',
					message: `Mailchimp token exchange failed with ${tokenResponse.status}.`
				});
			}
			const tokenBody = (await tokenResponse.json()) as { access_token?: string };
			if (!tokenBody.access_token) {
				throw new ConvexError({
					code: 'provider_error',
					message: 'Mailchimp returned no access token.'
				});
			}

			const metadataResponse = await fetch('https://login.mailchimp.com/oauth2/metadata', {
				headers: { Authorization: `OAuth ${tokenBody.access_token}` }
			});
			if (!metadataResponse.ok) {
				throw new ConvexError({
					code: 'provider_error',
					message: `Mailchimp metadata request failed with ${metadataResponse.status}.`
				});
			}
			const metadata = (await metadataResponse.json()) as {
				dc?: string;
				login?: { login_id?: string | number };
			};
			if (!metadata.dc) {
				throw new ConvexError({
					code: 'provider_error',
					message: 'Mailchimp returned no server prefix.'
				});
			}

			await mailchimpFetch(metadata.dc, tokenBody.access_token, '/ping');
			await ctx.runMutation(internal.marketingIntegrations.saveOAuthConnection, {
				workspaceId: session.workspaceId,
				encryptedAccessToken: encryptAccessToken(tokenBody.access_token),
				serverPrefix: metadata.dc,
				...(metadata.login?.login_id !== undefined
					? { accountId: String(metadata.login.login_id) }
					: {})
			});
			await ctx.runMutation(internal.marketingIntegrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'completed'
			});
			return { redirectUrl: `${integrationUrl}?mailchimp=connected` };
		} catch (error) {
			console.error('[mailchimp/oauth] unable to complete OAuth callback', {
				error: providerErrorMessage(error),
				workspaceId: session.workspaceId
			});
			await ctx.runMutation(internal.marketingIntegrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'failed'
			});
			return { redirectUrl: `${integrationUrl}?mailchimp=callback-error` };
		}
	}
});

export const listAudiences = action({
	args: { workspaceId: v.id('workspaces') },
	returns: v.array(v.object({ id: v.string(), name: v.string(), memberCount: v.number() })),
	handler: async (ctx, args) => {
		const connection: {
			integrationId: Id<'marketing_integrations'>;
			encryptedAccessToken: string;
			serverPrefix: string;
		} = await ctx.runQuery(internal.marketingIntegrations.getConnectionForOwnerAction, args);
		return await fetchAudiences(
			connection.serverPrefix,
			decryptAccessToken(connection.encryptedAccessToken)
		);
	}
});

export const chooseAudience = action({
	args: { workspaceId: v.id('workspaces'), audienceId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const connection: {
			integrationId: Id<'marketing_integrations'>;
			encryptedAccessToken: string;
			serverPrefix: string;
		} = await ctx.runQuery(internal.marketingIntegrations.getConnectionForOwnerAction, {
			workspaceId: args.workspaceId
		});
		const audiences = await fetchAudiences(
			connection.serverPrefix,
			decryptAccessToken(connection.encryptedAccessToken)
		);
		const audience = audiences.find((candidate) => candidate.id === args.audienceId);
		if (!audience) {
			throw new ConvexError({ code: 'not_found', message: 'Mailchimp audience not found.' });
		}
		await ctx.runMutation(internal.marketingIntegrations.selectAudience, {
			workspaceId: args.workspaceId,
			integrationId: connection.integrationId,
			audienceId: audience.id,
			audienceName: audience.name
		});
		return null;
	}
});

export const syncContact = internalAction({
	args: { syncId: v.id('marketing_contact_syncs') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const sync: {
			syncId: Id<'marketing_contact_syncs'>;
			integrationId: Id<'marketing_integrations'>;
			audienceId: string;
			signerEmail: string;
			encryptedAccessToken: string;
			serverPrefix: string;
			attempts: number;
		} | null = await ctx.runQuery(internal.marketingIntegrations.getContactSyncContext, args);
		if (!sync) return null;

		try {
			const email = sync.signerEmail.trim().toLowerCase();
			const subscriberHash = createHash('md5').update(email).digest('hex');
			await mailchimpFetch(
				sync.serverPrefix,
				decryptAccessToken(sync.encryptedAccessToken),
				`/lists/${encodeURIComponent(sync.audienceId)}/members/${subscriberHash}`,
				{
					method: 'PUT',
					body: JSON.stringify({
						email_address: email,
						status_if_new: 'subscribed'
					})
				}
			);
			await ctx.runMutation(internal.marketingIntegrations.markContactSyncSucceeded, {
				syncId: sync.syncId,
				integrationId: sync.integrationId
			});
		} catch (error) {
			const result: { attempts: number } = await ctx.runMutation(
				internal.marketingIntegrations.markContactSyncFailed,
				{
					syncId: sync.syncId,
					integrationId: sync.integrationId,
					error: providerErrorMessage(error).slice(0, 500)
				}
			);
			if (result.attempts < MAX_SYNC_ATTEMPTS) {
				await ctx.scheduler.runAfter(
					result.attempts * 60_000,
					internal.mailchimp.syncContact,
					args
				);
			}
		}
		return null;
	}
});
