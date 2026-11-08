<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';

	const convex = useConvexClient();
	const appContext = useAppContext();
	const currentWorkspace = $derived(
		appContext.workspaces.find((w) => w.slug === page.params.workspaceSlug) ?? null
	);

	const policyQuery = useProtectedQuery(api.waiverPolicies.getWorkspaceWaiverPolicy, () =>
		currentWorkspace ? { workspaceId: currentWorkspace.workspaceId } : 'skip'
	);
	const data = $derived(policyQuery.data);
	const canEdit = $derived(data?.canEdit ?? false);

	let reuseEnabled = $state(false);
	let hasTimeLimit = $state(true);
	let validityDays = $state('365');
	let resignOnNewVersion = $state(true);
	let remindersEnabled = $state(false);
	let leadHours = $state('24');
	let loadedKey = $state<string | null>(null);
	let isSaving = $state(false);

	$effect(() => {
		if (!data || !currentWorkspace) return;
		const key = `${currentWorkspace.workspaceId}:${JSON.stringify(data.policy)}`;
		if (loadedKey === key) return;
		loadedKey = key;
		reuseEnabled = data.policy.reuseEnabled;
		hasTimeLimit = data.policy.validityDays !== null;
		validityDays = String(data.policy.validityDays ?? 365);
		resignOnNewVersion = data.policy.resignOnNewVersion;
		remindersEnabled = data.policy.guestReminders.enabled;
		leadHours = String(data.policy.guestReminders.leadHours);
	});

	const parsedValidityDays = $derived(Number(validityDays));
	const parsedLeadHours = $derived(Number(leadHours));
	const validityValid = $derived(
		!hasTimeLimit ||
			(Number.isInteger(parsedValidityDays) &&
				parsedValidityDays >= 1 &&
				parsedValidityDays <= 3650)
	);
	const leadHoursValid = $derived(
		Number.isInteger(parsedLeadHours) && parsedLeadHours >= 1 && parsedLeadHours <= 168
	);

	const isDirty = $derived.by(() => {
		if (!data) return false;
		const policy = data.policy;
		return (
			reuseEnabled !== policy.reuseEnabled ||
			(hasTimeLimit ? parsedValidityDays : null) !== policy.validityDays ||
			resignOnNewVersion !== policy.resignOnNewVersion ||
			remindersEnabled !== policy.guestReminders.enabled ||
			parsedLeadHours !== policy.guestReminders.leadHours
		);
	});

	const deliveryBlocker = $derived.by(() => {
		const delivery = data?.reminderDelivery;
		if (!delivery) return null;
		if (!delivery.hasEmailFeature) return 'Guest reminders need the Pro plan.';
		if (!delivery.senderConfigured) return 'Email sending is not configured for this deployment.';
		if (!delivery.replyToVerified) return 'Verify a reply-to address before reminders can send.';
		return null;
	});

	async function save() {
		if (!currentWorkspace || !data || !canEdit || !validityValid || !leadHoursValid) return;
		isSaving = true;
		try {
			await convex.mutation(api.waiverPolicies.updateWorkspaceWaiverPolicy, {
				workspaceId: currentWorkspace.workspaceId,
				policy: {
					reuseEnabled,
					validityDays: hasTimeLimit ? parsedValidityDays : null,
					resignOnNewVersion,
					guestReminders: {
						enabled: remindersEnabled,
						leadHours: parsedLeadHours
					}
				}
			});
			toast.success('Guest rules saved.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to save guest rules.'));
		} finally {
			isSaving = false;
		}
	}
</script>

