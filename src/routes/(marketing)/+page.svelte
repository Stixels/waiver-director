<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="p-6">
	<h1>Waiver Director</h1>
	<p>Foundation placeholder page.</p>
	<p>The app now has route groups, Convex schema scaffolding, and placeholder flows.</p>

	<div class="mt-4 flex gap-2">
		<Button href={resolve('/sign-up')}>Sign up</Button>
		<Button href={resolve('/sign-in')} variant="outline">Sign in</Button>
		<Button href={resolve('/app')} variant="outline">Open app shell</Button>
	</div>
</div>
