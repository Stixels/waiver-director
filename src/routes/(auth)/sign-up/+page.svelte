<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		// TODO: call sign-up mutation / auth client (e.g. Convex + Clerk or Better Auth) with form values
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

		<Button type="submit">Create account</Button>
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
