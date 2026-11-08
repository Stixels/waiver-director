<script lang="ts">
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '$convex/_generated/api';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';

	type Submission = NonNullable<FunctionReturnType<typeof api.waivers.getSubmission>>;

	interface Props {
		audit: Submission['audit'];
	}

	let { audit }: Props = $props();

	const rowLabelClass = 'text-[11px] font-semibold tracking-wide text-muted-foreground uppercase';
	const rowValueClass = 'min-w-0 text-xs break-words text-foreground';
	// Hashes and user agents are long unbroken strings; let them wrap anywhere.
	const rowCodeClass = `${rowValueClass} [overflow-wrap:anywhere]`;

	function formatTimestamp(ts: number | null) {
		if (ts === null) return 'Not recorded';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			// 'long' includes seconds and the time zone; dateStyle cannot be combined with timeZoneName.
			timeStyle: 'long'
		}).format(new Date(ts));
	}
</script>

<section class="mx-auto max-w-3xl px-4 pb-10 sm:px-6" aria-labelledby="audit-trail-heading">
	<div class="rounded-xl border border-border bg-background p-4 sm:p-5">
		<h3
			id="audit-trail-heading"
			class="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight"
		>
			<ShieldCheckIcon class="size-4 text-muted-foreground" aria-hidden="true" />
			Audit trail
		</h3>

		{#if !audit}
			<p class="text-xs text-muted-foreground">
				No audit trail was recorded. This waiver was signed before audit capture was added.
			</p>
		{:else}
			<dl class="grid gap-x-6 gap-y-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
				<dt class={rowLabelClass}>Received by server</dt>
				<dd class={rowValueClass}>{formatTimestamp(audit.receivedAt)}</dd>

				<dt class={rowLabelClass}>IP address</dt>
				<dd class={rowValueClass}>{audit.ipAddress ?? 'Not recorded'}</dd>

				{#if audit.forwardedFor && audit.forwardedFor !== audit.ipAddress}
					<dt class={rowLabelClass}>Forwarded for</dt>
					<dd class={rowCodeClass}>{audit.forwardedFor}</dd>
				{/if}

				<dt class={rowLabelClass}>Device / browser</dt>
				<dd class={rowCodeClass}>{audit.userAgent ?? 'Not recorded'}</dd>

				<dt class={rowLabelClass}>Document hash</dt>
				<dd class={`${rowCodeClass} font-mono`}>
					{audit.hashAlgorithm}: {audit.documentHash}
				</dd>

				<dt class={rowLabelClass}>Record hash</dt>
				<dd class={`${rowCodeClass} font-mono`}>
					{audit.hashAlgorithm}: {audit.submissionHash}
				</dd>

				<dt class={rowLabelClass}>E-signature consent</dt>
				<dd class={rowValueClass}>“{audit.electronicSignatureConsentText}”</dd>

				<dt class={rowLabelClass}>Form opened</dt>
				<dd class={rowValueClass}>{formatTimestamp(audit.clientFormOpenedAt)}</dd>

				<dt class={rowLabelClass}>Consent accepted</dt>
				<dd class={rowValueClass}>{formatTimestamp(audit.clientConsentAcceptedAt)}</dd>

				<dt class={rowLabelClass}>Signature drawn</dt>
				<dd class={rowValueClass}>{formatTimestamp(audit.clientSignatureCompletedAt)}</dd>
			</dl>
			<p class="mt-4 text-[11px] leading-relaxed text-muted-foreground">
				IP address, device, hashes and the server time are recorded by Waiver Director. Form opened,
				consent and signature times are reported by the signer's browser.
			</p>
		{/if}
	</div>
</section>
