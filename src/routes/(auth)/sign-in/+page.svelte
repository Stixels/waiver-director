<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
</script>

<div class="p-6">
	<h1>Sign in</h1>
	<p>Placeholder route for future auth wiring.</p>

	<div class="mt-4 max-w-sm space-y-4">
		<div class="space-y-2">
			<Label for="email">Email</Label>
			<Input id="email" type="email" placeholder="operator@venue.com" />
		</div>

		<div class="space-y-2">
			<Label for="password">Password</Label>
			<Input id="password" type="password" placeholder="••••••••" />
		</div>

		<Button disabled>Coming in phase 2</Button>
	</div>

	<p class="mt-4 text-sm text-muted-foreground">
		Need an account?
		<a href={resolve('/sign-up')} class="underline underline-offset-4">Sign up</a>
	</p>
</div>
