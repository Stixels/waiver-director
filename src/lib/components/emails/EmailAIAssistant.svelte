<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { EmailAIResult } from '$lib/domain/email-ai';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import GitCompareIcon from '@lucide/svelte/icons/git-compare';

	interface Props {
		workspaceId: Id<'workspaces'>;
		workspaceSlug: string;
		subject: string;
		body: string;
		sendAfterAmount: number;
		sendAfterUnit: 'minutes' | 'hours' | 'days';
		canReview: boolean;
		result: EmailAIResult | null;
		onResult: (result: EmailAIResult) => void;
		onReopen: () => void;
		onDiscard: () => void;
	}

	let {
		workspaceId,
		workspaceSlug,
		subject,
		body,
		sendAfterAmount,
		sendAfterUnit,
		canReview,
		result,
		onResult,
		onReopen,
		onDiscard
	}: Props = $props();

	let goal = $state('');
	let isReviewing = $state(false);
	let errorMessage = $state<string | null>(null);

	const trimmedGoal = $derived(goal.trim());
	const scoreTone = $derived.by(() => {
		if (!result) return 'idle';
		if (result.score >= 82) return 'strong';
		if (result.score >= 65) return 'ok';
		return 'needs-work';
	});
	const verdict = $derived.by(() => {
		if (scoreTone === 'strong') return 'Strong draft';
		if (scoreTone === 'ok') return 'Solid, room to improve';
		if (scoreTone === 'needs-work') return 'Needs work';
		return '';
	});

	async function reviewEmail() {
		if (!canReview || isReviewing) return;
		isReviewing = true;
		errorMessage = null;
		try {
			const response = await fetch(resolve(`/app/${workspaceSlug}/emails/ai` as const), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					workspaceId,
					subject,
					body,
					sendAfterAmount,
					sendAfterUnit,
					goal: trimmedGoal
				})
			});
			const payload = (await response.json().catch(() => null)) as
				| (EmailAIResult & { message?: string })
				| null;
			if (!response.ok) {
				throw new Error(payload?.message ?? 'Unable to review this email.');
			}
			if (!payload) {
				throw new Error('AI response was empty.');
			}
			onResult(payload);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to review this email.';
		} finally {
			isReviewing = false;
		}
	}
</script>

<section class="ai-panel">
	<div class="ai-panel-head">
		<div class="ai-title-row">
			<span class="ai-mark"><SparklesIcon class="size-3.5" /></span>
			<p class="rail-label ai-label">AI review</p>
		</div>
		{#if result}
			<span class="ai-score" data-tone={scoreTone}>{result.score}</span>
		{/if}
	</div>

	<label class="ai-goal-label" for="email-ai-goal">Goal</label>
	<Textarea
		id="email-ai-goal"
		bind:value={goal}
		rows={3}
		maxlength={240}
		placeholder="Review ask, arrival reminder, thank-you..."
		class="ai-goal-input"
	/>

	<Button
		type="button"
		size="sm"
		class="ai-review-btn w-full justify-center text-xs"
		disabled={!canReview || isReviewing}
		onclick={() => void reviewEmail()}
	>
		{#if isReviewing}
			<LoaderIcon class="size-3.5 animate-spin" />
			Reviewing
		{:else}
			<SparklesIcon class="size-3.5" />
			Review email
		{/if}
	</Button>

	{#if errorMessage}
		<p class="ai-error"><AlertCircleIcon class="size-3.5" /> {errorMessage}</p>
	{/if}

	{#if result}
		<div class="ai-result-card">
			<div class="ai-result-head">
				<span class="ai-result-score" data-tone={scoreTone}>{result.score}</span>
				<div class="ai-result-text">
					<p class="ai-result-title">Proposal ready</p>
					<p class="ai-result-copy">{verdict}</p>
				</div>
			</div>
			<div class="ai-result-actions">
				<Button
					type="button"
					size="sm"
					class="ai-result-view w-full justify-center text-xs"
					onclick={onReopen}
				>
					<GitCompareIcon class="size-3.5" />
					View changes
				</Button>
				<button type="button" class="ai-result-discard" onclick={onDiscard}>Discard</button>
			</div>
		</div>
	{/if}
</section>

<style>
	.ai-panel {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-width: 0;
	}

	.ai-panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.ai-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.ai-label {
		margin-bottom: 0;
	}

	.ai-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: var(--radius-md);
		color: color-mix(in srgb, var(--primary) 80%, var(--foreground));
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
	}

	.ai-score {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		height: 1.6rem;
		padding: 0 0.45rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border);
		font-size: 0.78rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.ai-score[data-tone='strong'] {
		color: oklch(0.72 0.16 152);
		border-color: color-mix(in srgb, oklch(0.65 0.18 152) 30%, var(--border));
		background: color-mix(in srgb, oklch(0.6 0.16 152) 10%, transparent);
	}

	.ai-score[data-tone='ok'] {
		color: color-mix(in srgb, var(--primary) 80%, var(--foreground));
		border-color: color-mix(in srgb, var(--primary) 25%, var(--border));
		background: color-mix(in srgb, var(--primary) 8%, transparent);
	}

	.ai-score[data-tone='needs-work'] {
		color: color-mix(in srgb, var(--destructive) 78%, var(--foreground));
		border-color: color-mix(in srgb, var(--destructive) 24%, var(--border));
		background: color-mix(in srgb, var(--destructive) 7%, transparent);
	}

	.ai-goal-label {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
	}

	:global(.ai-goal-input) {
		min-height: 4.75rem;
		resize: vertical;
		font-size: 0.78rem;
		line-height: 1.4;
	}

	:global(.ai-review-btn) {
		gap: 0.4rem;
	}

	.ai-error {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.74rem;
		line-height: 1.35;
		color: var(--destructive);
	}

	.ai-error :global(svg) {
		flex-shrink: 0;
		margin-top: 0.05rem;
	}

	.ai-result-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.7rem;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
		background: color-mix(in srgb, var(--primary) 7%, transparent);
	}

	.ai-result-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.ai-result-score {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		font-size: 0.92rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.ai-result-score[data-tone='strong'] {
		color: oklch(0.72 0.16 152);
		border-color: color-mix(in srgb, oklch(0.65 0.18 152) 30%, var(--border));
		background: color-mix(in srgb, oklch(0.6 0.16 152) 10%, transparent);
	}

	.ai-result-score[data-tone='ok'] {
		color: color-mix(in srgb, var(--primary) 80%, var(--foreground));
		border-color: color-mix(in srgb, var(--primary) 25%, var(--border));
		background: color-mix(in srgb, var(--primary) 8%, transparent);
	}

	.ai-result-score[data-tone='needs-work'] {
		color: color-mix(in srgb, var(--destructive) 78%, var(--foreground));
		border-color: color-mix(in srgb, var(--destructive) 24%, var(--border));
		background: color-mix(in srgb, var(--destructive) 7%, transparent);
	}

	.ai-result-text {
		min-width: 0;
	}

	.ai-result-title {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.ai-result-copy {
		margin: 0.1rem 0 0;
		font-size: 0.72rem;
		line-height: 1.3;
		color: var(--muted-foreground);
	}

	.ai-result-actions {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.ai-result-discard {
		align-self: center;
		padding: 0.1rem 0.3rem;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: 0.7rem;
		color: var(--muted-foreground);
		cursor: pointer;
		transition: color 130ms ease;
	}

	.ai-result-discard:hover {
		color: var(--destructive);
	}
</style>
