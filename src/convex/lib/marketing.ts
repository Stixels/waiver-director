import { v } from 'convex/values';

export const marketingProviderValidator = v.union(
	v.literal('mailchimp'),
	v.literal('constant_contact')
);

export const marketingIntegrationStatusValidator = v.union(
	v.literal('pending_configuration'),
	v.literal('connected'),
	v.literal('error'),
	v.literal('disconnected')
);

export function marketingConsentLabel(workspaceName: string) {
	return `Yes, I would like to receive marketing emails and promotions from ${workspaceName}.`;
}
