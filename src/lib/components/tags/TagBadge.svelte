<script lang="ts">
	import { cn } from '$lib/utils';
	import XIcon from '@lucide/svelte/icons/x';
	import { tagColorClass, type TagColor } from './tag-colors';

	interface Props {
		name: string;
		color: TagColor;
		class?: string;
		onRemove?: () => void;
	}

	let { name, color, class: className, onRemove }: Props = $props();
</script>

<span
	class={cn(
		'inline-flex max-w-40 shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium tracking-wide',
		tagColorClass(color),
		className
	)}
>
	<span class="truncate">{name}</span>
	{#if onRemove}
		<button
			type="button"
			class="-mr-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
			aria-label={`Remove tag ${name}`}
			onclick={(event) => {
				event.stopPropagation();
				onRemove();
			}}
		>
			<XIcon class="size-2.5" aria-hidden="true" />
		</button>
	{/if}
</span>
