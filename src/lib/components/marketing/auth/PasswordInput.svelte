<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { Eye, EyeOff } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils';

	type Props = Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & {
		value?: string;
		class?: string;
	};

	let { value = $bindable(''), class: className, ...restProps }: Props = $props();

	let visible = $state(false);
</script>

<div class="relative min-w-0">
	<Input
		{...restProps}
		type={visible ? 'text' : 'password'}
		autocapitalize="none"
		spellcheck={false}
		class={cn(className, 'pr-12 sm:pr-12')}
		bind:value
	/>
	<button
		type="button"
		class="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
		aria-label={visible ? 'Hide password' : 'Show password'}
		aria-pressed={visible}
		onclick={() => (visible = !visible)}
	>
		{#if visible}
			<EyeOff class="size-4" aria-hidden="true" />
		{:else}
			<Eye class="size-4" aria-hidden="true" />
		{/if}
	</button>
</div>
