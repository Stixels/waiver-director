<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useAppContext } from '$lib/components/app/app-context.svelte';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { slide } from 'svelte/transition';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CrownIcon from '@lucide/svelte/icons/crown';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';

	const PLAN_FEATURES_ID = 'account-plan-features';
	const convex = useConvexClient();
	const appContext = useAppContext();
	const billing = $derived(appContext.billing);
	const ownedWorkspaces = $derived(
		appContext.workspaces.filter(
			(workspace) => workspace.billing.ownerUserId === appContext.currentUser?.userId
		)
	);
	const currentWorkspaceSlug = $derived(page.params.workspaceSlug);
	const accountBillingHref = $derived(
		resolve(`/app/${currentWorkspaceSlug}/account#/billing/plans` as const)
	);
	const isLimited = $derived(Boolean(billing?.workspaceLimit.limit));
	const isOverLimit = $derived(
		Boolean(
			billing?.workspaceLimit.limit &&
			billing.workspaceLimit.ownedWorkspaceCount > billing.workspaceLimit.limit
		)
	);
	const isFreePlan = $derived(
		!billing?.planSlug || billing.planSlug === 'free' || billing.planSlug === 'free_user'
	);
	const planName = $derived.by(() => {
		if (isFreePlan) return 'Free';
		if (billing?.planSlug === 'pro') return 'Pro';
		if (billing?.planSlug === 'business') return 'Business';
		return billing?.planSlug
			? billing.planSlug.charAt(0).toUpperCase() + billing.planSlug.slice(1)
			: 'Free';
	});
	let switchingWorkspaceId = $state<Id<'workspaces'> | null>(null);
	let showFeatures = $state(false);

	function formatDate(epochMs: number | null | undefined): string {
		if (!epochMs) return 'Not selected yet';
		return new Date(epochMs).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function makePrimary(workspaceId: Id<'workspaces'>) {
		if (switchingWorkspaceId || convex.disabled) return;
		switchingWorkspaceId = workspaceId;
		try {
			await convex.mutation(api.billing.selectPrimaryWorkspace, { workspaceId });
			toast.success('Primary workspace updated.');
		} catch (error) {
			toast.error(getConvexErrorMessage(error, 'Unable to update primary workspace.'));
		} finally {
			switchingWorkspaceId = null;
		}
	}

	// Calculate workspace limit percentage
	const limitPercentage = $derived.by(() => {
		if (!billing?.workspaceLimit.limit) return 100;
		return Math.min(
			(billing.workspaceLimit.ownedWorkspaceCount / billing.workspaceLimit.limit) * 100,
			100
		);
	});

	// Derived helper to ensure switch text only shows for active Pro plans with multiple workspaces
	const canSwitch = $derived(
		Boolean(
			billing?.planSlug === 'pro' &&
			billing.isActive &&
			billing.workspaceLimit.ownedWorkspaceCount > 1
		)
	);
</script>

<svelte:head>
	<title>Plan usage | Waiver Director</title>
	<meta name="description" content="Manage which workspace is live on your Waiver Director plan." />
</svelte:head>

<div class="w-full min-w-0 p-4 sm:p-6">
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
		<!-- Page header -->
		<div
			class="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between"
		>
			<div class="min-w-0">
				<p class="text-[10px] font-bold tracking-widest text-muted-foreground/80 uppercase">
					Account
				</p>
				<h1 class="mt-1 text-2xl font-bold tracking-tight text-foreground">Plan usage</h1>
				<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground/90">
					Monitor your current tier boundaries and manage your workspaces.
				</p>
			</div>
			<Button
				href={accountBillingHref}
				variant="outline"
				class="w-full shrink-0 shadow-xs sm:w-auto"
			>
				View billing plans
				<ArrowRightIcon class="size-3.5" aria-hidden="true" />
			</Button>
		</div>

		{#if appContext.isLoading || !billing}
			<!-- Loading state -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
				<Skeleton class="h-[280px] rounded-xl" />
				<Skeleton class="h-[450px] rounded-xl" />
			</div>
		{:else}
			<!-- Responsive 2-column Grid -->
			<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_2fr]">
				<!-- LEFT COLUMN: Plan Details Card -->
				<div class="flex flex-col gap-6">
					<section
						class="overflow-hidden rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs"
						aria-label="Plan details"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/8 text-primary shadow-xs"
								aria-hidden="true"
							>
								<CrownIcon class="size-4.5" />
							</div>
							<div class="min-w-0">
								<p class="text-[10px] font-bold tracking-widest text-muted-foreground/80 uppercase">
									Current Plan
								</p>
								<div class="flex items-center gap-1.5">
									<span class="text-sm font-bold text-foreground">{planName}</span>
									{#if billing.status === 'trialing'}
										<span class="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
											(Trial)
										</span>
									{:else if billing.cancelAtPeriodEnd}
										<span class="text-[10px] font-semibold text-destructive"> (Canceling) </span>
									{/if}
								</div>
							</div>
						</div>
						<Separator class="my-4 border-border/60" />

						<!-- Workspace Usage Progress Bar -->
						<div class="space-y-2">
							<div class="flex items-center justify-between text-xs">
								<span class="font-medium text-muted-foreground">Workspace usage</span>
								<span class="font-bold tabular-nums" class:text-destructive={isOverLimit}>
									{billing.workspaceLimit.ownedWorkspaceCount}
									{#if billing.workspaceLimit.limit !== null}
										/ {billing.workspaceLimit.limit} live
									{:else}
										owned
									{/if}
								</span>
							</div>

							<div
								class="h-2 w-full overflow-hidden rounded-full border border-border/40 bg-muted/60"
							>
								<div
									class={cn(
										'ease-out-back h-full rounded-full transition-all duration-500',
										isOverLimit ? 'bg-destructive' : 'bg-primary'
									)}
									style="width: {limitPercentage}%"
								></div>
							</div>

							<p class="text-[11px] leading-relaxed text-muted-foreground/80">
								{#if isOverLimit}
									You exceed your plan limits. Select which workspace remains active.
								{:else if !isLimited}
									All workspaces are active simultaneously.
								{:else}
									Within your live workspace limits.
								{/if}
							</p>
						</div>

						{#if billing.currentPeriodEnd || billing.trialEndsAt}
							<Separator class="my-4 border-border/60" />
							<div class="flex items-center gap-2 text-xs text-muted-foreground/90">
								<CalendarIcon class="size-3.5 text-muted-foreground/60" aria-hidden="true" />
								<span>
									{#if billing.cancelAtPeriodEnd}Access ends{:else if billing.status === 'trialing'}Trial
										ends{:else}Period ends{/if}:
									<strong class="font-semibold text-foreground"
										>{formatDate(billing.trialEndsAt ?? billing.currentPeriodEnd)}</strong
									>
								</span>
							</div>
						{/if}

						<!-- Collapsible features list to prevent clutter -->
						{#if billing.featureSlugs.length > 0}
							<div class="mt-4 border-t border-border/60 pt-4">
								<button
									type="button"
									onclick={() => (showFeatures = !showFeatures)}
									aria-expanded={showFeatures}
									aria-controls={PLAN_FEATURES_ID}
									class="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground/90 transition-colors hover:text-foreground"
								>
									<span>Plan features ({billing.featureSlugs.length})</span>
									<ChevronDownIcon
										class={cn(
											'size-3.5 text-muted-foreground/60 transition-transform duration-200',
											showFeatures && 'rotate-180 text-foreground'
										)}
									/>
								</button>

								{#if showFeatures}
									<div id={PLAN_FEATURES_ID} transition:slide={{ duration: 200 }}>
										<ul class="mt-3 space-y-2" aria-label="Features included in your plan">
											{#each billing.featureSlugs as feature (feature)}
												<li
													class="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/90"
												>
													<div
														class="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
													>
														<CheckIcon class="size-2.5 stroke-[3]" aria-hidden="true" />
													</div>
													<span class="truncate">
														{#if feature === 'waiver_publishing'}
															Waiver publishing
														{:else if feature === 'booking_integrations'}
															Booking integrations
														{:else if feature === 'email_followups'}
															Email follow-ups
														{:else if feature === 'analytics'}
															Analytics
														{:else if feature === 'pdf_export'}
															PDF export
														{:else if feature === 'team_access'}
															Team access
														{:else if feature === 'multi_workspace'}
															Multiple workspaces
														{:else}
															{feature}
														{/if}
													</span>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{/if}
					</section>
				</div>

				<!-- RIGHT COLUMN: Workspace Manager Selector Card -->
				<div class="flex flex-col gap-6">
					<section
						class="overflow-hidden rounded-xl border border-border/80 bg-card/60 shadow-xs backdrop-blur-xs"
						aria-label="Workspace manager"
					>
						<!-- Alert Header: Dynamic depending on plan and limit status -->
						<div class="border-b border-border/60 bg-muted/5 px-5 py-5">
							{#if isFreePlan}
								<!-- Free User Alert -->
								{#if isOverLimit}
									<div
										class="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
									>
										<ShieldAlertIcon
											class="mt-0.5 size-4.5 shrink-0 text-amber-700 dark:text-amber-400"
											aria-hidden="true"
										/>
										<div class="min-w-0 flex-1 text-xs">
											<h3
												class="text-sm font-bold tracking-tight text-amber-950 dark:text-amber-100"
											>
												Workspace switching requires Pro
											</h3>
											<p class="mt-1 leading-relaxed opacity-95">
												Free plans only allow 1 active workspace and do not support switching active
												workspaces. Upgrade to Pro to toggle which workspace is active, or Business
												to keep all workspaces active.
											</p>
										</div>
									</div>
								{:else}
									<div
										class="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-200"
									>
										<CheckIcon
											class="mt-0.5 size-4.5 shrink-0 text-emerald-600 dark:text-emerald-400"
											aria-hidden="true"
										/>
										<div class="min-w-0 flex-1 text-xs">
											<h3
												class="text-sm font-bold tracking-tight text-emerald-950 dark:text-emerald-100"
											>
												Your workspace is active
											</h3>
											<p class="mt-1 leading-relaxed opacity-95">
												You are using 1 active workspace, which is within the limits of the Free
												plan.
											</p>
										</div>
									</div>
								{/if}
							{:else if isOverLimit}
								<!-- Over-Limit Warning Alert for Pro/Paid Users -->
								<div
									class="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
								>
									<ShieldAlertIcon
										class="mt-0.5 size-4.5 shrink-0 text-amber-700 dark:text-amber-400"
										aria-hidden="true"
									/>
									<div class="min-w-0 flex-1 text-xs">
										<h3 class="text-sm font-bold tracking-tight text-amber-950 dark:text-amber-100">
											One active workspace allowed on {planName}
										</h3>
										<p class="mt-1 leading-relaxed opacity-95">
											Choose which workspace remains live. Paused workspaces remain accessible for
											review, but signing links & integrations are suspended.
										</p>
										{#if canSwitch}
											<p
												class="mt-2.5 flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-100"
											>
												<RefreshCwIcon class="size-3.5 text-amber-700 dark:text-amber-400" />
												{#if billing.workspaceLimit.switchUsedThisPeriod}
													0 switches remaining this period (resets next billing cycle).
												{:else}
													1 switch remaining this billing cycle.
												{/if}
											</p>
										{/if}
									</div>
								</div>
							{:else}
								<!-- Safe / Under Limit Info Alert -->
								<div
									class="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-200"
								>
									<CheckIcon
										class="mt-0.5 size-4.5 shrink-0 text-emerald-600 dark:text-emerald-400"
										aria-hidden="true"
									/>
									<div class="min-w-0 flex-1 text-xs">
										<h3
											class="text-sm font-bold tracking-tight text-emerald-950 dark:text-emerald-100"
										>
											All owned workspaces are active
										</h3>
										<p class="mt-1 leading-relaxed opacity-95">
											Your plan allows unlimited simultaneous active workspaces. All workspaces are
											live.
										</p>
									</div>
								</div>
							{/if}
						</div>

						<!-- List of all owned workspaces -->
						<div class="divide-y divide-border/60" role="list" aria-label="Your owned workspaces">
							{#each ownedWorkspaces as workspace (workspace.workspaceId)}
								<!-- Under unlimited plans, all workspaces are treated as primary/live -->
								{@const isPrimary =
									!isLimited || workspace.workspaceId === billing.workspaceLimit.primaryWorkspaceId}
								{@const isPaused = isLimited && workspace.billing.workspaceLimit.isPaused}
								{@const isSwitching = switchingWorkspaceId === workspace.workspaceId}
								<div
									class="flex items-center justify-between px-5 py-4 transition-colors"
									role="listitem"
								>
									<div class="flex min-w-0 flex-1 items-center gap-3">
										<!-- Avatar initials -->
										<div
											class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted text-xs font-bold text-muted-foreground"
											aria-hidden="true"
										>
											{workspace.name.slice(0, 1).toUpperCase()}
										</div>
										<div class="min-w-0">
											<a
												href={resolve(`/app/${workspace.slug}` as `/app/${string}`)}
												class="text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
											>
												{workspace.name}
											</a>
											{#if isPaused}
												<p class="text-xs text-muted-foreground">
													Paused — signing links & integrations are suspended
												</p>
											{/if}
										</div>
									</div>

									<!-- Action section -->
									<div class="shrink-0 pl-4">
										{#if isPrimary || !isLimited}
											<span
												class="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
											>
												<CheckIcon class="size-3.5" aria-hidden="true" />
												Active
											</span>
										{:else}
											<div class="flex items-center">
												{#if isFreePlan}
													<!-- Free user cannot activate, must upgrade -->
													<Button
														href={accountBillingHref}
														variant="outline"
														size="sm"
														class="h-8 border-primary/30 text-xs font-semibold text-primary shadow-xs transition-all hover:scale-[1.02] hover:bg-primary hover:text-primary-foreground"
														aria-label="Upgrade plan to activate {workspace.name}"
													>
														Upgrade to activate
													</Button>
												{:else}
													<!-- Pro user activate -->
													<Button
														variant="outline"
														size="sm"
														disabled={!billing.workspaceLimit.canSwitchPrimaryWorkspace ||
															switchingWorkspaceId !== null}
														onclick={() => void makePrimary(workspace.workspaceId)}
														class="h-8 text-xs font-semibold shadow-xs transition-transform hover:scale-[1.02] active:scale-[0.98]"
														aria-label="Make {workspace.name} the active workspace"
													>
														{#if isSwitching}
															<LoaderIcon class="size-3 animate-spin" aria-hidden="true" />
														{:else}
															Activate
														{/if}
													</Button>
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>

						<!-- Footer info and upgrade CTA -->
						<div
							class="flex flex-col gap-4 border-t border-border/60 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="flex min-w-0 items-start gap-2 text-xs text-muted-foreground/90">
								<RefreshCwIcon
									class="mt-0.5 size-3 shrink-0 text-muted-foreground/50"
									aria-hidden="true"
								/>
								<span>
									{#if isFreePlan}
										Free plans do not support switching active workspaces.
									{:else if billing.workspaceLimit.switchUsedThisPeriod}
										Workspace switch limit reached this period. It will reset when your period ends.
									{:else}
										You can toggle which workspace is active once per billing cycle.
									{/if}
								</span>
							</div>
							{#if isLimited}
								<Button href={accountBillingHref} size="sm" class="shrink-0 shadow-xs">
									<CrownIcon class="size-3.5" aria-hidden="true" />
									Upgrade for all workspaces
								</Button>
							{/if}
						</div>
					</section>
				</div>
			</div>
		{/if}
	</div>
</div>
