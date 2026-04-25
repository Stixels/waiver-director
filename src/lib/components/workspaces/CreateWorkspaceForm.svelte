<script lang="ts">
	import { ConvexError } from 'convex/values';
	import { useConvexClient } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import Building2Icon from '@lucide/svelte/icons/building-2';
	import CheckIcon from '@lucide/svelte/icons/check';

	type CreatedWorkspace = {
		workspaceId: string;
		slug: string;
	};

	interface Props {
		onCreated?: (workspace: CreatedWorkspace) => void | Promise<void>;
		submitLabel?: string;
		autoFocusName?: boolean;
	}

	const convex = useConvexClient();
	const workspaceSlugRegex = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])$/;

	let { onCreated, submitLabel = 'Create workspace', autoFocusName = false }: Props = $props();

	let name = $state('');
	let slug = $state('');
	let slugEdited = $state(false);
	let isSubmitting = $state(false);
	let hasAttemptedSubmit = $state(false);
	let submitError = $state<string | null>(null);
	let isSuccess = $state(false);

	function sanitizeSlug(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/[\s_]+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 48)
			.replace(/-$/g, '');
	}

	const trimmedName = $derived(name.trim());
	const nameValid = $derived(trimmedName.length >= 2 && trimmedName.length <= 80);
	const slugValid = $derived(workspaceSlugRegex.test(slug));
	const canSubmit = $derived(nameValid && slugValid && !isSubmitting && !isSuccess);

	$effect(() => {
		if (!slugEdited) {
			slug = sanitizeSlug(name);
		}
	});

	const initials = $derived(
		trimmedName
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase() ?? '')
			.join('') || null
	);

	function getNameHint(): string {
		return hasAttemptedSubmit && !nameValid
			? 'Use 2-80 characters for the workspace name.'
			: 'The display name for your business.';
	}

	function getSlugHint(): string {
		if (hasAttemptedSubmit && !slugValid) {
			return 'Use 2-48 lowercase letters or numbers. Hyphens are allowed only in the middle.';
		}

		if (!slug) {
			return 'Lowercase letters, numbers, and hyphens only.';
		}

		return slugEdited
			? 'This becomes part of your workspace URL.'
			: 'Generated from your workspace name.';
	}

	function handleSlugInput(event: Event) {
		submitError = null;
		const raw = (event.target as HTMLInputElement).value;
		const nextSlug = sanitizeSlug(raw);

		slugEdited = nextSlug.length > 0;
		slug = nextSlug;
	}

	function getSubmitErrorMessage(error: unknown): string {
		if (error instanceof ConvexError) {
			if (typeof error.data === 'string') {
				return error.data;
			}

			if (
				typeof error.data === 'object' &&
				error.data !== null &&
				'message' in error.data &&
				typeof error.data.message === 'string'
			) {
				return error.data.message;
			}
		}

		return error instanceof Error ? error.message : 'Unable to create your workspace right now.';
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		hasAttemptedSubmit = true;
		if (!canSubmit) return;

		isSubmitting = true;
		submitError = null;

		try {
			if (convex.disabled) {
				throw new Error('Workspace creation is still loading. Please try again.');
			}

			const result = await convex.mutation(api.workspaces.createWorkspace, {
				name: trimmedName,
				slug
			});

			if (onCreated) {
				await new Promise((resolveDelay) => window.setTimeout(resolveDelay, 250));
				await onCreated(result);
			}

			isSuccess = true;
			isSubmitting = false;
		} catch (err) {
			submitError = getSubmitErrorMessage(err);
			isSubmitting = false;
		}
	}
</script>

<form class="space-y-5" novalidate onsubmit={handleSubmit}>
	<div
		class={`flex items-center gap-3 rounded-xl border bg-background/60 p-4 ${
			trimmedName ? 'border-primary/30' : 'border-border/70'
		}`}
	>
		<div
			class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 ${
				trimmedName ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
			}`}
		>
			{#if initials}
				<span class="text-xs font-extrabold tracking-[-0.02em]">{initials}</span>
			{:else}
				<Building2Icon class="size-4.5 text-primary/60" aria-hidden="true" />
			{/if}
		</div>

		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-semibold text-foreground">
				{trimmedName || 'Your workspace'}
			</p>
			<p class="truncate font-mono text-xs text-muted-foreground">
				<span class="opacity-60">app /</span>
				<span class="text-primary/85">{slug || 'workspace-slug'}</span>
			</p>
		</div>

		{#if isSuccess}
			<div
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
				aria-hidden="true"
			>
				<CheckIcon class="size-3.5" />
			</div>
		{/if}
	</div>

	<div class="space-y-4">
		<div class="space-y-2">
			<label class="text-sm font-medium text-foreground" for="workspace-name">Workspace name</label>
			<Input
				id="workspace-name"
				name="name"
				type="text"
				autocomplete="organization"
				placeholder="Atlas Escape & VR"
				class="h-11 rounded-lg border-border/70 bg-background/70 px-3 text-sm shadow-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
				bind:value={name}
				required
				minlength={2}
				maxlength={80}
				disabled={isSubmitting || isSuccess}
				aria-invalid={hasAttemptedSubmit && !nameValid}
				aria-describedby="workspace-name-hint"
				autofocus={autoFocusName}
				oninput={() => (submitError = null)}
			/>
			<p
				id="workspace-name-hint"
				class:text-destructive={hasAttemptedSubmit && !nameValid}
				class="text-xs leading-5 text-muted-foreground"
			>
				{getNameHint()}
			</p>
		</div>

		<div class="space-y-2">
			<label class="text-sm font-medium text-foreground" for="workspace-slug">Workspace slug</label>
			<div class="relative">
				<span
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[0.8125rem] text-muted-foreground"
					aria-hidden="true"
				>
					app /
				</span>
				<Input
					id="workspace-slug"
					name="slug"
					type="text"
					autocomplete="off"
					placeholder="atlas-escape"
					class="h-11 rounded-lg border-border/70 bg-background/70 px-3 pl-17 font-mono text-sm shadow-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
					value={slug}
					required
					minlength={2}
					maxlength={48}
					disabled={isSubmitting || isSuccess}
					aria-invalid={hasAttemptedSubmit && !slugValid}
					aria-describedby="workspace-slug-hint"
					spellcheck={false}
					autocapitalize="off"
					autocorrect="off"
					inputmode="text"
					pattern={workspaceSlugRegex.source}
					oninput={handleSlugInput}
				/>
			</div>
			<p
				id="workspace-slug-hint"
				class:text-destructive={hasAttemptedSubmit && !slugValid}
				class="text-xs leading-5 text-muted-foreground"
			>
				{getSlugHint()}
			</p>
		</div>
	</div>

	{#if submitError}
		<p
			class="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm leading-6 text-destructive"
			role="alert"
		>
			{submitError}
		</p>
	{/if}

	<Button
		type="submit"
		class="h-11 w-full rounded-lg text-sm font-semibold md:text-sm"
		disabled={!canSubmit}
	>
		{#if isSuccess}
			<CheckIcon class="size-5" aria-hidden="true" />
			Workspace created!
		{:else if isSubmitting}
			<span class="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
			Creating…
		{:else}
			{submitLabel}
			<ArrowRightIcon class="size-5" aria-hidden="true" />
		{/if}
	</Button>
</form>
