<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { FunctionReturnType } from 'convex/server';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { publicEnv } from '$lib/config/public';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		DEFAULT_WIDGET_COLOR,
		DEFAULT_WIDGET_LABEL,
		WIDGET_LABEL_MAX_LENGTH,
		buildIframeSnippet,
		buildWidgetSnippet,
		normalizeWidgetColor,
		normalizeWidgetLabel,
		widgetTextColor,
		type WidgetMode
	} from '$lib/embed/widget';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	type WorkspaceWaiverSummary = FunctionReturnType<typeof api.waivers.getWorkspaceWaiver>;

	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	const waiverQuery = useProtectedQuery(
		api.waivers.getWorkspaceWaiver,
		() => (currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'),
		() => ({ keepPreviousData: true })
	);
	const workspaceWaiver = $derived((waiverQuery.data ?? null) as WorkspaceWaiverSummary | null);
	const isLoading = $derived(appContext.isLoading || waiverQuery.isLoading);
	const canPublishWaiver = $derived(Boolean(currentWorkspace?.billing.features.waiverPublishing));

	const baseUrl = $derived(
		publicEnv.appUrl ||
			(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
	);
	const waiverUrl = $derived.by(() => {
		if (!canPublishWaiver || !workspaceWaiver?.publishedVersionId) return null;
		return new URL(
			resolve(`/w/${workspaceWaiver.publicSlug}` as `/w/${string}`),
			baseUrl
		).toString();
	});
	const scriptUrl = $derived(new URL('/embed.js', baseUrl).toString());
	const publicSlug = $derived(workspaceWaiver?.publicSlug ?? '');
	const waiverEditorHref = $derived(
		resolve(`/app/${page.params.workspaceSlug ?? ''}/waiver` as `/app/${string}/waiver`)
	);

	let mode = $state<WidgetMode>('button');
	let label = $state(DEFAULT_WIDGET_LABEL);
	let color = $state(DEFAULT_WIDGET_COLOR);

	const previewLabel = $derived(normalizeWidgetLabel(label));
	const previewColor = $derived(normalizeWidgetColor(color));
	const previewTextColor = $derived(widgetTextColor(previewColor));

	const widgetSnippet = $derived(
		waiverUrl ? buildWidgetSnippet({ scriptUrl, waiverUrl, mode, label, color }) : ''
	);
	const iframeSnippet = $derived(waiverUrl ? buildIframeSnippet(waiverUrl) : '');

	let copiedKey = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	async function copy(key: string, text: string) {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			copiedKey = key;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copiedKey = null), 1800);
			toast.success('Copied to clipboard.');
		} catch {
			toast.error('Could not copy. Select the code and copy it manually.');
		}
	}

	const modes: Array<{ value: WidgetMode; label: string; description: string }> = [
		{
			value: 'button',
			label: 'Button',
			description: 'A "Sign waiver" button that opens the form in a pop-up.'
		},
		{
			value: 'inline',
			label: 'Inline form',
			description: 'The full form inside your page, sized to fit.'
		}
	];
</script>

