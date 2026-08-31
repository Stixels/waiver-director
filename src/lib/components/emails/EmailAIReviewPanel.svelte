<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import {
		EMAIL_AI_RUBRIC_KEYS,
		EMAIL_AI_RUBRIC_LABELS,
		EMAIL_AI_RUBRIC_MAX,
		type EmailAIResult
	} from '$lib/domain/email-ai';
	import { buildEmailDiff, countDiffChanges } from '$lib/domain/email-diff';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import GitCompareIcon from '@lucide/svelte/icons/git-compare';
	import LightbulbIcon from '@lucide/svelte/icons/lightbulb';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import XIcon from '@lucide/svelte/icons/x';
	import EmailLineDiff from './EmailLineDiff.svelte';

	interface Props {
		open: boolean;
		result: EmailAIResult;
		currentSubject: string;
		currentBody: string;
		onApply: (proposal: { subject: string; body: string }) => void;
	}

	let { open = $bindable(), result, currentSubject, currentBody, onApply }: Props = $props();

	let view = $state<'diff' | 'preview'>('diff');
	let showRubric = $state(false);

	const scoreTone = $derived.by(() => {
		if (result.score >= 82) return 'strong';
		if (result.score >= 65) return 'ok';
		return 'needs-work';
	});
	const verdict = $derived.by(() => {
		if (scoreTone === 'strong') return 'Strong';
		if (scoreTone === 'ok') return 'Solid';
		return 'Needs work';
	});

	const emailDiff = $derived(
		buildEmailDiff({
			currentSubject,
			currentBody,
			proposedSubject: result.proposedSubject,
			proposedBody: result.proposedBody
		})
	);
	const changes = $derived(countDiffChanges(emailDiff));
	const subjectChanged = $derived(currentSubject.trim() !== result.proposedSubject.trim());

	function applyProposal() {
		onApply({ subject: result.proposedSubject, body: result.proposedBody });
	}

	function close() {
		open = false;
	}
</script>

