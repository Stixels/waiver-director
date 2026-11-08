<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import RichTextEditor from '$lib/components/emails/RichTextEditor.svelte';
	import WaiverRichText from '$lib/components/waivers/WaiverRichText.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetFooter,
		SheetHeader,
		SheetTitle
	} from '$lib/components/ui/sheet';
	import type { WaiverField } from '$lib/domain/waivers';
	import {
		WAIVER_LOCALES,
		WAIVER_LOCALE_ENGLISH_NAMES,
		waiverSourceFingerprint,
		waiverTranslationStatus,
		type WaiverFieldTranslation,
		type WaiverLocale,
		type WaiverTranslation
	} from '$lib/domain/waiver-i18n';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		open: boolean;
		workspaceId: Id<'workspaces'>;
		waiverId: Id<'workspace_waivers'>;
		workspaceName: string;
		workspaceLogoUrl?: string | null;
		title: string;
		introCopy: string;
		fields: WaiverField[];
		defaultLocale: WaiverLocale;
		translations: WaiverTranslation[];
	}

	let {
		open = $bindable(),
		workspaceId,
		waiverId,
		workspaceName,
		workspaceLogoUrl = null,
		title,
		introCopy,
		fields,
		defaultLocale,
		translations
	}: Props = $props();

	const convex = useConvexClient();

	let draftDefaultLocale = $state<WaiverLocale>('en');
	let draftTranslations = $state<WaiverTranslation[]>([]);
	let activeLocale = $state<WaiverLocale | null>(null);
	let isSaving = $state(false);
	let showOriginalIntro = $state(false);

	// Re-hydrate the draft from the saved waiver every time the sheet opens.
	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) {
			draftDefaultLocale = defaultLocale;
			draftTranslations = structuredClone($state.snapshot(translations)) as WaiverTranslation[];
			activeLocale = draftTranslations[0]?.locale ?? null;
			showOriginalIntro = false;
		}
		wasOpen = open;
	});

	const addableLocales = $derived(
		WAIVER_LOCALES.filter(
			(locale) =>
				locale !== draftDefaultLocale &&
				!draftTranslations.some((translation) => translation.locale === locale)
		)
	);
	// Fingerprint of the primary text as saved. Translations written against an older
	// fingerprint are outdated and stay off the live waiver until marked up to date.
	const currentFingerprint = $derived(waiverSourceFingerprint({ title, introCopy, fields }));

	const active = $derived(
		draftTranslations.find((translation) => translation.locale === activeLocale) ?? null
	);

	function addLocale(locale: WaiverLocale) {
		draftTranslations.push({
			locale,
			title: '',
			introCopy: '<p></p>',
			fields: [],
			sourceHash: currentFingerprint
		});
		activeLocale = locale;
	}

	function removeLocale(locale: WaiverLocale) {
		draftTranslations = draftTranslations.filter((translation) => translation.locale !== locale);
		if (activeLocale === locale) {
			activeLocale = draftTranslations[0]?.locale ?? null;
		}
	}

	function setDefaultLocale(locale: WaiverLocale) {
		draftDefaultLocale = locale;
		// The primary language cannot also be a translation.
		removeLocale(locale);
	}

	function fieldEntry(translation: WaiverTranslation, fieldId: string): WaiverFieldTranslation {
		let entry = translation.fields.find((field) => field.id === fieldId);
		if (!entry) {
			entry = { id: fieldId };
			translation.fields.push(entry);
			entry = translation.fields[translation.fields.length - 1];
		}
		return entry;
	}

	function fieldValue(fieldId: string, key: 'label' | 'placeholder') {
		return active?.fields.find((field) => field.id === fieldId)?.[key] ?? '';
	}

	function setFieldValue(fieldId: string, key: 'label' | 'placeholder', value: string) {
		if (!active) return;
		fieldEntry(active, fieldId)[key] = value;
	}

	function optionValue(fieldId: string, optionId: string) {
		return (
			active?.fields
				.find((field) => field.id === fieldId)
				?.options?.find((option) => option.id === optionId)?.label ?? ''
		);
	}

	function setOptionValue(fieldId: string, optionId: string, value: string) {
		if (!active) return;
		const entry = fieldEntry(active, fieldId);
		entry.options ??= [];
		const option = entry.options.find((candidate) => candidate.id === optionId);
		if (option) {
			option.label = value;
		} else {
			entry.options.push({ id: optionId, label: value });
		}
	}

	function statusOf(translation: WaiverTranslation) {
		return waiverTranslationStatus(translation, currentFingerprint);
	}

	function markUpToDate(translation: WaiverTranslation) {
		translation.sourceHash = currentFingerprint;
	}

	function translatedCount(translation: WaiverTranslation) {
		let done = translation.title.trim() ? 1 : 0;
		for (const field of fields) {
			if (translation.fields.find((entry) => entry.id === field.id)?.label?.trim()) done += 1;
		}
		return { done, total: fields.length + 1 };
	}

	async function save() {
		isSaving = true;
		try {
			await convex.mutation(api.waivers.updateWaiverTranslations, {
				workspaceId,
				waiverId,
				defaultLocale: draftDefaultLocale,
				translations: $state.snapshot(draftTranslations) as WaiverTranslation[]
			});
			toast.success('Translations saved. Publish the waiver to make them live.');
			open = false;
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to save translations.'));
		} finally {
			isSaving = false;
		}
	}
