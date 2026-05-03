<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { RefreshCw } from '@lucide/svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { getClerkErrorMessage, getSafePostAuthRedirectHref } from '$lib/auth/clerk-helpers';
	import AuthPageShell from '$lib/components/marketing/auth/AuthPageShell.svelte';
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { InputOTP, InputOTPGroup, InputOTPSlot } from '$lib/components/ui/input-otp';

	const inputClass =
		'h-14 rounded-xl border-(--m-border-strong) bg-(--m-elevated) px-4 text-sm text-foreground shadow-none transition-[border-color,box-shadow] placeholder:text-(--m-text-3) focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 sm:px-5 md:text-sm';
	const submitButtonClass =
		'btn-mkt-accent h-14 w-full rounded-xl text-base font-semibold shadow-none';
	const secondaryButtonClass =
		'h-14 w-full rounded-xl border-(--m-border-strong) bg-(--m-elevated) text-base font-semibold shadow-none transition-colors hover:bg-(--m-card)';

	type SecondFactorStrategy = 'email_code' | 'phone_code' | 'totp' | 'backup_code';
	type SupportedSecondFactor = {
		strategy: SecondFactorStrategy;
		emailAddressId?: string;
		phoneNumberId?: string;
	};

	const clerk = useClerkContext();

	let email = $state('');
	let password = $state('');
	let verificationCode = $state('');
	let isSubmitting = $state(false);
	let submitMessage = $state<string | null>(null);
	let submitError = $state<string | null>(null);
	let isAwaitingSecondFactor = $state(false);
	let secondFactorStrategy = $state<SecondFactorStrategy | null>(null);
	let primarySecondFactorStrategy = $state<Exclude<SecondFactorStrategy, 'backup_code'> | null>(
		null
	);
	let secondFactorEmailAddressId = $state<string | null>(null);
	let secondFactorPhoneNumberId = $state<string | null>(null);
	let backupCodeAvailable = $state(false);
	const redirectTo = $derived(page.url.searchParams.get('redirectTo'));
	const postAuthRedirectUrl = $derived(getSafePostAuthRedirectHref(redirectTo, '/app'));

	const authPageTitle = $derived(
		isAwaitingSecondFactor && secondFactorStrategy
			? secondFactorStrategy === 'email_code'
				? 'Check your email'
				: secondFactorStrategy === 'phone_code'
					? 'Check your phone'
					: secondFactorStrategy === 'totp'
						? 'Two-step verification'
						: 'Backup code'
			: 'Welcome back'
	);
	const authPageDescription = $derived(
		isAwaitingSecondFactor ? undefined : 'Sign in to your Waiver Director account.'
	);

	function getSignInResource() {
		return clerk.client?.signIn ?? null;
	}

	function absoluteUrl(path: string) {
		return new URL(path, window.location.origin).toString();
	}

	function getSupportedSecondFactors(
		signInAttempt: NonNullable<ReturnType<typeof getSignInResource>>
	) {
		return Array.isArray(signInAttempt.supportedSecondFactors)
			? (signInAttempt.supportedSecondFactors as SupportedSecondFactor[])
			: [];
	}

	function resetSecondFactorState() {
		verificationCode = '';
		isAwaitingSecondFactor = false;
		secondFactorStrategy = null;
		primarySecondFactorStrategy = null;
		secondFactorEmailAddressId = null;
		secondFactorPhoneNumberId = null;
		backupCodeAvailable = false;
	}

	async function prepareSecondFactor(
		signIn: NonNullable<ReturnType<typeof getSignInResource>>,
		strategy: SecondFactorStrategy
	) {
		if (strategy === 'email_code') {
			await signIn.prepareSecondFactor({
				strategy,
				...(secondFactorEmailAddressId ? { emailAddressId: secondFactorEmailAddressId } : {})
			});
		} else if (strategy === 'phone_code') {
			await signIn.prepareSecondFactor({
				strategy,
				...(secondFactorPhoneNumberId ? { phoneNumberId: secondFactorPhoneNumberId } : {})
			});
		}

		secondFactorStrategy = strategy;
		isAwaitingSecondFactor = true;
		verificationCode = '';
		submitError = null;
		submitMessage = null;
	}

	async function startSecondFactorFlow(
		signIn: NonNullable<ReturnType<typeof getSignInResource>>,
		signInAttempt: NonNullable<ReturnType<typeof getSignInResource>>
	) {
		const supportedSecondFactors = getSupportedSecondFactors(signInAttempt);
		const emailCodeFactor = supportedSecondFactors.find(
			(factor): factor is SupportedSecondFactor & { strategy: 'email_code' } =>
				factor.strategy === 'email_code'
		);
		const phoneCodeFactor = supportedSecondFactors.find(
			(factor): factor is SupportedSecondFactor & { strategy: 'phone_code' } =>
				factor.strategy === 'phone_code'
		);
		const hasTOTP = supportedSecondFactors.some((factor) => factor.strategy === 'totp');
		const hasBackupCode = supportedSecondFactors.some(
			(factor) => factor.strategy === 'backup_code'
		);

		secondFactorEmailAddressId = emailCodeFactor?.emailAddressId ?? null;
		secondFactorPhoneNumberId = phoneCodeFactor?.phoneNumberId ?? null;
		backupCodeAvailable = hasBackupCode;

		const preferredStrategy =
			signInAttempt.status === 'needs_client_trust'
				? (emailCodeFactor?.strategy ?? phoneCodeFactor?.strategy ?? null)
				: hasTOTP
					? 'totp'
					: (emailCodeFactor?.strategy ?? phoneCodeFactor?.strategy ?? null);

		primarySecondFactorStrategy = preferredStrategy;

		if (preferredStrategy) {
			await prepareSecondFactor(signIn, preferredStrategy);
			return;
		}

		if (hasBackupCode) {
			await prepareSecondFactor(signIn, 'backup_code');
			return;
		}

		submitError = 'This account requires a second factor that is not supported by this form yet.';
	}

	async function activateCreatedSession(sessionId: string | null) {
		if (!sessionId || !clerk.clerk) {
			throw new Error('Your session was created, but no active session could be set.');
		}

		await clerk.clerk.setActive({
			session: sessionId,
			navigate: async ({ session, decorateUrl }) => {
				if (session?.currentTask) {
					return;
				}

				window.location.replace(decorateUrl(postAuthRedirectUrl));
			}
		});
	}

	async function handleGoogleSignIn() {
		if (clerk.auth.userId) {
			window.location.replace(postAuthRedirectUrl);
			return;
		}

		const signIn = getSignInResource();
		if (!clerk.isLoaded || !signIn) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		isSubmitting = true;
		submitError = null;
		submitMessage = null;

		try {
			await signIn.authenticateWithRedirect({
				strategy: 'oauth_google',
				redirectUrl: absoluteUrl(resolve('/sso-callback')),
				redirectUrlComplete: absoluteUrl(postAuthRedirectUrl)
			});
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to start Google sign-in right now.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		const signIn = getSignInResource();
		if (!clerk.isLoaded || !signIn) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		isSubmitting = true;
		resetSecondFactorState();
		submitError = null;
		submitMessage = null;

		try {
			const signInAttempt = await signIn.create({
				identifier: email.trim(),
				password
			});

			if (signInAttempt.status === 'complete') {
				await activateCreatedSession(signInAttempt.createdSessionId);
				return;
			}

			if (
				signInAttempt.status === 'needs_client_trust' ||
				signInAttempt.status === 'needs_second_factor'
			) {
				await startSecondFactorFlow(signIn, signInAttempt);
				return;
			}

			submitError = 'Unable to sign in right now. Please try again.';
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to sign in right now. Please try again.');
		} finally {
			isSubmitting = false;
		}
	}

	async function attemptSecondFactor() {
		const signIn = getSignInResource();
		if (!clerk.isLoaded || !signIn || !secondFactorStrategy) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		if (!verificationCode.trim()) {
			submitError = 'Enter your verification code to finish signing in.';
			return;
		}

		isSubmitting = true;
		submitError = null;
		submitMessage = null;

		try {
			const signInAttempt = await signIn.attemptSecondFactor({
				strategy: secondFactorStrategy,
				code: verificationCode.trim()
			});

			if (signInAttempt.status === 'complete') {
				await activateCreatedSession(signInAttempt.createdSessionId);
				return;
			}

			verificationCode = '';
			submitError = 'Verification is not complete yet. Please check the code and try again.';
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to verify your sign-in right now.');
			verificationCode = '';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSecondFactorSubmit(event: SubmitEvent) {
		event.preventDefault();
		await attemptSecondFactor();
	}

	async function resendSecondFactorCode() {
		const signIn = getSignInResource();
		if (!clerk.isLoaded || !signIn || !secondFactorStrategy) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		if (secondFactorStrategy !== 'email_code' && secondFactorStrategy !== 'phone_code') {
			return;
		}

		isSubmitting = true;
		submitError = null;

		try {
			await prepareSecondFactor(signIn, secondFactorStrategy);
			submitMessage =
				secondFactorStrategy === 'email_code'
					? 'We sent a new verification code to your email.'
					: 'We sent a new verification code to your phone.';
		} catch (error) {
			submitError = getClerkErrorMessage(
				error,
				'Unable to send a new verification code right now.'
			);
		} finally {
			isSubmitting = false;
		}
	}

	async function useBackupCode() {
		const signIn = getSignInResource();
		if (!clerk.isLoaded || !signIn || !backupCodeAvailable) {
			return;
		}

		try {
			await prepareSecondFactor(signIn, 'backup_code');
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to switch to a backup code right now.');
		}
	}

	async function usePrimarySecondFactor() {
		const signIn = getSignInResource();
		if (!clerk.isLoaded || !signIn || !primarySecondFactorStrategy) {
			return;
		}

		try {
			await prepareSecondFactor(signIn, primarySecondFactorStrategy);
		} catch (error) {
			submitError = getClerkErrorMessage(
				error,
				'Unable to switch back to your primary verification method right now.'
			);
		}
	}

	function restartSignIn() {
		resetSecondFactorState();
		submitError = null;
		submitMessage = null;
	}
</script>

<svelte:head>
	<title>Sign in | Waiver Director</title>
	<meta name="description" content="Sign in to Waiver Director account." />
</svelte:head>

<AuthPageShell title={authPageTitle} description={authPageDescription} width="narrow">
	{#if isAwaitingSecondFactor}
		<div class="mb-8">
			{#if secondFactorStrategy === 'email_code'}
				<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
					Enter the 6-digit code sent to <strong class="font-semibold text-foreground"
						>{email.trim()}</strong
					>.
				</p>
			{:else if secondFactorStrategy === 'phone_code'}
				<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
					Enter the 6-digit code sent to your phone.
				</p>
			{:else if secondFactorStrategy === 'totp'}
				<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
					Enter the 6-digit code from your authenticator app.
				</p>
			{:else if secondFactorStrategy === 'backup_code'}
				<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
					Enter one of your backup codes to finish signing in.
				</p>
			{/if}
		</div>

		<form class="space-y-4" method="post" onsubmit={handleSecondFactorSubmit}>
			<div>
				<div class="mb-3 flex items-center justify-between">
					<label for="sign-in-verification-code" class="text-sm font-medium">
						{secondFactorStrategy === 'backup_code' ? 'Backup code' : 'Verification code'}
					</label>
					{#if secondFactorStrategy === 'email_code' || secondFactorStrategy === 'phone_code'}
						<Button
							type="button"
							variant="outline"
							class="h-8 gap-1.5 rounded-lg border-(--m-border-strong) px-3 text-xs font-medium shadow-none"
							disabled={isSubmitting}
							onclick={resendSecondFactorCode}
						>
							<RefreshCw size={12} />
							Resend code
						</Button>
					{/if}
				</div>

				{#if secondFactorStrategy !== 'backup_code'}
					<InputOTP
						maxlength={6}
						inputId="sign-in-verification-code"
						bind:value={verificationCode}
						pattern={REGEXP_ONLY_DIGITS}
						onComplete={attemptSecondFactor}
						class="w-full"
					>
						{#snippet children({ cells })}
							<InputOTPGroup
								class="w-full *:data-[slot=input-otp-slot]:h-14 *:data-[slot=input-otp-slot]:flex-1 *:data-[slot=input-otp-slot]:text-xl"
							>
								{#each cells as cell, i (i)}
									<InputOTPSlot {cell} />
								{/each}
							</InputOTPGroup>
						{/snippet}
					</InputOTP>
				{:else}
					<Input
						id="sign-in-verification-code"
						name="code"
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						placeholder="Backup code"
						aria-label="Backup code"
						class={inputClass}
						bind:value={verificationCode}
					/>
				{/if}
			</div>

			<div class="space-y-3 pt-1">
				<Button type="submit" class={submitButtonClass} disabled={isSubmitting}>
					{isSubmitting ? 'Verifying...' : 'Verify and continue'}
				</Button>

				{#if backupCodeAvailable && secondFactorStrategy !== 'backup_code'}
					<Button
						type="button"
						variant="outline"
						class={secondaryButtonClass}
						disabled={isSubmitting}
						onclick={useBackupCode}
					>
						Use backup code
					</Button>
				{/if}

				{#if secondFactorStrategy === 'backup_code' && primarySecondFactorStrategy}
					<Button
						type="button"
						variant="outline"
						class={secondaryButtonClass}
						disabled={isSubmitting}
						onclick={usePrimarySecondFactor}
					>
						Use primary verification method
					</Button>
				{/if}

				<Button
					type="button"
					variant="outline"
					class={secondaryButtonClass}
					disabled={isSubmitting}
					onclick={restartSignIn}
				>
					Start over
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
		<form class="space-y-4" method="post" onsubmit={handleSubmit}>
			<Input
				id="sign-in-email"
				name="email"
				type="email"
				autocomplete="email"
				placeholder="Email"
				aria-label="Email"
				class={inputClass}
				bind:value={email}
			/>

			<div class="space-y-1.5">
				<Input
					id="sign-in-password"
					name="password"
					type="password"
					autocomplete="current-password"
					placeholder="Password"
					aria-label="Password"
					class={inputClass}
					bind:value={password}
				/>
				<a
					href={resolve('/forgot-password')}
					class="block pt-1 text-right text-xs font-semibold text-primary transition-[filter] hover:brightness-150 sm:text-sm"
				>
					Forgot password?
				</a>
			</div>

			<div class="space-y-3 pt-1">
				<Button type="submit" class={submitButtonClass} disabled={isSubmitting}>
					{isSubmitting ? 'Signing in...' : 'Sign in'}
				</Button>

				<div class="relative py-2">
					<div class="absolute inset-0 flex items-center" aria-hidden="true">
						<div class="w-full border-t border-(--m-border-soft)"></div>
					</div>
					<div class="relative flex justify-center">
						<span
							class="bg-(--m-surface) px-3 text-xs font-medium text-muted-foreground sm:text-sm"
						>
							or continue with
						</span>
					</div>
				</div>

				<Button
					type="button"
					variant="outline"
					class={`${secondaryButtonClass} cursor-pointer`}
					disabled={isSubmitting}
					onclick={handleGoogleSignIn}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true" class="h-5 w-5">
						<path
							fill="#4285F4"
							d="M21.6 12.227c0-.818-.073-1.604-.209-2.364H12v4.473h5.382a4.602 4.602 0 0 1-1.995 3.018v2.507h3.236c1.894-1.744 2.977-4.314 2.977-7.634Z"
						/>
						<path
							fill="#34A853"
							d="M12 22c2.7 0 4.964-.895 6.618-2.427l-3.236-2.507c-.895.6-2.041.954-3.382.954-2.597 0-4.796-1.754-5.582-4.11H3.073v2.586A9.997 9.997 0 0 0 12 22Z"
						/>
						<path
							fill="#FBBC04"
							d="M6.418 13.91A5.997 5.997 0 0 1 6.105 12c0-.663.114-1.304.313-1.91V7.504H3.073A9.997 9.997 0 0 0 2 12c0 1.61.386 3.135 1.073 4.496l3.345-2.586Z"
						/>
						<path
							fill="#EA4335"
							d="M12 5.98c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.959 2.997 14.695 2 12 2A9.997 9.997 0 0 0 3.073 7.504L6.418 10.09C7.204 7.734 9.403 5.98 12 5.98Z"
						/>
					</svg>
					Continue with Google
				</Button>

				{#if submitError}
					<p class="text-center text-sm text-destructive" role="status">{submitError}</p>
				{/if}

				<p class="text-center text-sm text-muted-foreground">
					Don't have an account?
					<a
						href={resolve('/sign-up')}
						class="font-semibold text-primary transition-[filter] hover:brightness-150"
					>
						Sign up
					</a>
				</p>
			</div>
		</form>
	{/if}
</AuthPageShell>