<Dialog bind:open>
	<DialogContent
		showCloseButton={false}
		class="ai-review-dialog w-[min(1040px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]! gap-0 overflow-hidden p-0"
	>
		<!-- Header -->
		<header class="review-header">
			<div class="review-heading">
				<span class="review-mark"><SparklesIcon class="size-4" /></span>
				<div class="min-w-0">
					<p class="review-eyebrow">AI proposal</p>
					<h2 class="review-title">Review proposed changes</h2>
				</div>
			</div>
			<div class="review-header-actions">
				<div class="score-pill" data-tone={scoreTone} title="Overall quality score">
					<span class="score-pill-value">{result.score}</span>
					<span class="score-pill-meta">
						<span class="score-pill-verdict">{verdict}</span>
						<span class="score-pill-scale">/ 100</span>
					</span>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Close review"
					onclick={close}
				>
					<XIcon class="size-4" />
				</Button>
			</div>
		</header>

		<!-- View switch + change summary -->
		<div class="review-toolbar">
			<div class="view-switch" role="tablist" aria-label="Review view">
				<button
					type="button"
					role="tab"
					aria-selected={view === 'diff'}
					class="view-switch-btn"
					data-active={view === 'diff'}
					onclick={() => (view = 'diff')}
				>
					<GitCompareIcon class="size-3.5" />
					Changes
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={view === 'preview'}
					class="view-switch-btn"
					data-active={view === 'preview'}
					onclick={() => (view = 'preview')}
				>
					<EyeIcon class="size-3.5" />
					Preview
				</button>
			</div>

			{#if view === 'diff'}
				<div class="change-counts" aria-label="Change summary">
					<span class="change-chip change-chip--add">+{changes.additions}</span>
					<span class="change-chip change-chip--remove">−{changes.removals}</span>
				</div>
			{/if}
		</div>

		<!-- Scrollable body -->
		<div class="review-body">
			{#if result.issues.length > 0 || result.suggestions.length > 0 || result.rationale}
				<div class="feedback-card">
					{#if result.rationale}
						<p class="feedback-rationale">{result.rationale}</p>
					{/if}

					<div class="feedback-lists">
						{#if result.issues.length > 0}
							<div class="feedback-block">
								<p class="feedback-label feedback-label--issues">
									<AlertCircleIcon class="size-3.5" />
									Issues
								</p>
								<ul>
									{#each result.issues as issue (issue)}
										<li>{issue}</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if result.suggestions.length > 0}
							<div class="feedback-block">
								<p class="feedback-label feedback-label--suggestions">
									<LightbulbIcon class="size-3.5" />
									Suggestions
								</p>
								<ul>
									{#each result.suggestions as suggestion (suggestion)}
										<li>{suggestion}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>

					<button
						type="button"
						class="rubric-toggle"
						aria-expanded={showRubric}
						onclick={() => (showRubric = !showRubric)}
					>
						<ChevronDownIcon class="rubric-chevron size-3.5" data-open={showRubric} />
						Scorecard
					</button>

					{#if showRubric}
						<div class="rubric-grid">
							{#each EMAIL_AI_RUBRIC_KEYS as key (key)}
								{@const value = result.rubric[key]}
								{@const ratio = Math.max(0, Math.min(1, value / EMAIL_AI_RUBRIC_MAX))}
								<div class="rubric-row">
									<span class="rubric-name">{EMAIL_AI_RUBRIC_LABELS[key]}</span>
									<span class="rubric-track">
										<span
											class="rubric-fill"
											data-tone={ratio >= 0.82 ? 'strong' : ratio >= 0.65 ? 'ok' : 'needs-work'}
											style="width: {ratio * 100}%"
										></span>
									</span>
									<span class="rubric-value"
										>{value}<span class="rubric-max">/{EMAIL_AI_RUBRIC_MAX}</span></span
									>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if view === 'diff'}
				<EmailLineDiff diff={emailDiff} />
			{:else}
				<div class="preview-card">
					<div class="preview-subject-row">
						<span class="preview-key">Subject</span>
						<span class="preview-subject" data-changed={subjectChanged}>
							{result.proposedSubject || '(no subject)'}
						</span>
					</div>
					<WaiverRichText html={result.proposedBody} class="preview-body" />
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<footer class="review-footer">
			<p class="review-footer-hint">Applying replaces the subject and body. Autosave keeps it.</p>
			<div class="review-footer-actions">
				<Button type="button" variant="ghost" size="sm" onclick={close}>Close</Button>
				<Button type="button" size="sm" onclick={applyProposal}>
					<CheckIcon class="size-3.5" />
					Apply proposal
				</Button>
			</div>
		</footer>
	</DialogContent>
</Dialog>

<style>
	/* The dialog is already display:grid; pin header/toolbar/footer and let the
	   body row absorb remaining space so it scrolls within max-height. */
	:global(.ai-review-dialog) {
		height: min(86dvh, 46rem);
		max-height: calc(100dvh - 2rem);
		grid-template-rows: auto auto minmax(0, 1fr) auto;
	}

	/* ─── Header ─────────────────────────────────────────────────────────────── */
	.review-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-shrink: 0;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--border);
	}

	.review-heading {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-width: 0;
	}

	.review-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-md);
		flex-shrink: 0;
		color: color-mix(in srgb, var(--primary) 82%, var(--foreground));
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
	}

	.review-eyebrow {
		margin: 0;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
	}

	.review-title {
		margin: 0.05rem 0 0;
		font-size: 0.98rem;
		font-weight: 650;
		color: var(--foreground);
		line-height: 1.2;
	}

	.review-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.score-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.28rem 0.6rem 0.28rem 0.55rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--muted) 30%, transparent);
	}

	.score-pill-value {
		font-size: 1.05rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.score-pill-meta {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}

	.score-pill-verdict {
		font-size: 0.72rem;
		font-weight: 600;
	}

	.score-pill-scale {
		font-size: 0.6rem;
		color: var(--muted-foreground);
	}

	.score-pill[data-tone='strong'] {
		color: oklch(0.72 0.16 152);
		border-color: color-mix(in srgb, oklch(0.65 0.18 152) 30%, var(--border));
		background: color-mix(in srgb, oklch(0.6 0.16 152) 10%, transparent);
	}

	.score-pill[data-tone='ok'] {
		color: color-mix(in srgb, var(--primary) 82%, var(--foreground));
		border-color: color-mix(in srgb, var(--primary) 25%, var(--border));
		background: color-mix(in srgb, var(--primary) 8%, transparent);
	}

	.score-pill[data-tone='needs-work'] {
		color: color-mix(in srgb, var(--destructive) 80%, var(--foreground));
		border-color: color-mix(in srgb, var(--destructive) 24%, var(--border));
		background: color-mix(in srgb, var(--destructive) 7%, transparent);
	}

	/* ─── Toolbar ────────────────────────────────────────────────────────────── */
	.review-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-shrink: 0;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--muted) 14%, transparent);
	}

	.view-switch {
		display: inline-flex;
		padding: 0.15rem;
		gap: 0.15rem;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		background: color-mix(in srgb, var(--background) 60%, var(--card));
	}

	.view-switch-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.28rem 0.65rem;
		border: none;
		border-radius: calc(var(--radius-md) - 0.15rem);
		background: transparent;
		font-family: inherit;
		font-size: 0.74rem;
		font-weight: 550;
		color: var(--muted-foreground);
		cursor: pointer;
		transition:
			background 130ms ease,
			color 130ms ease;
	}

	.view-switch-btn:hover {
		color: var(--foreground);
	}

	.view-switch-btn[data-active='true'] {
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted) 75%, transparent);
		box-shadow: 0 1px 1px color-mix(in srgb, var(--foreground) 6%, transparent);
	}

	.change-counts {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-variant-numeric: tabular-nums;
	}

	.change-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-sm);
		font-size: 0.72rem;
		font-weight: 650;
	}

	.change-chip--add {
		color: oklch(0.74 0.16 152);
		background: color-mix(in srgb, oklch(0.6 0.16 152) 14%, transparent);
	}

	.change-chip--remove {
		color: color-mix(in srgb, var(--destructive) 85%, var(--foreground));
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
	}

	/* ─── Body ───────────────────────────────────────────────────────────────── */
	.review-body {
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem;
	}

	.review-body > :global(*) {
		flex-shrink: 0;
	}

	.feedback-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--muted) 16%, transparent);
	}

	.feedback-rationale {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.5;
		color: color-mix(in srgb, var(--foreground) 88%, var(--muted-foreground));
	}

	.feedback-lists {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.feedback-block {
		min-width: 0;
	}

	.feedback-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin: 0 0 0.35rem;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.feedback-label--issues {
		color: color-mix(in srgb, var(--destructive) 78%, var(--foreground));
	}

	.feedback-label--suggestions {
		color: color-mix(in srgb, var(--primary) 80%, var(--foreground));
	}

	.feedback-block ul {
		margin: 0;
		padding-left: 1.05rem;
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--muted-foreground);
	}

	.feedback-block li + li {
		margin-top: 0.25rem;
	}

	.rubric-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		align-self: flex-start;
		padding: 0;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		cursor: pointer;
		transition: color 130ms ease;
	}

	.rubric-toggle:hover {
		color: var(--foreground);
	}

	:global(.rubric-chevron) {
		transition: transform 150ms ease;
	}

	:global(.rubric-chevron[data-open='true']) {
		transform: rotate(180deg);
	}

	.rubric-grid {
		display: grid;
		gap: 0.4rem;
	}

	.rubric-row {
		display: grid;
		grid-template-columns: 7.5rem 1fr 2.6rem;
		align-items: center;
		gap: 0.6rem;
	}

	.rubric-name {
		font-size: 0.74rem;
		color: var(--muted-foreground);
	}

	.rubric-track {
		height: 0.4rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--muted) 60%, transparent);
		overflow: hidden;
	}

	.rubric-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		transition: width 220ms ease;
	}

	.rubric-fill[data-tone='strong'] {
		background: oklch(0.66 0.16 152);
	}

	.rubric-fill[data-tone='ok'] {
		background: color-mix(in srgb, var(--primary) 80%, var(--foreground));
	}

	.rubric-fill[data-tone='needs-work'] {
		background: color-mix(in srgb, var(--destructive) 75%, var(--foreground));
	}

	.rubric-value {
		font-size: 0.74rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: var(--foreground);
	}

	.rubric-max {
		font-weight: 500;
		color: color-mix(in srgb, var(--muted-foreground) 75%, transparent);
	}

	/* ─── Preview ────────────────────────────────────────────────────────────── */
	.preview-card {
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		border-radius: var(--radius-md);
		background: var(--card);
		overflow: hidden;
	}

	.preview-subject-row {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		background: color-mix(in srgb, var(--muted) 18%, transparent);
	}

	.preview-key {
		flex-shrink: 0;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
	}

	.preview-subject {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--foreground);
		line-height: 1.4;
	}

	.preview-subject[data-changed='true'] {
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, oklch(0.62 0.16 152) 60%, transparent);
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
	}

	:global(.preview-body) {
		padding: 1rem;
		font-size: 0.85rem;
		line-height: 1.6;
		color: var(--foreground);
	}

	/* ─── Footer ─────────────────────────────────────────────────────────────── */
	.review-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-shrink: 0;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
		background: color-mix(in srgb, var(--muted) 14%, transparent);
	}

	.review-footer-hint {
		margin: 0;
		font-size: 0.72rem;
		color: var(--muted-foreground);
		min-width: 0;
	}

	.review-footer-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.feedback-lists {
			grid-template-columns: 1fr;
		}

		.review-footer-hint {
			display: none;
		}

		.rubric-row {
			grid-template-columns: 5.5rem 1fr 2.6rem;
		}
	}
</style>
