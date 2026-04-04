<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChartLine, FileText, Link2, Mail, ShieldCheck } from '@lucide/svelte';

	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	const inputClass =
		'h-14 rounded-xl border-(--m-border-strong) bg-(--m-elevated) px-4 text-sm text-foreground shadow-none transition-[border-color,box-shadow] placeholder:text-(--m-text-3) focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 sm:px-5 md:text-sm';
	const submitButtonClass =
		'btn-mkt-accent h-14 w-full rounded-xl text-base font-semibold shadow-none';

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

	let isSubmitting = $state(false);
	let submitMessage = $state<string | null>(null);
	let submitError = $state<string | null>(null);

	async function showSignUpNotReady(formValues: { name: string; email: string }) {
		submitMessage = `Thanks, ${formValues.name || formValues.email}. Sign-up is coming soon.`;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) {
			submitError = 'Unable to submit right now. Please try again.';
			return;
		}

		const formData = new FormData(form);
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '').trim();
		const passwordConfirm = String(formData.get('password_confirm') ?? '').trim();

		if (!name || !email || !password || !passwordConfirm) {
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
			await showSignUpNotReady({ name, email });
		} catch {
			submitError = 'Sign-up is temporarily unavailable. Please try again.';
		} finally {
			isSubmitting = false;
		}
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
						Everything you need to run your escape room.
					</h2>
					<p class="text-sm leading-relaxed text-muted-foreground sm:text-base">
						Waivers, bookings, and follow-ups — managed in one place so you can focus on the game.
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

				<form class="space-y-4" onsubmit={handleSubmit}>
					<Input
						id="sign-up-name"
						name="name"
						type="text"
						autocomplete="name"
						placeholder="Full Name"
						aria-label="Name"
						class={inputClass}
					/>

					<Input
						id="sign-up-email"
						name="email"
						type="email"
						autocomplete="email"
						placeholder="Email"
						aria-label="Email"
						class={inputClass}
					/>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
						<Input
							id="sign-up-password"
							name="password"
							type="password"
							autocomplete="new-password"
							placeholder="Password"
							aria-label="Password"
							class={`${inputClass} min-w-0`}
						/>
						<Input
							id="sign-up-password-confirm"
							name="password_confirm"
							type="password"
							autocomplete="new-password"
							placeholder="Confirm password"
							aria-label="Confirm password"
							class={`${inputClass} min-w-0`}
						/>
					</div>

					<div class="space-y-3 pt-1">
						<Button type="submit" class={submitButtonClass} disabled={isSubmitting}>
							{isSubmitting ? 'Creating account...' : 'Create account'}
						</Button>

						<div aria-live="polite" aria-atomic="true">
							{#if submitMessage}
								<p class="text-center text-sm text-muted-foreground" role="status">
									{submitMessage}
								</p>
							{:else if submitError}
								<p class="text-center text-sm text-destructive" role="status">{submitError}</p>
							{/if}
						</div>
						<div class="relative py-2">
							<div class="absolute inset-0 flex items-center" aria-hidden="true">
								<div class="w-full border-t border-(--m-border-soft)"></div>
							</div>
							<div class="relative flex justify-center">
								<span
									class="bg-(--m-surface) px-3 text-xs font-medium text-muted-foreground sm:text-sm"
								>
								</span>
							</div>
						</div>

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
