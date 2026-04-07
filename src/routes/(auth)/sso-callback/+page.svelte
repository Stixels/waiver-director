<script lang="ts">
	import { resolve } from '$app/paths';
	import { AuthenticateWithRedirectCallback } from 'svelte-clerk';

	import AuthPageShell from '$lib/components/marketing/auth/AuthPageShell.svelte';
</script>

<svelte:head>
	<title>Completing sign in | Waiver Director</title>
	<meta
		name="description"
		content="Completing your secure sign-in to Waiver Director."
	/>
</svelte:head>

<AuthPageShell
	title="Completing sign in"
	description="Finishing your authentication. This should only take a moment."
	width="narrow"
>
	<AuthenticateWithRedirectCallback
		signInUrl={resolve('/sign-in')}
		signUpUrl={resolve('/sign-up')}
		continueSignUpUrl={resolve('/sign-up')}
		verifyEmailAddressUrl={resolve('/sign-up')}
		resetPasswordUrl={resolve('/forgot-password')}
		reloadResource="signUp"
	/>

	<div class="mt-4 text-center text-sm text-muted-foreground">
		If nothing happens, return to
		<a href={resolve('/sign-in')} class="font-semibold text-primary transition-[filter] hover:brightness-125">
			sign in
		</a>
		or
		<a href={resolve('/sign-up')} class="font-semibold text-primary transition-[filter] hover:brightness-125">
			sign up
		</a>.
	</div>
</AuthPageShell>