{#if isLoading && !workspaceWaiver}
	<div class="space-y-3 py-6">
		<Skeleton class="h-5 w-48" />
		<Skeleton class="h-40 w-full" />
	</div>
{:else if !waiverUrl}
	<SettingsSection
		title="Website widget"
		description="Let customers sign from your own website with a button or an embedded form."
	>
		<p class="widget-hint">
			{#if !canPublishWaiver}
				Your current plan does not include a public waiver, so there is nothing to embed yet.
			{:else}
				Publish your waiver first. The widget always shows the live published version.
			{/if}
		</p>
		{#snippet footer()}
			<span class="widget-status">Not available yet</span>
			<Button size="sm" variant="outline" href={waiverEditorHref}>Open waiver</Button>
		{/snippet}
	</SettingsSection>
{:else}
	<SettingsSection
		title="Widget style"
		description="Choose how the widget appears on your website. Changes here only affect the code below; paste it again after you change them."
	>
		<div class="space-y-5">
			<div class="mode-grid" role="radiogroup" aria-label="Widget type">
				{#each modes as option (option.value)}
					<button
						type="button"
						role="radio"
						aria-checked={mode === option.value}
						class="mode-option"
						class:mode-option--active={mode === option.value}
						onclick={() => (mode = option.value)}
					>
						<span class="mode-option-label">{option.label}</span>
						<span class="mode-option-desc">{option.description}</span>
					</button>
				{/each}
			</div>

			{#if mode === 'button'}
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<Label for="widget-label">Button text</Label>
						<Input
							id="widget-label"
							bind:value={label}
							maxlength={WIDGET_LABEL_MAX_LENGTH}
							placeholder={DEFAULT_WIDGET_LABEL}
							class="h-10"
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="widget-color">Button color</Label>
						<div class="flex items-center gap-2">
							<input
								type="color"
								aria-label="Pick button color"
								class="color-swatch"
								value={previewColor}
								oninput={(event) => (color = event.currentTarget.value)}
							/>
							<Input
								id="widget-color"
								bind:value={color}
								maxlength={7}
								placeholder={DEFAULT_WIDGET_COLOR}
								class="h-10 font-mono"
							/>
						</div>
					</div>
				</div>

				<div class="preview-surface">
					<span class="preview-caption">Preview</span>
					<a
						href={resolve(`/w/${publicSlug}` as `/w/${string}`)}
						target="_blank"
						rel="noopener noreferrer"
						class="preview-button"
						style:background={previewColor}
						style:color={previewTextColor}
					>
						{previewLabel}
					</a>
				</div>
			{/if}
		</div>
	</SettingsSection>

	<SettingsSection
		title="Embed code"
		description="Paste this where the widget should appear, for example in a custom HTML block on Squarespace, Wix, WordPress, or Webflow."
	>
		<pre class="snippet"><code>{widgetSnippet}</code></pre>
		<p class="widget-hint mt-2">
			The widget always shows your live published waiver, so you don't need to update your site when
			you publish a new version.
		</p>

		{#snippet footer()}
			<a
				href={resolve(`/w/${publicSlug}` as `/w/${string}`)}
				target="_blank"
				rel="noopener noreferrer"
				class="widget-link inline-flex items-center gap-1"
			>
				Open waiver <ExternalLinkIcon class="size-3" />
			</a>
			<Button size="sm" class="gap-1.5" onclick={() => copy('widget', widgetSnippet)}>
				{#if copiedKey === 'widget'}
					<CheckIcon class="size-3.5" /> Copied
				{:else}
					<ClipboardIcon class="size-3.5" /> Copy code
				{/if}
			</Button>
		{/snippet}
	</SettingsSection>

	<SettingsSection
		title="Custom buttons and links"
		description="Already have a button on your site? Add this attribute to it and keep the script above on the page."
	>
		<pre class="snippet"><code
				>{`<a href="${waiverUrl}" data-waiver-director-open>Sign your waiver</a>`}</code
			></pre>
		<p class="widget-hint mt-2">
			Clicking any element with <code>data-waiver-director-open</code> opens the waiver in the pop-up.
			Without the script, the link still opens the waiver page.
		</p>
	</SettingsSection>

	<SettingsSection
		title="Plain iframe"
		description="For site builders that do not allow scripts. The frame has a fixed height and scrolls inside."
	>
		<pre class="snippet"><code>{iframeSnippet}</code></pre>

		{#snippet footer()}
			<span class="widget-status">No script required</span>
			<Button
				size="sm"
				variant="outline"
				class="gap-1.5"
				onclick={() => copy('iframe', iframeSnippet)}
			>
				{#if copiedKey === 'iframe'}
					<CheckIcon class="size-3.5" /> Copied
				{:else}
					<ClipboardIcon class="size-3.5" /> Copy iframe
				{/if}
			</Button>
		{/snippet}
	</SettingsSection>
{/if}

<style>
	.widget-hint {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--muted-foreground);
	}

	.widget-hint code {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
	}

	.widget-status {
		font-size: 0.74rem;
		color: var(--muted-foreground);
		opacity: 0.7;
	}

	.widget-link {
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	.widget-link:hover {
		color: var(--foreground);
	}

	.mode-grid {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	}

	.mode-option {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		text-align: left;
		transition:
			border-color 120ms ease,
			background-color 120ms ease;
	}

	.mode-option:hover {
		background: color-mix(in srgb, var(--muted) 40%, transparent);
	}

	.mode-option--active {
		border-color: var(--primary);
		background: color-mix(in srgb, var(--primary) 8%, transparent);
	}

	.mode-option-label {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.mode-option-desc {
		font-size: 0.74rem;
		color: var(--muted-foreground);
	}

	.color-swatch {
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
		padding: 0.2rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: transparent;
		cursor: pointer;
	}

	.preview-surface {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--muted) 25%, transparent);
	}

	.preview-caption {
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.preview-button {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 22px;
		border-radius: 999px;
		font:
			600 15px/1.2 system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		letter-spacing: 0.01em;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
	}

	.snippet {
		max-height: 16rem;
		overflow: auto;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--muted) 35%, transparent);
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-all;
	}
</style>
