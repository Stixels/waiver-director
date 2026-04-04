<script lang="ts">
	import { resolve } from '$app/paths';
	import AuthPageShell from '$lib/components/marketing/auth/AuthPageShell.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	const inputClass =
		'h-14 rounded-xl border-(--m-border-strong) bg-(--m-elevated) px-4 text-sm text-foreground shadow-none transition-[border-color,box-shadow] placeholder:text-(--m-text-3) focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 sm:px-5 md:text-sm';
	const submitButtonClass =
		'btn-mkt-accent h-14 w-full rounded-xl text-base font-semibold shadow-none';
</script>

<svelte:head>
	<title>Sign in | Waiver Director</title>
	<meta name="description" content="Sign in to Waiver Director account." />
</svelte:head>

<AuthPageShell
	title="Welcome back"
	description="Sign in to your Waiver Director account."
	width="narrow"
>
	<form class="space-y-4" method="post" onsubmit={(e) => e.preventDefault()}>
		<Input
			id="sign-in-email"
			name="email"
			type="email"
			autocomplete="email"
			placeholder="Email"
			aria-label="Email"
			class={inputClass}
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
			/>
			<a
				href={resolve('/forgot-password')}
				class="block pt-1 text-right text-xs font-semibold text-primary transition-[filter] hover:brightness-150 sm:text-sm"
			>
				Forgot password?
			</a>
		</div>

		<div class="space-y-3 pt-1">
			<Button type="submit" class={submitButtonClass}>Sign in</Button>

			<div class="relative py-2">
				<div class="absolute inset-0 flex items-center" aria-hidden="true">
					<div class="w-full border-t border-(--m-border-soft)"></div>
				</div>
				<div class="relative flex justify-center">
					<span class="bg-(--m-surface) px-3 text-xs font-medium text-muted-foreground sm:text-sm">
					</span>
				</div>
			</div>

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
</AuthPageShell>