</script>

<Sheet bind:open>
	<SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
		<SheetHeader class="shrink-0 border-b border-border px-6 py-5">
			<SheetTitle class="text-base font-semibold">Languages</SheetTitle>
			<SheetDescription class="text-xs text-muted-foreground">
				Guests pick a language when they sign. Anything you leave blank shows in the primary
				language. Each signed record keeps the language the guest signed in.
			</SheetDescription>
		</SheetHeader>

		<div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="space-y-1.5 text-sm">
					<span class="font-medium">Primary language</span>
					<select
						class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						value={draftDefaultLocale}
						onchange={(event) =>
							setDefaultLocale((event.currentTarget as HTMLSelectElement).value as WaiverLocale)}
					>
						{#each WAIVER_LOCALES as locale (locale)}
							<option value={locale}>{WAIVER_LOCALE_ENGLISH_NAMES[locale]}</option>
						{/each}
					</select>
					<span class="block text-xs text-muted-foreground">
						The language your waiver text in the builder is written in.
					</span>
				</label>

				<label class="space-y-1.5 text-sm">
					<span class="font-medium">Add a language</span>
					<select
						class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						value=""
						disabled={addableLocales.length === 0}
						onchange={(event) => {
							const select = event.currentTarget as HTMLSelectElement;
							if (select.value) addLocale(select.value as WaiverLocale);
							select.value = '';
						}}
					>
						<option value="">Choose a language</option>
						{#each addableLocales as locale (locale)}
							<option value={locale}>{WAIVER_LOCALE_ENGLISH_NAMES[locale]}</option>
						{/each}
					</select>
				</label>
			</div>

			{#if draftTranslations.length === 0}
				<div
					class="rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground"
				>
					No translations yet. Add a language to let guests sign in it.
				</div>
			{:else}
				<div class="flex flex-wrap gap-2" role="tablist" aria-label="Translations">
					{#each draftTranslations as translation (translation.locale)}
						{@const progress = translatedCount(translation)}
						<div
							class={`flex items-center rounded-full border text-xs ${translation.locale === activeLocale ? 'border-foreground bg-foreground text-background' : 'border-border'}`}
						>
							<button
								type="button"
								role="tab"
								aria-selected={translation.locale === activeLocale}
								class="py-1 pr-1 pl-3"
								onclick={() => (activeLocale = translation.locale)}
							>
								{WAIVER_LOCALE_ENGLISH_NAMES[translation.locale]}
								<span class="opacity-60">{progress.done}/{progress.total}</span>
								{#if statusOf(translation) !== 'ready'}
									<span
										class="ml-1 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
										aria-label="Not live"
									></span>
								{/if}
							</button>
							<button
								type="button"
								class="rounded-full p-1 pr-2 opacity-60 hover:opacity-100"
								aria-label={`Remove ${WAIVER_LOCALE_ENGLISH_NAMES[translation.locale]}`}
								onclick={() => removeLocale(translation.locale)}
							>
								<XIcon class="size-3" />
							</button>
						</div>
					{/each}
				</div>

				{#if active}
					{#key active.locale}
						<div class="space-y-6">
							{#if statusOf(active) === 'outdated'}
								<div
									class="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
									role="status"
								>
									<p>
										<span class="font-semibold">Outdated.</span>
										The {WAIVER_LOCALE_ENGLISH_NAMES[draftDefaultLocale]} waiver changed after this translation
										was written, so guests won't be offered {WAIVER_LOCALE_ENGLISH_NAMES[
											active.locale
										]} until you update it. Compare it with the original, fix what changed, then mark
										it up to date.
									</p>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onclick={() => active && markUpToDate(active)}
									>
										Mark as up to date
									</Button>
								</div>
							{:else if statusOf(active) === 'missing_text'}
								<p
									class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
									role="status"
								>
									<span class="font-semibold">Not live yet.</span>
									Guests won't be offered {WAIVER_LOCALE_ENGLISH_NAMES[active.locale]} until the waiver
									text below is translated.
								</p>
							{/if}
							<label class="block space-y-1.5 text-sm">
								<span class="font-medium">Title</span>
								<Input bind:value={active.title} placeholder={title} maxlength={120} />
							</label>

							<div class="space-y-1.5 text-sm">
								<div class="flex items-center justify-between gap-3">
									<span class="font-medium">Waiver text</span>
									<button
										type="button"
										class="text-xs text-muted-foreground underline-offset-2 hover:underline"
										onclick={() => (showOriginalIntro = !showOriginalIntro)}
									>
										{showOriginalIntro ? 'Hide original' : 'Show original'}
									</button>
								</div>
								{#if showOriginalIntro}
									<div
										class="max-h-60 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm"
									>
										<WaiverRichText html={introCopy} />
									</div>
								{/if}
								<RichTextEditor
									id={`translation-intro-${active.locale}`}
									bind:value={active.introCopy}
									placeholder="Translated waiver text"
									{workspaceName}
									{workspaceLogoUrl}
								/>
							</div>

							{#if fields.length > 0}
								<div class="space-y-4">
									<p class="text-sm font-medium">Fields</p>
									{#each fields as field (field.id)}
										<div class="space-y-2 rounded-md border border-border p-3">
											<label class="block space-y-1 text-xs">
												<span class="text-muted-foreground">{field.label}</span>
												<Input
													value={fieldValue(field.id, 'label')}
													placeholder={field.label}
													maxlength={120}
													oninput={(event) =>
														setFieldValue(
															field.id,
															'label',
															(event.currentTarget as HTMLInputElement).value
														)}
												/>
											</label>
											{#if field.type === 'text'}
												<label class="block space-y-1 text-xs">
													<span class="text-muted-foreground">Placeholder</span>
													<Input
														value={fieldValue(field.id, 'placeholder')}
														placeholder={field.placeholder ?? ''}
														maxlength={200}
														oninput={(event) =>
															setFieldValue(
																field.id,
																'placeholder',
																(event.currentTarget as HTMLInputElement).value
															)}
													/>
												</label>
											{/if}
											{#if field.type === 'select'}
												<div class="space-y-1 pl-3">
													{#each field.options as option (option.id)}
														<Input
															value={optionValue(field.id, option.id)}
															placeholder={option.label}
															maxlength={80}
															aria-label={`Translation for ${option.label}`}
															oninput={(event) =>
																setOptionValue(
																	field.id,
																	option.id,
																	(event.currentTarget as HTMLInputElement).value
																)}
														/>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/key}
				{/if}
			{/if}
		</div>

		<SheetFooter class="shrink-0 flex-row justify-end gap-2 border-t border-border px-6 py-4">
			<Button type="button" variant="outline" size="sm" onclick={() => (open = false)}>
				Cancel
			</Button>
			<Button type="button" size="sm" onclick={save} disabled={isSaving}>
				{isSaving ? 'Saving…' : 'Save languages'}
			</Button>
		</SheetFooter>
	</SheetContent>
</Sheet>
