import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({
		displayName: v.optional(v.string()),
		primaryEmail: v.optional(v.string()),
		imageUrl: v.optional(v.string()),
		defaultWorkspaceId: v.optional(v.id('workspaces'))
	}).index('by_primaryEmail', ['primaryEmail']),

	// App-owned mapping between internal users and whichever auth provider is active.
	auth_identities: defineTable({
		userId: v.id('users'),
		provider: v.union(v.literal('clerk'), v.literal('better-auth')),
		providerUserId: v.string(),
		tokenIdentifier: v.string(),
		email: v.optional(v.string()),
		emailVerified: v.optional(v.boolean())
	})
		.index('by_provider_and_providerUserId', ['provider', 'providerUserId'])
		.index('by_tokenIdentifier', ['tokenIdentifier'])
		.index('by_userId', ['userId']),

	workspaces: defineTable({
		name: v.string(),
		slug: v.string(),
		status: v.union(v.literal('active'), v.literal('archived')),
		createdByUserId: v.optional(v.id('users'))
	})
		.index('by_slug', ['slug'])
		.index('by_createdByUserId', ['createdByUserId']),

	workspace_memberships: defineTable({
		workspaceId: v.id('workspaces'),
		userId: v.id('users'),
		role: v.union(v.literal('owner'), v.literal('staff')),
		status: v.union(v.literal('active'), v.literal('invited'), v.literal('suspended'))
	})
		.index('by_userId', ['userId'])
		.index('by_workspaceId', ['workspaceId'])
		.index('by_userId_and_workspaceId', ['userId', 'workspaceId'])
		.index('by_workspaceId_and_userId', ['workspaceId', 'userId']),

	workspace_waivers: defineTable({
		workspaceId: v.id('workspaces'),
		publicSlug: v.string(),
		publishedVersionId: v.optional(v.id('waiver_versions')),
		title: v.string(),
		introCopy: v.string(),
		fields: v.array(
			v.union(
				v.object({
					id: v.string(),
					type: v.literal('text'),
					label: v.string(),
					required: v.boolean(),
					placeholder: v.optional(v.string())
				}),
				v.object({
					id: v.string(),
					type: v.literal('checkbox'),
					label: v.string(),
					required: v.boolean()
				}),
				v.object({
					id: v.string(),
					type: v.literal('select'),
					label: v.string(),
					required: v.boolean(),
					options: v.array(
						v.object({
							id: v.string(),
							label: v.string()
						})
					)
				}),
				v.object({
					id: v.string(),
					type: v.literal('date'),
					label: v.string(),
					required: v.boolean()
				})
			)
		)
	})
		.index('by_workspaceId', ['workspaceId'])
		.index('by_publicSlug', ['publicSlug']),

	waiver_versions: defineTable({
		workspaceId: v.id('workspaces'),
		waiverId: v.id('workspace_waivers'),
		versionNumber: v.number(),
		title: v.string(),
		introCopy: v.string(),
		fields: v.array(
			v.union(
				v.object({
					id: v.string(),
					type: v.literal('text'),
					label: v.string(),
					required: v.boolean(),
					placeholder: v.optional(v.string())
				}),
				v.object({
					id: v.string(),
					type: v.literal('checkbox'),
					label: v.string(),
					required: v.boolean()
				}),
				v.object({
					id: v.string(),
					type: v.literal('select'),
					label: v.string(),
					required: v.boolean(),
					options: v.array(
						v.object({
							id: v.string(),
							label: v.string()
						})
					)
				}),
				v.object({
					id: v.string(),
					type: v.literal('date'),
					label: v.string(),
					required: v.boolean()
				})
			)
		),
		publishedAt: v.number()
	})
		.index('by_workspaceId', ['workspaceId'])
		.index('by_waiverId', ['waiverId'])
		.index('by_waiverId_and_versionNumber', ['waiverId', 'versionNumber']),

	waiver_submissions: defineTable({
		workspaceId: v.id('workspaces'),
		versionId: v.id('waiver_versions'),
		signerName: v.string(),
		signerEmail: v.string(),
		signerDateOfBirth: v.string(),
		signatureDataUrl: v.string(),
		answers: v.record(v.string(), v.union(v.string(), v.boolean(), v.null())),
		minors: v.array(
			v.object({
				fullName: v.string()
			})
		),
		status: v.union(v.literal('submitted')),
		submittedAt: v.number()
	})
		.index('by_workspaceId', ['workspaceId'])
		.index('by_versionId', ['versionId']),

	email_templates: defineTable({
		workspaceId: v.id('workspaces'),
		subject: v.string(),
		body: v.string(),
		sendAfterHours: v.number(),
		updatedAt: v.number()
	}).index('by_workspaceId', ['workspaceId']),

	email_template_presets: defineTable({
		workspaceId: v.id('workspaces'),
		name: v.string(),
		subject: v.string(),
		body: v.string(),
		sendAfterHours: v.number(),
		createdAt: v.number()
	}).index('by_workspaceId', ['workspaceId']),

	email_follow_ups: defineTable({
		workspaceId: v.id('workspaces'),
		submissionId: v.id('waiver_submissions'),
		signerName: v.string(),
		signerEmail: v.string(),
		subjectTemplate: v.optional(v.string()),
		bodyTemplate: v.optional(v.string()),
		submittedAt: v.number(),
		scheduledAt: v.number(),
		status: v.union(
			v.literal('queued'),
			v.literal('sent'),
			v.literal('cancelled'),
			v.literal('paused'),
			v.literal('failed')
		),
		scheduledFunctionId: v.optional(v.id('_scheduled_functions')),
		sentAt: v.optional(v.number()),
		sentSubject: v.optional(v.string()),
		sentBodyHtml: v.optional(v.string()),
		failedAt: v.optional(v.number()),
		failureReason: v.optional(v.string()),
		cancelledAt: v.optional(v.number())
	})
		.index('by_workspaceId', ['workspaceId'])
		.index('by_workspaceId_and_status', ['workspaceId', 'status'])
		.index('by_workspaceId_and_status_and_sentAt', ['workspaceId', 'status', 'sentAt'])
		.index('by_submissionId', ['submissionId'])
});
