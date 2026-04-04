<script lang="ts">
	import AuthPageShell from '$lib/components/marketing/auth/AuthPageShell.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	const inputClass =
		'h-14 rounded-xl border-(--m-border-strong) bg-(--m-elevated) px-4 text-sm text-foreground shadow-none transition-[border-color,box-shadow] placeholder:text-(--m-text-3) focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 sm:px-5 md:text-sm';
	const submitButtonClass =
		'btn-mkt-accent h-14 w-full rounded-xl text-base font-semibold shadow-none';
	const backButtonClass =
		'btn-mkt-outline h-14 w-full rounded-xl border-(--m-border-strong) text-base font-semibold shadow-none';
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
	description="Enter the email on your account and we'll send a secure reset link."
	width="narrow"
>
	<form class="space-y-4" method="post" onsubmit={(e) => e.preventDefault()}>
		<Input
			id="reset-email"
			name="email"
			type="email"
			autocomplete="email"
			placeholder="Email"
			aria-label="Email"
			class={inputClass}
		/>

		<div class="space-y-3 pt-1">
			<Button type="submit" class={submitButtonClass}>
				Send reset link
			</Button>

			<Button href="/sign-in" variant="outline" class={`${backButtonClass} mt-2`}>
				Back to sign in
			</Button>
		</div>
	</form>
</AuthPageShell>
