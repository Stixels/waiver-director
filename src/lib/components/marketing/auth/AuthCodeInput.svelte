<script lang="ts">
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';
	import { InputOTP, InputOTPGroup, InputOTPSlot } from '$lib/components/ui/input-otp';

	let {
		id,
		value = $bindable(''),
		onComplete
	}: { id: string; value?: string; onComplete: () => void } = $props();
</script>

<InputOTP
	maxlength={6}
	inputId={id}
	bind:value
	pattern={REGEXP_ONLY_DIGITS}
	{onComplete}
	class="w-full"
>
	{#snippet children({ cells })}
		<InputOTPGroup
			class="w-full *:data-[slot=input-otp-slot]:h-14 *:data-[slot=input-otp-slot]:flex-1 *:data-[slot=input-otp-slot]:text-xl"
		>
			{#each cells as cell, i (i)}
				<InputOTPSlot {cell} />
			{/each}
		</InputOTPGroup>
	{/snippet}
</InputOTP>
