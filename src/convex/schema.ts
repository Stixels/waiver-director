import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { bookingProviderValidator, bookingSnapshotValidator } from './lib/bookings';

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
		createdByUserId: v.optional(v.id('users')),
		customerCount: v.number()
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

	customers: defineTable({
		workspaceId: v.id('workspaces'),
		normalizedEmail: v.string(),
		primaryEmail: v.string(),
		searchText: v.string(),
		displayName: v.string(),
		firstSeenAt: v.number(),
		lastSeenAt: v.number(),
		visitCount: v.number(),
		latestSubmissionId: v.id('waiver_submissions'),
		latestBookingId: v.optional(v.id('bookings'))
	})
		.index('by_workspaceId', ['workspaceId'])
		.index('by_workspaceId_and_normalizedEmail', ['workspaceId', 'normalizedEmail'])
		.index('by_workspaceId_and_lastSeenAt', ['workspaceId', 'lastSeenAt'])
		.searchIndex('search_customerText', {
			searchField: 'searchText',
			filterFields: ['workspaceId']
		}),

	waiver_submissions: defineTable({
		workspaceId: v.id('workspaces'),
		versionId: v.id('waiver_versions'),
		customerId: v.optional(v.id('customers')),
		bookingId: v.optional(v.id('bookings')),
		bookingSnapshot: v.optional(bookingSnapshotValidator),
		signerName: v.string(),
		signerEmail: v.string(),
		searchText: v.string(),
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
		.index('by_bookingId', ['bookingId'])
		.index('by_customerId_and_submittedAt', ['customerId', 'submittedAt'])
		.searchIndex('search_submissionText', {
			searchField: 'searchText',
			filterFields: ['workspaceId']
		}),

	booking_integrations: defineTable({
		workspaceId: v.id('workspaces'),
		provider: bookingProviderValidator,
		status: v.union(
			v.literal('connected'),
			v.literal('syncing'),
			v.literal('error'),
			v.literal('disconnected')
		),
		encryptedApiKey: v.optional(v.string()),
		apiKeyLast4: v.optional(v.string()),
		accountId: v.optional(v.string()),
		permissions: v.array(v.string()),
		syncHorizonMonths: v.number(),
		lastSyncError: v.optional(v.string()),
		connectedAt: v.optional(v.number()),
		disconnectedAt: v.optional(v.number()),
		updatedAt: v.number()
	})
		.index('by_workspaceId', ['workspaceId'])
		.index('by_workspaceId_and_provider', ['workspaceId', 'provider']),

	booking_connection_sessions: defineTable({
		workspaceId: v.id('workspaces'),
		provider: bookingProviderValidator,
		requestedByUserId: v.id('users'),
		state: v.string(),
		status: v.union(
			v.literal('pending'),
			v.literal('completed'),
			v.literal('failed'),
			v.literal('expired')
		),
		syncHorizonMonths: v.number(),
		createdAt: v.number(),
		expiresAt: v.number()
	})
		.index('by_state', ['state'])
		.index('by_workspaceId', ['workspaceId'])
		.index('by_status_and_expiresAt', ['status', 'expiresAt'])
		.index('by_status_and_createdAt', ['status', 'createdAt']),

	bookings: defineTable({
		workspaceId: v.id('workspaces'),
		integrationId: v.id('booking_integrations'),
		provider: bookingProviderValidator,
		providerBookingId: v.string(),
		lookupToken: v.string(),
		searchText: v.string(),
		status: v.union(v.literal('active'), v.literal('canceled')),
		activityName: v.string(),
		startTime: v.optional(v.string()),
		endTime: v.optional(v.string()),
		startAt: v.optional(v.number()),
		endAt: v.optional(v.number()),
		serviceDate: v.optional(v.string()),
		leadCustomerName: v.optional(v.string()),
		leadCustomerEmail: v.optional(v.string()),
		participantCount: v.number(),
		signedCount: v.number(),
		updatedAt: v.number()
	})
		.index('by_workspaceId', ['workspaceId'])
		.index('by_integrationId', ['integrationId'])
		.index('by_lookupToken', ['lookupToken'])
		// Public booking lookup intentionally matches providerBookingId within a workspace.
		// A workspace may only connect one booking provider integration at a time.
		.index('by_workspaceId_and_providerBookingId', ['workspaceId', 'providerBookingId'])
		.index('by_workspaceId_and_provider_and_providerBookingId', [
			'workspaceId',
			'provider',
			'providerBookingId'
		])
		.index('by_workspaceId_and_startAt', ['workspaceId', 'startAt'])
		.index('by_workspaceId_and_leadCustomerEmail_and_serviceDate', [
			'workspaceId',
			'leadCustomerEmail',
			'serviceDate'
		])
		.searchIndex('search_bookingText', {
			searchField: 'searchText',
			filterFields: ['workspaceId']
		}),

	booking_webhook_events: defineTable({
		workspaceId: v.id('workspaces'),
		integrationId: v.id('booking_integrations'),
		provider: bookingProviderValidator,
		messageId: v.string(),
		eventType: v.string(),
		itemId: v.string(),
		rawBody: v.string(),
		status: v.union(
			v.literal('received'),
			v.literal('processed'),
			v.literal('ignored'),
			v.literal('failed')
		),
		receivedAt: v.number(),
		processedAt: v.optional(v.number()),
		errorMessage: v.optional(v.string())
	})
		.index('by_workspaceId', ['workspaceId'])
		.index('by_integrationId', ['integrationId'])
		.index('by_integrationId_and_messageId', ['integrationId', 'messageId'])
});
