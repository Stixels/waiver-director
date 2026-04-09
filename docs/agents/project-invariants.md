# Project Invariants

## Mission

Build and maintain Waiver Director as a multi-tenant SaaS for waiver operations, where each workspace is strictly isolated and owns its own data, branding, workflows, and reporting.

## Non-Negotiable Invariants

- Treat tenant isolation as critical: never mix or infer cross-workspace data access.
- Use server-side identity and membership checks for authorization decisions.
- Preserve immutable signed-record behavior for waiver submissions and related auditability.
- Keep external booking providers as integration boundaries, not sources of internal authorization truth.
