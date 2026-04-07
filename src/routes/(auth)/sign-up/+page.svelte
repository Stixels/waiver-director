<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ChartLine, FileText, Link2, Mail, ShieldCheck } from '@lucide/svelte';
	import { useClerkContext } from 'svelte-clerk';

	import {
		getClerkErrorMessage,
		getResolvedClerkNavigationPath,
		getSafePostAuthRedirectHref
	} from '$lib/auth/clerk-helpers';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	const inputClass =
		'h-14 rounded-xl border-(--m-border-strong) bg-(--m-elevated) px-4 text-sm text-foreground shadow-none transition-[border-color,box-shadow] placeholder:text-(--m-text-3) focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 sm:px-5 md:text-sm';
	const submitButtonClass =
		'btn-mkt-accent h-14 w-full rounded-xl text-base font-semibold shadow-none';
	const googleButtonClass =
		'h-14 w-full rounded-xl border-(--m-border-strong) bg-(--m-elevated) text-base font-semibold shadow-none transition-colors hover:bg-(--m-card)';

	const features = [
		{
			icon: FileText,
			title: 'Digital Waivers',
			description: 'Paperless signing on any device. Every version is locked and audit-trailed.'
		},
		{
			icon: Link2,
			title: 'Booking Sync',
			description: 'Connects to Bookeo, Resova, and Xola so sessions stay in sync automatically.'
		},
		{
			icon: Mail,
			title: 'Email Automation',
			description: 'Follow-up emails, thank-yous, and review requests sent to every participant.'
		},
		{
			icon: ChartLine,
			title: 'Completion Analytics',
			description: 'Track signed vs. expected counts, completion rates, and submission trends.'
		}
	];

	const clerk = useClerkContext();

	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let verificationCode = $state('');
	let isSubmitting = $state(false);
	let submitMessage = $state<string | null>(null);
	let submitError = $state<string | null>(null);
	let isAwaitingVerification = $state(false);
	const redirectTo = $derived(page.url.searchParams.get('redirectTo'));
	const postAuthRedirectUrl = $derived(getSafePostAuthRedirectHref(redirectTo));

	const canSubmitEmailSignUp = $derived(Boolean(email.trim() && password && passwordConfirm));

	function getSignUpResource() {
		return clerk.client?.signUp ?? null;
	}

	async function activateCreatedSession(sessionId: string | null) {
		if (!sessionId || !clerk.clerk) {
			throw new Error('Your account was created, but no session was returned.');
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

	async function handleGoogleSignUp() {
		if (clerk.auth.userId) {
			window.location.assign(postAuthRedirectUrl);
			return;
		}

		const signUp = getSignUpResource();
		if (!clerk.isLoaded || !signUp) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		isSubmitting = true;
		submitError = null;
		submitMessage = null;

		try {
			await signUp.authenticateWithRedirect({
				strategy: 'oauth_google',
				redirectUrl: resolve('/sso-callback'),
				redirectUrlComplete: postAuthRedirectUrl
			});
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to start Google sign-up right now.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		const signUp = getSignUpResource();
		if (!clerk.isLoaded || !signUp) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		if (!email.trim() || !password || !passwordConfirm) {
			submitError = 'Please complete all fields.';
			submitMessage = null;
			return;
		}

		if (password !== passwordConfirm) {
			submitError = 'Passwords do not match.';
			submitMessage = null;
			return;
		}

		isSubmitting = true;
		submitError = null;
		submitMessage = null;

		try {
			await signUp.create({
				emailAddress: email.trim(),
				password
			});

			await signUp.prepareEmailAddressVerification({
				strategy: 'email_code'
			});

			isAwaitingVerification = true;
			submitMessage = `We sent a verification code to ${email.trim()}.`;
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to create your account right now.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleVerificationSubmit(event: SubmitEvent) {
		event.preventDefault();

		const signUp = getSignUpResource();
		if (!clerk.isLoaded || !signUp) {
			submitError = 'Authentication is still loading. Please try again.';
			return;
		}

		if (!verificationCode.trim()) {
			submitError = 'Enter the verification code from your email.';
			return;
		}

		isSubmitting = true;
		submitError = null;

		try {
			const signUpAttempt = await signUp.attemptEmailAddressVerification({
				code: verificationCode.trim()
			});

			if (signUpAttempt.status === 'complete') {
				await activateCreatedSession(signUpAttempt.createdSessionId);
				return;
			}

			submitError = 'Verification is not complete yet. Please check the code and try again.';
		} catch (error) {
			submitError = getClerkErrorMessage(error, 'Unable to verify your email right now.');
		} finally {
			isSubmitting = false;
		}
	}

	function restartSignUp() {
		isAwaitingVerification = false;
		verificationCode = '';
		submitError = null;
		submitMessage = null;
	}
</script>

<svelte:head>
	<title>Sign up | Waiver Director</title>
	<meta
		name="description"
		content="Create a Waiver Director operator account. Workspace setup comes after sign-up."
	/>
</svelte:head>

<section
	class="auth-page relative flex min-h-[calc(100svh-var(--mkt-nav-offset))] flex-col items-center justify-start overflow-hidden px-4 pb-24 sm:px-8"
>
	<div class="auth-page__grid absolute inset-0 opacity-40" aria-hidden="true"></div>

	<div
		class="mkt-blob-float-a pointer-events-none absolute top-[8%] left-[-8%] h-[320px] w-[320px] rounded-full blur-[72px] md:h-[400px] md:w-[400px] md:blur-[88px]"
		style="background: oklch(0.52 0.22 277 / 16%);"
		aria-hidden="true"
	></div>
	<div
		class="mkt-blob-float-b pointer-events-none absolute right-[-12%] bottom-[18%] h-[280px] w-[280px] rounded-full blur-3xl md:h-[360px] md:w-[360px] md:blur-[80px]"
		style="background: oklch(0.52 0.22 277 / 10%);"
		aria-hidden="true"
	></div>

	<div class="relative z-10 w-full max-w-5xl shrink-0 pt-12 pb-6 sm:pt-16 sm:pb-8">
		<div
			class="overflow-hidden rounded-xl border border-(--m-border-strong) bg-(--m-surface) sm:rounded-2xl lg:grid lg:grid-cols-[1fr_1.1fr]"
			style="box-shadow: 0 18px 40px oklch(0 0 0 / 42%);"
		>
			<!-- Left: Feature marketing panel (hidden on mobile) -->
			<div
				class="signup-panel relative hidden flex-col gap-8 overflow-hidden border-b border-(--m-border-soft) px-9 py-10 sm:px-12 sm:py-12 lg:flex lg:border-r lg:border-b-0"
				style="background: linear-gradient(145deg, var(--m-accent-soft) 0%, var(--m-card) 55%);"
			>
				<div
					class="pointer-events-none absolute top-0 right-0 h-56 w-56 rounded-full blur-[80px]"
					style="background: var(--m-accent-dim);"
					aria-hidden="true"
				></div>
				<div
					class="pointer-events-none absolute inset-x-0 top-0 h-px"
					style="background: linear-gradient(90deg, transparent, var(--m-accent-line), transparent);"
					aria-hidden="true"
				></div>

				<div class="relative">
					<p class="mb-3 text-xs font-bold tracking-widest text-primary uppercase">
						Waiver Director
					</p>
					<h2
						class="signup-panel__heading mb-3 font-black tracking-tight text-balance"
						style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.5rem, 3.5vw, 2rem); letter-spacing: -0.03em; line-height: 1.15;"
					>
						Everything you need to run your business.
					</h2>
					<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
						Waivers, bookings, and follow-ups — managed in one place so you can focus on what
						matters.
					</p>
				</div>

				<ul class="relative flex flex-col gap-5" role="list">
					{#each features as feature (feature.title)}
						{@const Icon = feature.icon}
						<li class="flex items-start gap-4">
							<div
								class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
								style="background: var(--m-accent-medium);"
								aria-hidden="true"
							>
								<Icon size={17} style="color: var(--primary);" />
							</div>
							<div>
								<p class="text-sm font-semibold">{feature.title}</p>
								<p class="text-xs leading-relaxed text-muted-foreground sm:text-sm">
									{feature.description}
								</p>
							</div>
						</li>
					{/each}
				</ul>

				<div
					class="relative mt-auto flex items-start gap-3 rounded-xl border border-(--m-border-soft) px-4 py-3"
					style="background: var(--m-elevated);"
				>
					<ShieldCheck size={16} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
					<p class="text-xs leading-relaxed text-muted-foreground">
						No credit card required to get started. Cancel anytime.
					</p>
				</div>
			</div>

			<!-- Right: Form -->
			<div class="px-9 py-10 sm:px-12 sm:py-12">
				<div class="mb-8">
					<h1
						class="mb-2 font-black tracking-tight"
						style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.5rem, 4vw, 2rem); letter-spacing: -0.03em; line-height: 1.15;"
					>
						Create your account
					</h1>
					<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
						The operator account comes first. Workspace setup is a separate step.
					</p>
				</div>

				{#if isAwaitingVerification}
					<form class="space-y-4" onsubmit={handleVerificationSubmit}>
						<div class="rounded-xl border border-(--m-border-soft) bg-(--m-elevated) px-4 py-3">
							<p class="text-sm font-medium">Check your email</p>
							<p class="mt-1 text-sm text-muted-foreground">
								Enter the verification code sent to {email.trim()} to finish creating your account.
							</p>
						</div>

						<Input
							id="sign-up-verification-code"
							name="code"
							type="text"
							inputmode="numeric"
							autocomplete="one-time-code"
							placeholder="Verification code"
							aria-label="Verification code"
							class={inputClass}
							bind:value={verificationCode}
						/>

						<div class="space-y-3 pt-1">
							<Button type="submit" class={submitButtonClass} disabled={isSubmitting}>
								{isSubmitting ? 'Verifying...' : 'Verify email'}
							</Button>

							<Button
								type="button"
								variant="outline"
								class="h-14 w-full rounded-xl border-(--m-border-strong) text-base font-semibold shadow-none"
								onclick={restartSignUp}
							>
								Use a different email
							</Button>

							{#if submitMessage}
								<p class="text-center text-sm text-muted-foreground" role="status">
									{submitMessage}
								</p>
							{/if}

							{#if submitError}
								<p class="text-center text-sm text-destructive" role="status">{submitError}</p>
							{/if}

							<p class="text-center text-sm text-muted-foreground">
								Already have an account?
								<a
									href={resolve('/sign-in')}
									class="font-semibold text-primary transition-[filter] hover:brightness-125"
								>
									Sign in
								</a>
							</p>
						</div>
					</form>
				{:else}
					<form class="space-y-4" onsubmit={handleSubmit}>
						<Input
							id="sign-up-email"
							name="email"
							type="email"
							autocomplete="email"
							placeholder="Email"
							aria-label="Email"
							required
							class={inputClass}
							bind:value={email}
						/>

						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
							<Input
								id="sign-up-password"
								name="password"
								type="password"
								autocomplete="new-password"
								placeholder="Password"
								aria-label="Password"
								required
								class={`${inputClass} min-w-0`}
								bind:value={password}
							/>
							<Input
								id="sign-up-password-confirm"
								name="password_confirm"
								type="password"
								autocomplete="new-password"
								placeholder="Confirm password"
								aria-label="Confirm password"
								required
								class={`${inputClass} min-w-0`}
								bind:value={passwordConfirm}
							/>
						</div>

						<div class="space-y-3 pt-1">
							<Button
								type="submit"
								class={submitButtonClass}
								disabled={isSubmitting || !canSubmitEmailSignUp}
							>
								{isSubmitting ? 'Creating account...' : 'Create account'}
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
								class={`${googleButtonClass} cursor-pointer`}
								disabled={isSubmitting}
								onclick={handleGoogleSignUp}
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

							{#if submitMessage}
								<p class="text-center text-sm text-muted-foreground" role="status">
									{submitMessage}
								</p>
							{/if}

							{#if submitError}
								<p class="text-center text-sm text-destructive" role="status">{submitError}</p>
							{/if}

							<p class="text-center text-sm text-muted-foreground">
								Already have an account?
								<a
									href={resolve('/sign-in')}
									class="font-semibold text-primary transition-[filter] hover:brightness-125"
								>
									Sign in
								</a>
							</p>
						</div>
					</form>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	@keyframes auth-blob-float-a {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(12px, -10px);
		}
	}

	@keyframes auth-blob-float-b {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(-10px, 12px);
		}
	}

	.auth-page__grid {
		background-image: radial-gradient(circle, oklch(1 0 0 / 14%) 1px, transparent 1px);
		background-size: 24px 24px;
	}

	:global(.mkt-blob-float-a) {
		animation: auth-blob-float-a 14s ease-in-out infinite;
	}

	:global(.mkt-blob-float-b) {
		animation: auth-blob-float-b 18s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.mkt-blob-float-a),
		:global(.mkt-blob-float-b) {
			animation: none;
		}
	}
</style>
