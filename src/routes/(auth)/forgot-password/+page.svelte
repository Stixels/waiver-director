<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useClerkContext } from 'svelte-clerk';
	import {
		getClerkErrorMessage,
		getResolvedClerkNavigationPath,
		getSafePostAuthRedirectHref
	} from '$lib/auth/clerk-helpers';
	import AuthPageShell from '$lib/components/marketing/auth/AuthPageShell.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	const inputClass =
		'h-14 rounded-xl border-(--m-border-strong) bg-(--m-elevated) px-4 text-sm text-foreground shadow-none transition-[border-color,box-shadow] placeholder:text-(--m-text-3) focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 sm:px-5 md:text-sm';
	const submitButtonClass =
		'btn-mkt-accent h-14 w-full rounded-xl text-base font-semibold shadow-none';
	const backButtonClass =
		'btn-mkt-outline h-14 w-full rounded-xl border-(--m-border-strong) text-base font-semibold shadow-none';

	const clerk = useClerkContext();

	let email = $state('');
	let code = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);
	let isAwaitingResetCode = $state(false);
	let submitMessage = $state<string | null>(null);
	let submitError = $state<string | null>(null);
	const redirectTo = $derived(page.url.searchParams.get('redirectTo'));
	const postAuthRedirectUrl = $derived(getSafePostAuthRedirectHref(redirectTo));

	function getSignInResource() {
		return clerk.client?.signIn ?? null;
	}

	async function activateCreatedSession(sessionId: string | null) {
		if (!sessionId || !clerk.clerk) {
			throw new Error('Your password was reset, but no active session could be set.');
		}

		await clerk.clerk.setActive({
			session: sessionId,
			navigate: async ({ session, decorateUrl }) => {
				if (session?.currentTask) {
					return;
				}

				await goto(resolve(getResolvedClerkNavigationPath(decorateUrl(postAuthRedirectUrl))));
			}
		});
	}

	async function handleRequestReset(event: SubmitEvent) {
		event.preventDefault();

		const signIn = getSignInResource();
		if (!clerk.isLoaded || !signIn) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		if (!email.trim()) {
			submitError = 'Enter the email on your account.';
			return;
		}

		isSubmitting = true;
		submitError = null;
		submitMessage = null;

		try {
			await signIn.create({
				strategy: 'reset_password_email_code',
				identifier: email.trim()
			});

			isAwaitingResetCode = true;
			submitMessage = `We sent a reset code to ${email.trim()}.`;
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to start password reset right now.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleResetPassword(event: SubmitEvent) {
		event.preventDefault();

		const signIn = getSignInResource();
		if (!clerk.isLoaded || !signIn) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		if (!code.trim() || !newPassword || !confirmPassword) {
			submitError = 'Complete all fields to reset your password.';
			return;
		}

		if (newPassword !== confirmPassword) {
			submitError = 'Passwords do not match.';
			return;
		}

		isSubmitting = true;
		submitError = null;

		try {
			const signInAttempt = await signIn.attemptFirstFactor({
				strategy: 'reset_password_email_code',
				code: code.trim(),
				password: newPassword
			});

			if (signInAttempt.status === 'complete') {
				await activateCreatedSession(signInAttempt.createdSessionId);
				return;
			}

			submitError = 'Password reset is not complete yet. Please try again.';
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to reset your password right now.');
		} finally {
			isSubmitting = false;
		}
	}

	function restartResetFlow() {
		isAwaitingResetCode = false;
		code = '';
		newPassword = '';
		confirmPassword = '';
		submitMessage = null;
		submitError = null;
	}
</script>

<svelte:head>
	<title>Forgot password | Waiver Director</title>
	<meta
		name="description"
		content="Request a password reset link for your Waiver Director account."
	/>
</svelte:head>

<AuthPageShell
	title="Reset your password"
	description="Enter the email on your account and we'll send a secure reset code."
	width="narrow"
>
	{#if isAwaitingResetCode}
		<form class="space-y-4" onsubmit={handleResetPassword}>
			<div class="rounded-xl border border-(--m-border-soft) bg-(--m-elevated) px-4 py-3">
				<p class="text-sm font-medium">Check your email</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Enter the reset code sent to {email.trim()} and choose a new password.
				</p>
			</div>

			<Input
				id="reset-code"
				name="code"
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				placeholder="Reset code"
				aria-label="Reset code"
				class={inputClass}
				bind:value={code}
			/>

			<Input
				id="reset-password"
				name="password"
				type="password"
				autocomplete="new-password"
				placeholder="New password"
				aria-label="New password"
				class={inputClass}
				bind:value={newPassword}
			/>

			<Input
				id="reset-password-confirm"
				name="password_confirm"
				type="password"
				autocomplete="new-password"
				placeholder="Confirm new password"
				aria-label="Confirm new password"
				class={inputClass}
				bind:value={confirmPassword}
			/>

			<div class="space-y-3 pt-1">
				<Button type="submit" class={submitButtonClass} disabled={isSubmitting}>
					{isSubmitting ? 'Updating password...' : 'Update password'}
				</Button>

				<Button type="button" variant="outline" class={backButtonClass} onclick={restartResetFlow}>
					Use a different email
				</Button>

				{#if submitMessage}
					<p class="text-center text-sm text-muted-foreground" role="status">{submitMessage}</p>
				{/if}

				{#if submitError}
					<p class="text-center text-sm text-destructive" role="status">{submitError}</p>
				{/if}
			</div>
		</form>
	{:else}
		<form class="space-y-4" method="post" onsubmit={handleRequestReset}>
			<Input
				id="reset-email"
				name="email"
				type="email"
				autocomplete="email"
				placeholder="Email"
				aria-label="Email"
				class={inputClass}
				bind:value={email}
			/>

			<div class="space-y-3 pt-1">
				<Button type="submit" class={submitButtonClass} disabled={isSubmitting}>
					{isSubmitting ? 'Sending code...' : 'Send reset code'}
				</Button>

				{#if submitMessage}
					<p class="text-center text-sm text-muted-foreground" role="status">{submitMessage}</p>
				{/if}

				{#if submitError}
					<p class="text-center text-sm text-destructive" role="status">{submitError}</p>
				{/if}
			</div>
		</form>
	{/if}
</AuthPageShell>
