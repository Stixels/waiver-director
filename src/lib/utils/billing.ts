export function billingUpgradeHref(workspaceSlug: string, workspacePausedOnPro: boolean) {
	return workspacePausedOnPro
		? `/app/${workspaceSlug}/account/plan`
		: `/app/${workspaceSlug}/account#/billing/plans`;
}
