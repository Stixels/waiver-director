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
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';
	import { slide } from 'svelte/transition';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CrownIcon from '@lucide/svelte/icons/crown';
	import InfinityIcon from '@lucide/svelte/icons/infinity';
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
	const planStatus = $derived.by(() => {
		if (billing?.status === 'trialing') {
			return {
				label: 'Trial',
				class: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
			};
		}
		if (billing?.cancelAtPeriodEnd) {
			return {
				label: 'Canceling',
				class: 'border-destructive/30 bg-destructive/10 text-destructive'
			};
		}
		if (billing?.isActive && !isFreePlan) {
			return {
				label: 'Active',
				class: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
			};
		}
		return null;
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

	const FEATURE_LABELS: Record<string, string> = {
		waiver_publishing: 'Waiver publishing',
		booking_integrations: 'Booking integrations',
		email_followups: 'Email follow-ups',
		analytics: 'Analytics',
		pdf_export: 'PDF export',
		team_access: 'Team access',
		multi_workspace: 'Multiple workspaces'
	};

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

	const managerBanner = $derived.by(() => {
		if (!billing) return null;
		if (isFreePlan) {
			if (isOverLimit) {
				return {
					tone: 'warn' as const,
					title: 'Workspace switching requires Pro',
					body: 'Free plans keep a single workspace live and can’t switch between them. Upgrade to Pro to toggle the live workspace, or Business to keep every workspace live.'
				};
			}
			return {
				tone: 'ok' as const,
				title: 'Your workspace is live',
				body: 'You are using 1 live workspace, which is within the Free plan limit.'
			};
		}
		if (isOverLimit) {
			return {
				tone: 'warn' as const,
				title: `Only one workspace stays live on ${planName}`,
				body: 'Choose which workspace remains live. Paused workspaces stay readable for review, but their signing links and integrations are suspended.'
			};
		}
		return {
			tone: 'ok' as const,
			title: 'All workspaces are live',
			body: 'Your plan keeps every owned workspace live at the same time.'
		};
	});
</script>

<svelte:head>
	<title>Plan usage | Waiver Director</title>
	<meta name="description" content="Manage which workspace is live on your Waiver Director plan." />
</svelte:head>

<div class="w-full min-w-0 p-4 sm:p-6">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
		<!-- Page header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div class="min-w-0">
				<p class="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
					Account
				</p>
				<h1 class="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Plan usage</h1>
				<p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Track your plan limits and choose which workspaces stay live.
				</p>
			</div>
			<Button href={accountBillingHref} variant="outline" class="w-full shrink-0 sm:w-auto">
				View billing plans
				<ArrowRightIcon class="size-3.5" aria-hidden="true" />
			</Button>
		</div>

		{#if appContext.isLoading || !billing}
			<!-- Loading state -->
			<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
				<!-- Plan summary skeleton -->
				<div class="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<Skeleton class="size-11 shrink-0 rounded-xl" />
							<div class="space-y-2">
								<Skeleton class="h-3 w-20" />
								<Skeleton class="h-5 w-16" />
							</div>
						</div>
						<Skeleton class="h-5 w-14 rounded-full" />
					</div>
					<div class="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
						<div class="flex items-center justify-between">
							<Skeleton class="h-3 w-24" />
							<Skeleton class="h-4 w-10" />
						</div>
						<Skeleton class="h-2 w-full rounded-full" />
						<Skeleton class="h-3 w-3/4" />
					</div>
					<Skeleton class="h-4 w-40" />
					<div class="border-t border-border/70 pt-4">
						<Skeleton class="h-4 w-36" />
					</div>
				</div>

				<!-- Workspace manager skeleton -->
				<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
					<div class="flex items-start gap-3 border-b border-border/70 px-6 py-5">
						<Skeleton class="size-5 shrink-0 rounded-full" />
						<div class="flex-1 space-y-2">
							<Skeleton class="h-4 w-1/2" />
							<Skeleton class="h-3 w-full" />
							<Skeleton class="h-3 w-2/3" />
						</div>
					</div>
					<div class="divide-y divide-border/70">
						{#each [0, 1, 2] as index (index)}
							<div class="flex items-center justify-between gap-3 px-6 py-4">
								<div class="flex flex-1 items-center gap-3">
									<Skeleton class="size-9 shrink-0 rounded-xl" />
									<Skeleton class="h-4 w-32" />
								</div>
								<Skeleton class="h-6 w-16 rounded-full" />
							</div>
						{/each}
					</div>
					<div
						class="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-4"
					>
						<Skeleton class="h-3 w-60" />
						<Skeleton class="h-8 w-44 rounded-md" />
					</div>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
				<!-- LEFT COLUMN: Plan summary -->
				<section
					class="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
					aria-label="Plan summary"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex items-center gap-3">
							<div
								class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
								aria-hidden="true"
							>
								<CrownIcon class="size-5" />
							</div>
							<div class="min-w-0">
								<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
									Current plan
								</p>
								<p class="text-lg font-bold tracking-tight text-foreground">{planName}</p>
							</div>
						</div>
						{#if planStatus}
							<Badge variant="outline" class={cn('mt-0.5', planStatus.class)}>
								{planStatus.label}
							</Badge>
						{/if}
					</div>

					<!-- Workspace usage -->
					<div class="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
						<div class="flex items-baseline justify-between">
							<span class="text-xs font-medium text-muted-foreground">Live workspaces</span>
							<span class="text-sm font-bold tabular-nums" class:text-destructive={isOverLimit}>
								{billing.workspaceLimit
									.ownedWorkspaceCount}{#if billing.workspaceLimit.limit !== null}<span
										class="font-medium text-muted-foreground"
									>
										/ {billing.workspaceLimit.limit}</span
									>{/if}
							</span>
						</div>

						{#if isLimited}
							<div class="h-2 w-full overflow-hidden rounded-full bg-border/70">
								<div
									class={cn(
										'h-full rounded-full transition-all duration-500 ease-out',
										isOverLimit ? 'bg-destructive' : 'bg-primary'
									)}
									style="width: {limitPercentage}%"
								></div>
							</div>
							<p class="text-[11px] leading-relaxed text-muted-foreground">
								{#if isOverLimit}
									You’re over your limit — choose which workspace stays live below.
								{:else}
									You’re within your live workspace limit.
								{/if}
							</p>
						{:else}
							<div
								class="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
							>
								<InfinityIcon class="size-4" aria-hidden="true" />
								Unlimited live workspaces
							</div>
						{/if}
					</div>

					{#if billing.currentPeriodEnd || billing.trialEndsAt}
						<div class="flex items-center gap-2 text-xs text-muted-foreground">
							<CalendarIcon class="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
							<span>
								{#if billing.cancelAtPeriodEnd}Access ends{:else if billing.status === 'trialing'}Trial
									ends{:else}Renews{/if}
								<strong class="font-semibold text-foreground"
									>{formatDate(billing.trialEndsAt ?? billing.currentPeriodEnd)}</strong
								>
							</span>
						</div>
					{/if}

					<!-- Collapsible features list -->
					{#if billing.featureSlugs.length > 0}
						<div class="border-t border-border/70 pt-4">
							<button
								type="button"
								onclick={() => (showFeatures = !showFeatures)}
								aria-expanded={showFeatures}
								aria-controls={PLAN_FEATURES_ID}
								class="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
							>
								<span>Included features ({billing.featureSlugs.length})</span>
								<ChevronDownIcon
									class={cn(
										'size-4 text-muted-foreground/70 transition-transform duration-200',
										showFeatures && 'rotate-180 text-foreground'
									)}
								/>
							</button>

							{#if showFeatures}
								<div id={PLAN_FEATURES_ID} transition:slide={{ duration: 200 }}>
									<ul class="mt-3 grid gap-2" aria-label="Features included in your plan">
										{#each billing.featureSlugs as feature (feature)}
											<li class="flex items-center gap-2 text-xs text-foreground">
												<div
													class="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
												>
													<CheckIcon class="size-2.5 stroke-3" aria-hidden="true" />
												</div>
												<span class="truncate">{FEATURE_LABELS[feature] ?? feature}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/if}
				</section>

				<!-- RIGHT COLUMN: Workspace manager -->
				<section
					class="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
					aria-label="Workspace manager"
				>
					<!-- Status banner -->
					{#if managerBanner}
						<div
							class={cn(
								'flex items-start gap-3 border-b border-border/70 px-6 py-5',
								managerBanner.tone === 'warn'
									? 'bg-amber-500/5 dark:bg-amber-500/10'
									: 'bg-emerald-500/5 dark:bg-emerald-500/10'
							)}
						>
							{#if managerBanner.tone === 'warn'}
								<ShieldAlertIcon
									class="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
									aria-hidden="true"
								/>
							{:else}
								<CheckIcon
									class="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
									aria-hidden="true"
								/>
							{/if}
							<div class="min-w-0 flex-1">
								<h2 class="text-sm font-bold tracking-tight text-foreground">
									{managerBanner.title}
								</h2>
								<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
									{managerBanner.body}
								</p>
								{#if managerBanner.tone === 'warn' && canSwitch}
									<p
										class="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
									>
										<RefreshCwIcon class="size-3.5" aria-hidden="true" />
										{#if billing.workspaceLimit.switchUsedThisPeriod}
											No switches left this period — resets next billing cycle.
										{:else}
											1 switch remaining this billing cycle.
										{/if}
									</p>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Owned workspaces -->
					<div class="divide-y divide-border/70" role="list" aria-label="Your owned workspaces">
						{#each ownedWorkspaces as workspace (workspace.workspaceId)}
							<!-- Under unlimited plans, all workspaces are treated as live -->
							{@const isPrimary =
								!isLimited || workspace.workspaceId === billing.workspaceLimit.primaryWorkspaceId}
							{@const isPaused = isLimited && workspace.billing.workspaceLimit.isPaused}
							{@const isSwitching = switchingWorkspaceId === workspace.workspaceId}
							<div
								class={cn(
									'flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-muted/30',
									isPaused && 'opacity-65'
								)}
								role="listitem"
							>
								<div class="flex min-w-0 flex-1 items-center gap-3">
									<div
										class={cn(
											'flex size-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold',
											isPrimary
												? 'border-primary/20 bg-primary/10 text-primary'
												: 'border-border bg-muted text-muted-foreground'
										)}
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
											<p class="mt-0.5 text-xs text-muted-foreground">
												Paused · signing links & integrations suspended
											</p>
										{/if}
									</div>
								</div>

								<!-- Action -->
								<div class="shrink-0">
									{#if isPrimary || !isLimited}
										<Badge
											variant="outline"
											class="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
										>
											<CheckIcon class="size-3" aria-hidden="true" />
											Live
										</Badge>
									{:else if isFreePlan}
										<Button
											href={accountBillingHref}
											variant="outline"
											size="sm"
											class="h-8 text-xs font-semibold"
											aria-label="Upgrade plan to activate {workspace.name}"
										>
											Upgrade to activate
										</Button>
									{:else}
										<Button
											variant="outline"
											size="sm"
											disabled={!billing.workspaceLimit.canSwitchPrimaryWorkspace ||
												switchingWorkspaceId !== null}
											onclick={() => void makePrimary(workspace.workspaceId)}
											class="h-8 text-xs font-semibold"
											aria-label="Make {workspace.name} the live workspace"
										>
											{#if isSwitching}
												<LoaderIcon class="size-3 animate-spin" aria-hidden="true" />
												Switching
											{:else}
												Make live
											{/if}
										</Button>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Footer info and upgrade CTA -->
					<div
						class="flex flex-col gap-3 border-t border-border/70 bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
							<RefreshCwIcon
								class="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60"
								aria-hidden="true"
							/>
							<span>
								{#if isFreePlan}
									Free plans can’t switch the live workspace.
								{:else if billing.workspaceLimit.switchUsedThisPeriod}
									Switch limit reached — it resets when your billing period ends.
								{:else}
									You can switch the live workspace once per billing cycle.
								{/if}
							</span>
						</div>
						{#if isLimited}
							<Button href={accountBillingHref} size="sm" class="shrink-0">
								<CrownIcon class="size-3.5" aria-hidden="true" />
								Upgrade for all workspaces
							</Button>
						{/if}
					</div>
				</section>
			</div>
		{/if}
	</div>
</div>
