import { v } from 'convex/values';
import type { Infer } from 'convex/values';

/**
 * Evidence captured when a waiver is signed. Server-observed values (IP, user
 * agent, hashes, receivedAt) are authoritative; `client*` timestamps are
 * reported by the signer's browser, sanity-checked against server time, and
 * kept for context only.
 */
export const submissionAuditValidator = v.object({
	captureMethod: v.literal('http_action'),
	ipAddress: v.union(v.string(), v.null()),
	forwardedFor: v.union(v.string(), v.null()),
	userAgent: v.union(v.string(), v.null()),
	hashAlgorithm: v.literal('SHA-256'),
	documentHash: v.string(),
	submissionHash: v.string(),
	electronicSignatureConsentText: v.string(),
	receivedAt: v.number(),
	clientFormOpenedAt: v.union(v.number(), v.null()),
	clientConsentAcceptedAt: v.union(v.number(), v.null()),
	clientSignatureCompletedAt: v.union(v.number(), v.null())
});

export type SubmissionAudit = Infer<typeof submissionAuditValidator>;

export const submissionAuditRequestValidator = v.object({
	ipAddress: v.union(v.string(), v.null()),
	forwardedFor: v.union(v.string(), v.null()),
	userAgent: v.union(v.string(), v.null())
});

export const submissionClientTimingValidator = v.object({
	formOpenedAt: v.optional(v.number()),
	consentAcceptedAt: v.optional(v.number()),
	signatureCompletedAt: v.optional(v.number())
});
