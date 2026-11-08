import { v } from 'convex/values';

export const webhookEventTypeValidator = v.literal('submission.created');
export const webhookDeliveryEventTypeValidator = v.union(
	webhookEventTypeValidator,
	v.literal('webhook.test')
);
export const webhookEndpointStatusValidator = v.union(v.literal('active'), v.literal('disabled'));
export const webhookDeliveryStatusValidator = v.union(
	v.literal('pending'),
	v.literal('succeeded'),
	v.literal('failed'),
	v.literal('canceled')
);
