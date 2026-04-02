<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
</script>

<div class="p-6">
	<h1>Workspace setup</h1>
	<p>This is separate from account sign-up. It will become the business onboarding step.</p>

	<div class="mt-4 max-w-sm space-y-4">
		<div class="space-y-2">
			<Label for="business-name">Business name</Label>
			<Input id="business-name" placeholder="Atlas Escape & VR" />
		</div>

		<div class="space-y-2">
			<Label for="workspace-slug">Workspace slug</Label>
			<Input id="workspace-slug" placeholder="atlas-escape" />
		</div>

		<Button disabled>Workspace onboarding coming in phase 2</Button>
	</div>

	<p class="mt-4 text-sm text-muted-foreground">
		Back to
		<a href={resolve('/sign-up')} class="underline underline-offset-4">sign up</a>
	</p>
</div>
