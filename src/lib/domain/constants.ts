export const workspaceRoles = ['owner', 'staff'] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export const membershipStatuses = ['active', 'invited', 'suspended'] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const authProviderIds = ['clerk', 'better-auth'] as const;
export type AuthProviderId = (typeof authProviderIds)[number];

export const bookingProviderIds = ['bookeo', 'resova', 'xola'] as const;
export type BookingProviderId = (typeof bookingProviderIds)[number];

export const sourceKinds = ['manual', 'provider'] as const;
export type SourceKind = (typeof sourceKinds)[number];

export const syncStates = ['idle', 'pending', 'healthy', 'error'] as const;
export type SyncState = (typeof syncStates)[number];
