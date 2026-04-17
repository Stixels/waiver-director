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

	waiver_templates: defineTable({
		workspaceId: v.id('workspaces'),
		title: v.string(),
		introCopy: v.string(),
		fields: v.array(
			v.union(
				v.object({
					id: v.string(),
					type: v.literal('shortText'),
					label: v.string(),
					required: v.boolean(),
					placeholder: v.optional(v.string())
				}),
				v.object({
					id: v.string(),
					type: v.literal('longText'),
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
		lastPublishedVersionId: v.optional(v.id('waiver_template_versions')),
		archivedAt: v.optional(v.number())
	}).index('by_workspaceId', ['workspaceId']),

	waiver_template_versions: defineTable({
		workspaceId: v.id('workspaces'),
		templateId: v.id('waiver_templates'),
		versionNumber: v.number(),
		title: v.string(),
		introCopy: v.string(),
		fields: v.array(
			v.union(
				v.object({
					id: v.string(),
					type: v.literal('shortText'),
					label: v.string(),
					required: v.boolean(),
					placeholder: v.optional(v.string())
				}),
				v.object({
					id: v.string(),
					type: v.literal('longText'),
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
		.index('by_templateId', ['templateId'])
		.index('by_templateId_and_versionNumber', ['templateId', 'versionNumber']),

	public_waiver_links: defineTable({
		workspaceId: v.id('workspaces'),
		versionId: v.id('waiver_template_versions'),
		slug: v.string(),
		status: v.union(v.literal('active'), v.literal('inactive'))
	})
		.index('by_slug', ['slug'])
		.index('by_workspaceId', ['workspaceId'])
		.index('by_versionId', ['versionId'])
		.index('by_workspaceId_and_status', ['workspaceId', 'status']),

	waiver_submissions: defineTable({
		workspaceId: v.id('workspaces'),
		publicLinkId: v.id('public_waiver_links'),
		templateId: v.id('waiver_templates'),
		versionId: v.id('waiver_template_versions'),
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
		.index('by_publicLinkId', ['publicLinkId'])
		.index('by_versionId', ['versionId'])
		.index('by_templateId', ['templateId'])
});