{#if !currentWorkspace || !data}
	<div class="space-y-4">
		<Skeleton class="h-56 w-full rounded-md" />
		<Skeleton class="h-40 w-full rounded-md" />
	</div>
{:else}
	{#if !canEdit}
		<p class="settings-hint pb-2">Only workspace owners can change these rules.</p>
	{/if}

	<SettingsSection
		title="Returning guests"
		description="Let guests with a current waiver on file skip signing again when they open a booking link."
	>
		<div class="space-y-5">
			<fieldset class="space-y-2" disabled={!canEdit}>
				<legend class="sr-only">Re-sign rule</legend>
				<label class="option-row">
					<input type="radio" name="reuse" value={false} bind:group={reuseEnabled} />
					<span>
						<span class="option-title">Sign every visit</span>
						<span class="settings-hint block">Every guest signs a new waiver for each booking.</span
						>
					</span>
				</label>
				<label class="option-row">
					<input type="radio" name="reuse" value={true} bind:group={reuseEnabled} />
					<span>
						<span class="option-title">Reuse a valid waiver</span>
						<span class="settings-hint block">
							Returning guests confirm their email and date of birth, and their earlier signed
							waiver counts toward the booking.
						</span>
					</span>
				</label>
			</fieldset>

			{#if reuseEnabled}
				<div class="space-y-4 border-l pl-4">
					<label class="option-row">
						<input type="checkbox" bind:checked={hasTimeLimit} disabled={!canEdit} />
						<span class="option-title">Waivers expire</span>
					</label>
					{#if hasTimeLimit}
						<div class="flex items-center gap-2">
							<Input
								id="validity-days"
								type="number"
								min={1}
								max={3650}
								class="h-9 w-28"
								bind:value={validityDays}
								disabled={!canEdit}
							/>
							<span class="text-sm text-muted-foreground">days after signing</span>
						</div>
						{#if !validityValid}
							<p class="settings-hint invalid">Use a whole number from 1 to 3650.</p>
						{/if}
					{/if}
					<label class="option-row">
						<input type="checkbox" bind:checked={resignOnNewVersion} disabled={!canEdit} />
						<span>
							<span class="option-title">Ask again when I publish a new waiver version</span>
							<span class="settings-hint block">
								Recommended. Guests who signed an older version sign the new one.
							</span>
						</span>
					</label>
				</div>
			{/if}
		</div>
	</SettingsSection>

	<SettingsSection
		title="Unsigned guest reminders"
		description="Email the booking's lead customer before the booking when some guests still haven't signed."
	>
		<div class="space-y-4">
			<label class="option-row">
				<input type="checkbox" bind:checked={remindersEnabled} disabled={!canEdit} />
				<span>
					<span class="option-title">Send a reminder before the booking</span>
					<span class="settings-hint block">
						One reminder per booking, with the booking's signing link and how many guests are left.
					</span>
				</span>
			</label>
			{#if remindersEnabled}
				<div class="flex items-center gap-2 pl-6">
					<Input
						id="lead-hours"
						type="number"
						min={1}
						max={168}
						class="h-9 w-24"
						bind:value={leadHours}
						disabled={!canEdit}
					/>
					<span class="text-sm text-muted-foreground">hours before the booking starts</span>
				</div>
				{#if !leadHoursValid}
					<p class="settings-hint invalid pl-6">Use a whole number from 1 to 168.</p>
				{/if}
				{#if deliveryBlocker}
					<p class="settings-hint invalid pl-6">
						{deliveryBlocker}
						{#if !data.reminderDelivery.replyToVerified && data.reminderDelivery.hasEmailFeature}
							<a
								class="underline"
								href={resolve(`/app/${currentWorkspace.slug}/settings/email` as const)}
								>Set up email identity</a
							>
						{/if}
					</p>
				{/if}
			{/if}
		</div>

		{#snippet footer()}
			<div class="text-xs text-muted-foreground">
				{isDirty ? 'Unsaved changes' : 'Up to date'}
			</div>
			<Button
				size="sm"
				disabled={!canEdit || !isDirty || !validityValid || !leadHoursValid || isSaving}
				onclick={save}
				class="gap-1.5"
			>
				{#if isSaving}
					<LoaderIcon class="size-3.5 animate-spin" />
					Saving
				{:else}
					Save guest rules
				{/if}
			</Button>
		{/snippet}
	</SettingsSection>
{/if}

<style>
	.option-row {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		cursor: pointer;
	}

	.option-row input {
		margin-top: 0.2rem;
		accent-color: var(--primary);
	}

	.option-title {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.settings-hint {
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--muted-foreground);
	}

	.settings-hint.invalid {
		color: var(--destructive);
	}
</style>
