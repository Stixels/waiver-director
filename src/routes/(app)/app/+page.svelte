<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
</script>

<div>
	<h2>Dashboard placeholder</h2>
	<p>Auth and tenancy wiring are next.</p>
	<p>Campaigns, sessions, waivers, and analytics come later.</p>

	<div class="mt-4">
		<Button variant="outline" href={resolve('/w/sample-waiver')}>Open sample waiver route</Button>
	</div>
</div>
