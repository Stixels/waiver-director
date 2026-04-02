<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';

	const slug = $derived(page.params.slug);
</script>

<div class="p-6">
	<h1>Public waiver route</h1>
	<p>Placeholder page for a future campaign signing flow.</p>
	<p class="mt-2">Resolved slug: {slug}</p>

	<div class="mt-4">
		<Button href={resolve('/')} variant="outline">Back to landing page</Button>
	</div>
</div>
