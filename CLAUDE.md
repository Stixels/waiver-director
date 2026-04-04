# AGENTS.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `src/convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

## Mission

Build and maintain Waiver Director as a multi-tenant SaaS for waiver operations, where each workspace is strictly isolated and owns its own data, branding, workflows, and reporting.

## Non-Negotiable Invariants

- Treat tenant isolation as critical: never mix or infer cross-workspace data access.
- Use server-side identity and membership checks for authorization decisions.
- Preserve immutable signed-record behavior for waiver submissions and related auditability.
- Keep external booking providers as integration boundaries, not sources of internal authorization truth.

## Authentication (Clerk)

- Use [Clerk](https://clerk.com) as the identity provider for the SvelteKit app.
- Wire Convex authentication through Clerk JWTs in `auth.config.ts`.
- Treat Clerk as "who is signed in" only; enforce workspace access and roles in trusted Convex server code via membership checks.
- Keep local app users keyed by `identity.tokenIdentifier`; do not trust client-passed user ids for authorization decisions.
- Reference implementation guide: [Convex + Clerk auth docs](https://docs.convex.dev/auth/clerk).
- Better Auth may be evaluated in a future phase, but do not migrate auth providers or add Better Auth dependencies unless explicitly requested.

## Svelte 5 and SvelteKit Guardrails

- Follow existing Svelte 5 runes-mode patterns used in this repository.
- Keep route boundaries clear: public marketing/auth flows, protected workspace app flows, and public waiver-link flows.
- Keep sensitive business logic and authorization in trusted server/backend layers.
- Favor small, composable components and scoped styling over large one-off rewrites.
- Preserve accessibility semantics for forms, interactive controls, and keyboard navigation.

## Safety and Change Scope

- Make minimal, focused edits aligned to existing file/module patterns.
- Do not edit generated files unless explicitly requested.
- Do not introduce secrets, credentials, or environment values into source control.
- Do not add dependencies unless necessary for the requested task.
- Do not run destructive git commands unless explicitly requested.

## Validation

After substantive changes, run:

- `pnpm run check`
- `pnpm run lint`

If a full run is not practical for a tiny edit, run the most relevant targeted checks and clearly report what was and was not validated.

## Definition of Done

A task is complete only when:

- requested behavior is implemented,
- relevant validations are run and reported,
- and the final summary includes changed files plus notable risks or follow-ups.
