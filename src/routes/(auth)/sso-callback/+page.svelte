<script lang="ts">
	import { resolve } from '$app/paths';
	import { useClerkContext } from 'svelte-clerk';

	import { getClerkErrorMessage } from '$lib/auth/clerk-helpers';
	import AuthPageShell from '$lib/components/marketing/auth/AuthPageShell.svelte';

	const clerk = useClerkContext();
	const postAuthRedirectUrl = resolve('/app');
	let hasStartedCallback = false;
	let callbackError = $state<string | null>(null);

	function hasActiveSession() {
		return Boolean(
			clerk.clerk?.session || clerk.session || clerk.auth.sessionId || clerk.auth.userId
		);
	}

	async function replaceWith(url: string): Promise<void> {
		window.location.replace(url);
	}

	async function handleSsoCallback(timeoutId: number) {
		try {
			await clerk.clerk?.handleRedirectCallback(
				{
					signInUrl: resolve('/sign-in'),
					signUpUrl: resolve('/sign-up'),
					signInForceRedirectUrl: postAuthRedirectUrl,
					signUpForceRedirectUrl: postAuthRedirectUrl,
					continueSignUpUrl: resolve('/sign-up'),
					verifyEmailAddressUrl: resolve('/sign-up'),
					resetPasswordUrl: resolve('/forgot-password')
				},
				replaceWith
			);

			if (hasActiveSession()) {
				void replaceWith(postAuthRedirectUrl);
			}
		} catch (error) {
			console.error('[auth/sso-callback] Clerk redirect callback failed', error);
			callbackError = getClerkErrorMessage(
				error,
				'Unable to complete Google authentication. Please try again.'
			);
		} finally {
			window.clearTimeout(timeoutId);
		}
	}

	$effect(() => {
		if (!hasActiveSession()) return;
		void replaceWith(postAuthRedirectUrl);
	});

	$effect(() => {
		if (!clerk.isLoaded || !clerk.clerk || !clerk.client || hasStartedCallback) {
			return;
		}

		hasStartedCallback = true;
		const timeoutId = window.setTimeout(() => {
			if (hasActiveSession()) {
				void replaceWith(postAuthRedirectUrl);
				return;
			}

			callbackError =
				'Google authentication did not finish. Check that this exact URL is allowed in Clerk and Google OAuth redirect settings, then try again.';
		}, 8000);

		void handleSsoCallback(timeoutId);
	});
</script>

<svelte:head>
	<title>Completing sign in | Waiver Director</title>
	<meta name="description" content="Completing your secure sign-in to Waiver Director." />
</svelte:head>

<AuthPageShell
	title="Completing sign in"
	description="Finishing your authentication. This should only take a moment."
	width="narrow"
>
	<div id="clerk-captcha"></div>

	{#if callbackError}
		<p
			class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
		>
			{callbackError}
		</p>
	{/if}

	<div class="mt-4 text-center text-sm text-muted-foreground">
		If nothing happens, return to
		<a
			href={resolve('/sign-in')}
			class="font-semibold text-primary transition-[filter] hover:brightness-125"
		>
			sign in
		</a>
		or
		<a
			href={resolve('/sign-up')}
			class="font-semibold text-primary transition-[filter] hover:brightness-125"
		>
			sign up
		</a>.
	</div>
</AuthPageShell>
