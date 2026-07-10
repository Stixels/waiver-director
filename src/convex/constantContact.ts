'use node';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action, internalAction, type ActionCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

const CONNECTION_STATE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;
const ACCESS_TOKEN_SKEW_MS = 60_000;
const MAX_SYNC_ATTEMPTS = 3;

type ConstantContactList = {
	list_id?: string;
	name?: string;
	contact_count?: number;
};

type ConstantContactConnection = {
	integrationId: Id<'marketing_integrations'>;
	encryptedAccessToken: string;
	encryptedRefreshToken: string | null;
	accessTokenExpiresAt: number | null;
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
			message: 'CONVEX_SITE_URL or PUBLIC_CONVEX_SITE_URL is required for Constant Contact OAuth.'
		});
	}
	return `${new URL(siteUrl).origin}/constant-contact/callback`;
}

function credentialsKey() {
	const secret =
		process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY?.trim() ||
		process.env.BOOKING_CREDENTIALS_ENCRYPTION_KEY?.trim();
	if (!secret) {
		throw new ConvexError({
			code: 'invalid_configuration',
			message:
				'INTEGRATION_CREDENTIALS_ENCRYPTION_KEY is required to store Constant Contact credentials.'
		});
	}
	return createHash('sha256').update(secret).digest();
}

function encryptToken(value: string) {
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

function decryptToken(value: string) {
	const [version, ivValue, tagValue, ciphertextValue] = value.split('.');
	if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
		throw new ConvexError({
			code: 'invalid_state',
			message: 'Stored Constant Contact credential is invalid.'
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
	return 'Constant Contact request failed.';
}

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ConvexError({
				code: 'provider_error',
				message: 'Constant Contact request timed out.'
			});
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

async function constantContactFetch(path: string, accessToken: string, init: RequestInit = {}) {
	const response = await fetchWithTimeout(`https://api.cc.email/v3${path}`, {
		...init,
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${accessToken}`,
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...init.headers
		}
	});
	if (!response.ok) {
		let detail = `Constant Contact request failed with ${response.status}.`;
		try {
			const body = (await response.json()) as {
				errors?: Array<{ error_message?: string }>;
				message?: string;
			};
			detail = body.errors?.[0]?.error_message || body.message || detail;
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

async function exchangeToken(params: URLSearchParams) {
	const basic = Buffer.from(
		`${requiredEnv('CONSTANT_CONTACT_CLIENT_ID')}:${requiredEnv('CONSTANT_CONTACT_CLIENT_SECRET')}`
	).toString('base64');
	const response = await fetchWithTimeout(
		'https://authz.constantcontact.com/oauth2/default/v1/token',
		{
			method: 'POST',
			headers: {
				Authorization: `Basic ${basic}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: params
		}
	);
	if (!response.ok) {
		throw new ConvexError({
			code: response.status === 429 ? 'rate_limited' : 'provider_error',
			message: `Constant Contact token exchange failed with ${response.status}.`
		});
	}
	const body = (await response.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
	};
	if (!body.access_token || !body.refresh_token) {
		throw new ConvexError({
			code: 'provider_error',
			message: 'Constant Contact returned incomplete OAuth tokens.'
		});
	}
	return {
		accessToken: body.access_token,
		refreshToken: body.refresh_token,
		expiresAt: Date.now() + (body.expires_in ?? 86_400) * 1000
	};
}

async function getFreshAccessToken(ctx: ActionCtx, connection: ConstantContactConnection) {
	if (
		connection.accessTokenExpiresAt &&
		connection.accessTokenExpiresAt > Date.now() + ACCESS_TOKEN_SKEW_MS
	) {
		return decryptToken(connection.encryptedAccessToken);
	}
	if (!connection.encryptedRefreshToken) {
		throw new ConvexError({
			code: 'invalid_state',
			message: 'Constant Contact refresh token is missing. Reconnect the integration.'
		});
	}
	const refreshed = await exchangeToken(
		new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: decryptToken(connection.encryptedRefreshToken)
		})
	);
	await ctx.runMutation(internal.marketingIntegrations.saveRefreshedAccessToken, {
		integrationId: connection.integrationId,
		provider: 'constant_contact',
		encryptedAccessToken: encryptToken(refreshed.accessToken),
		encryptedRefreshToken: encryptToken(refreshed.refreshToken),
		accessTokenExpiresAt: refreshed.expiresAt
	});
	return refreshed.accessToken;
}

async function fetchLists(accessToken: string) {
	const response = await constantContactFetch('/contact_lists?limit=500', accessToken);
	const body = (await response.json()) as { lists?: ConstantContactList[] };
	return (body.lists ?? [])
		.filter((list) => Boolean(list.list_id && list.name))
		.map((list) => ({ id: list.list_id!, name: list.name!, memberCount: list.contact_count ?? 0 }))
		.sort((left, right) => left.name.localeCompare(right.name));
}

export const startConnect = action({
	args: { workspaceId: v.id('workspaces') },
	returns: v.object({ authorizationUrl: v.string() }),
	handler: async (ctx, args): Promise<{ authorizationUrl: string }> => {
		const access: { userId: Id<'users'>; workspaceSlug: string } = await ctx.runQuery(
			internal.marketingIntegrations.getOwnerAccessForAction,
			{ workspaceId: args.workspaceId, provider: 'constant_contact' }
		);
		const state = connectionState();
		await ctx.runMutation(internal.marketingIntegrations.createConnectionSession, {
			workspaceId: args.workspaceId,
			provider: 'constant_contact',
			requestedByUserId: access.userId,
			state,
			expiresAt: Date.now() + CONNECTION_STATE_TTL_MS
		});
		const url = new URL('https://authz.constantcontact.com/oauth2/default/v1/authorize');
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('client_id', requiredEnv('CONSTANT_CONTACT_CLIENT_ID'));
		url.searchParams.set('redirect_uri', callbackUrl());
		url.searchParams.set('scope', 'contact_data offline_access');
		url.searchParams.set('state', state);
		return { authorizationUrl: url.toString() };
	}
});

export const completeOAuthCallback = internalAction({
	args: { state: v.string(), code: v.optional(v.string()), error: v.optional(v.string()) },
	returns: v.object({ redirectUrl: v.string() }),
	handler: async (ctx, args): Promise<{ redirectUrl: string }> => {
		const session: {
			sessionId: Id<'marketing_connection_sessions'>;
			workspaceId: Id<'workspaces'>;
			workspaceSlug: string;
			expiresAt: number;
		} | null = await ctx.runQuery(internal.marketingIntegrations.getPendingConnectionSession, {
			state: args.state,
			provider: 'constant_contact'
		});
		if (!session) return { redirectUrl: `${appUrl()}/app?constant-contact=callback-error` };
		const integrationUrl = `${appUrl()}/app/${session.workspaceSlug}/integrations`;
		if (session.expiresAt <= Date.now()) {
			await ctx.runMutation(internal.marketingIntegrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'expired'
			});
			return {
				redirectUrl: `${integrationUrl}?marketing=constant-contact&marketing-status=expired`
			};
		}
		if (args.error || !args.code) {
			await ctx.runMutation(internal.marketingIntegrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'failed'
			});
			return {
				redirectUrl: `${integrationUrl}?marketing=constant-contact&marketing-status=denied`
			};
		}
		try {
			const tokens = await exchangeToken(
				new URLSearchParams({
					grant_type: 'authorization_code',
					code: args.code,
					redirect_uri: callbackUrl()
				})
			);
			await fetchLists(tokens.accessToken);
			await ctx.runMutation(internal.marketingIntegrations.saveOAuthConnection, {
				workspaceId: session.workspaceId,
				provider: 'constant_contact',
				encryptedAccessToken: encryptToken(tokens.accessToken),
				encryptedRefreshToken: encryptToken(tokens.refreshToken),
				accessTokenExpiresAt: tokens.expiresAt
			});
			await ctx.runMutation(internal.marketingIntegrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'completed'
			});
			return {
				redirectUrl: `${integrationUrl}?marketing=constant-contact&marketing-status=authorized`
			};
		} catch (error) {
			console.error('[constant-contact/oauth] unable to complete OAuth callback', {
				error: providerErrorMessage(error),
				workspaceId: session.workspaceId
			});
			await ctx.runMutation(internal.marketingIntegrations.markConnectionSession, {
				sessionId: session.sessionId,
				status: 'failed'
			});
			return {
				redirectUrl: `${integrationUrl}?marketing=constant-contact&marketing-status=callback-error`
			};
		}
	}
});

