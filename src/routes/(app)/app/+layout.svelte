<script lang="ts">
	import { resolve } from '$app/paths';
	import { appNavigation } from '$lib/domain/navigation';

	let { children } = $props();
</script>

<div class="p-6">
	<header>
		<h1>App shell</h1>
		<p>Protected workspace area placeholder.</p>
	</header>

	<div class="mt-6 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
		<nav class="space-y-1">
			{#each appNavigation as item (item.label)}
				<a href={resolve(item.href)} class="block text-sm underline underline-offset-4">
					{item.label}
				</a>
			{/each}
		</nav>

		<div>
			{@render children()}
		</div>
	</div>
</div>
