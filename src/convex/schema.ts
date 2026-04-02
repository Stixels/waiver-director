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
		.index('by_workspaceId_and_userId', ['workspaceId', 'userId'])
});
