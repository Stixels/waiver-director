<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

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

		if (!name || !email || !password) {
			submitError = 'Please complete all fields.';
			submitMessage = null;
			return;
		}

		isSubmitting = true;
		submitError = null;
		submitMessage = null;

		try {
			// TODO: replace with auth mutation/client call when signup is wired.
			await showSignUpNotReady({ name, email });
		} catch {
			submitError = 'Sign-up is temporarily unavailable. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="p-6">
	<h1>Sign up</h1>
	<p>Create the operator account first. Workspace setup is a separate step.</p>

	<form class="mt-4 max-w-sm space-y-4" onsubmit={handleSubmit}>
		<div class="space-y-2">
			<Label for="name">Name</Label>
			<Input id="name" name="name" type="text" autocomplete="name" placeholder="Alex Rivera" />
		</div>

		<div class="space-y-2">
			<Label for="email">Email</Label>
			<Input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				placeholder="owner@venue.com"
			/>
		</div>

		<div class="space-y-2">
			<Label for="password">Password</Label>
			<Input
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				placeholder="••••••••"
			/>
		</div>

		<Button type="submit" disabled={isSubmitting}>
			{isSubmitting ? 'Creating account...' : 'Create account'}
		</Button>

		<div aria-live="polite" aria-atomic="true">
			{#if submitMessage}
				<p class="text-sm text-muted-foreground" role="status">{submitMessage}</p>
			{:else if submitError}
				<p class="text-sm text-destructive" role="status">{submitError}</p>
			{/if}
		</div>
	</form>

	<p class="mt-4 text-sm text-muted-foreground">
		After sign-up, the user will create or join a workspace.
		<a href={resolve('/workspaces/new')} class="ml-1 underline underline-offset-4">
			Workspace setup placeholder
		</a>
	</p>

	<p class="mt-2 text-sm text-muted-foreground">
		Already have access?
		<a href={resolve('/sign-in')} class="underline underline-offset-4">Sign in</a>
	</p>
</div>
