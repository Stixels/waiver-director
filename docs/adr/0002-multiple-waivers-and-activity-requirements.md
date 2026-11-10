# Multiple waivers and activity-specific requirements

Waiver Director will let a workspace keep several waivers and require different waivers per activity, because operators who run a mix of tours, rentals and classes need separate terms (a zipline release, an equipment rental agreement, a medical questionnaire) and today they can only publish one. Competitors (Smartwaiver, WaiverForever, WaiverSign) all support this; it was the top builder-depth gap in the competitor review.

We keep the existing `workspace_waivers` table as the waiver template and allow many rows per workspace, rather than introducing a new template table, so every existing public link, version, and signed submission keeps working with no data migration. One waiver is the **Default Waiver Requirement**. An **Activity-Specific Requirement** replaces the default for one activity and lists one or more waivers in order; it never silently adds waivers on top of the default. Signed submissions stay tied to an immutable `waiver_versions` row, so the waiver a guest signed is always recoverable.

## Decisions

- **Default waiver.** `workspace_waivers.isDefault` marks it. Legacy rows have no flag; the oldest active waiver is the default, so existing workspaces need no backfill. New workspaces set the flag on creation.
- **Archive, never delete.** `status: 'archived'` takes a waiver out of the builder, its public link, and requirements. Versions and signed submissions remain. The default waiver can't be archived.
- **Requirements keyed by activity name for now.** `activity_waiver_requirements` stores `activityKey` (the normalized booking `activityName`) and an ordered `waiverIds` list. Bookings don't carry a provider activity identity yet; when they do, add `providerActivityId` and match on it first, falling back to the name. This is a deliberate, documented shortcut: a provider-side rename detaches the requirement until the operator re-maps it.
- **Booking links keep their URL.** Links are still built from the default waiver slug. When a booking's activity requires other waivers, the public booking page redirects to the first required waiver and lists the rest, with a "continue to next waiver" step after each submission.
- **One visit per booking, counted on the primary waiver.** The primary waiver is the first required waiver guests can sign (published and active). Only its submissions increase `bookings.signedCount`, count as a customer visit, and schedule the follow-up email, so a booking needing two waivers is not double counted or double emailed. True per-waiver coverage is a follow-up (below).
- **Owner-only management.** Creating, archiving, changing the default, and editing requirements are High-Impact Configuration and require the Owner role. Staff can view requirements.
- **Limits.** 25 active waivers per workspace and 5 waivers per activity requirement, to keep bounded queries and a usable signing flow.

## Shipped in the first slice

- Schema: `isDefault`, `status`, `archivedAt` on `workspace_waivers`; new `activity_waiver_requirements` table (included in workspace cleanup).
- Convex: `listWorkspaceWaivers`, `createWorkspaceWaiver`, `setDefaultWorkspaceWaiver`, `archiveWorkspaceWaiver`, `listActivityWaiverRequirements`, `setActivityWaiverRequirement`; `getWorkspaceWaiver` and `listWaiverVersions` take an optional `waiverId` (omitted means default, so existing callers are unchanged); public queries reject archived waivers; `getPublicWaiverForBooking` returns `requiredWaivers`.
- UI: waiver switcher and "New waiver" in the builder, "Make default" and "Archive" actions, an Activity requirements sheet, and the multi-waiver step list on the public booking page.

## Follow-ups (not in this slice)

1. **Per-waiver coverage on bookings.** Replace the single `signedCount` with coverage per required waiver (covered participants = the minimum across required waivers), recomputed when requirements change. Update dashboard waiver-gap views and booking detail to show which waiver is missing.
2. **Provider activity identity.** Sync activities from Bookeo/Xola into an `activities` table with `providerActivityId` (see CONTEXT.md, Activity Identity) and key requirements on it.
3. **Single signing session for several documents** (WaiverSign style): sign once, apply to every required waiver. This needs a decision on whether one signature can legally cover several documents; until then, each waiver is a separate signed submission.
4. **Per-waiver filters** in submissions, analytics, CSV export, and follow-up emails (e.g. a different follow-up per waiver).
5. **Kiosk** (ADR 0001) should list required waivers for the looked-up booking using the same resolver.

## Considered options

- **A separate `waiver_templates` table** with `workspace_waivers` kept as a pointer. Cleaner naming, but every public slug, version and submission would need a migration for no behavioral gain.
- **Additive requirements** (default plus extras). Rejected: CONTEXT.md defines activity requirements as replacing the default, and additive rules hide extra waivers from operators.
- **Per-booking waiver selection by staff.** Too manual for synced bookings; can be layered later as an override.