export const listLists = action({
	args: { workspaceId: v.id('workspaces') },
	returns: v.array(v.object({ id: v.string(), name: v.string(), memberCount: v.number() })),
	handler: async (ctx, args) => {
		const connection = (await ctx.runQuery(
			internal.marketingIntegrations.getConnectionForOwnerAction,
			{ workspaceId: args.workspaceId, provider: 'constant_contact' }
		)) as ConstantContactConnection;
		return await fetchLists(await getFreshAccessToken(ctx, connection));
	}
});

export const chooseList = action({
	args: { workspaceId: v.id('workspaces'), listId: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const connection = (await ctx.runQuery(
			internal.marketingIntegrations.getConnectionForOwnerAction,
			{ workspaceId: args.workspaceId, provider: 'constant_contact' }
		)) as ConstantContactConnection;
		const lists = await fetchLists(await getFreshAccessToken(ctx, connection));
		const list = lists.find((candidate) => candidate.id === args.listId);
		if (!list) {
			throw new ConvexError({ code: 'not_found', message: 'Constant Contact list not found.' });
		}
		await ctx.runMutation(internal.marketingIntegrations.selectAudience, {
			workspaceId: args.workspaceId,
			provider: 'constant_contact',
			integrationId: connection.integrationId,
			audienceId: list.id,
			audienceName: list.name
		});
		return null;
	}
});

export const syncContact = internalAction({
	args: { syncId: v.id('marketing_contact_syncs') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const sync = (await ctx.runQuery(
			internal.marketingIntegrations.getContactSyncContext,
			args
		)) as
			| (ConstantContactConnection & {
					syncId: Id<'marketing_contact_syncs'>;
					audienceId: string;
					signerEmail: string;
					attempts: number;
					provider: 'constant_contact';
			  })
			| null;
		if (!sync || sync.provider !== 'constant_contact') return null;
		try {
			await constantContactFetch('/contacts/sign_up_form', await getFreshAccessToken(ctx, sync), {
				method: 'POST',
				body: JSON.stringify({
					email_address: sync.signerEmail.trim().toLowerCase(),
					list_memberships: [sync.audienceId]
				})
			});
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
					internal.constantContact.syncContact,
					args
				);
			}
		}
		return null;
	}
});
