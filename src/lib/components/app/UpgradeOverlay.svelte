<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole';

	interface Props {
		title: string;
		description: string;
		href: string;
		actionLabel?: string;
		class?: string;
	}

	let {
		title,
		description,
		href,
		actionLabel = 'View billing',
		class: className = ''
	}: Props = $props();
</script>

<div
	class={cn(
		'absolute inset-0 z-30 flex items-center justify-center bg-background/72 p-4 backdrop-blur-[2px]',
		className
	)}
	role="dialog"
	aria-modal="true"
	aria-labelledby="upgrade-overlay-title"
	aria-describedby="upgrade-overlay-description"
>
	<div
		class="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl shadow-foreground/10"
	>
		<div class="border-b border-border bg-muted/30 px-5 py-4">
			<div class="flex items-center gap-3">
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary"
					aria-hidden="true"
				>
					<LockKeyholeIcon class="size-4" />
				</div>
				<div class="min-w-0">
					<p class="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
						Pro feature
					</p>
					<h2 id="upgrade-overlay-title" class="mt-0.5 text-base font-semibold tracking-tight">
						{title}
					</h2>
				</div>
			</div>
		</div>

		<div class="px-5 py-4">
			<p id="upgrade-overlay-description" class="text-sm leading-relaxed text-muted-foreground">
				{description}
			</p>
			<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
				<Button {href} class="h-8 w-full justify-center sm:w-auto">
					<CreditCardIcon class="size-3.5" aria-hidden="true" />
					{actionLabel}
					<ArrowRightIcon class="size-3.5" aria-hidden="true" />
				</Button>
				<p class="text-xs text-muted-foreground">
					Plans and trials are managed in account billing.
				</p>
			</div>
		</div>
	</div>
</div>
