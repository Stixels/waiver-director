# Waiver Director

Waiver Director is a multi-tenant SaaS for waiver operations. It helps operators manage waiver templates, collect signed submissions, connect bookings, and follow up with customers while keeping each workspace's data isolated.

This repository contains the SvelteKit application and Convex backend for the product.

## Status

This project is under active development. The package is currently marked `private`, and the source is available under the MIT license.

## What It Does

- Create and publish workspace-owned waiver templates.
- Collect public waiver submissions through shareable waiver links.
- Review submissions, customers, bookings, and workspace activity from the protected operator app.
- Connect external booking data through the Bookeo integration.
- Send and manage follow-up emails through Resend.
- Authenticate users with Clerk while enforcing workspace authorization in Convex.

## Tech Stack

- [SvelteKit](https://svelte.dev/docs/kit) and Svelte 5
- [Convex](https://convex.dev) for backend functions, database, scheduled work, and public HTTP endpoints
- [Clerk](https://clerk.com) for identity
- [Resend](https://resend.com) for transactional email
- [Bookeo](https://www.bookeo.com) integration support
- Tailwind CSS, shadcn-svelte patterns, Bits UI, and lucide-svelte
- pnpm for package management

## Repository Layout

```text
src/routes/                  SvelteKit routes
src/routes/(app)/app/         Protected workspace app
src/routes/(auth)/            Sign in, sign up, and auth callbacks
src/routes/(marketing)/       Public marketing, privacy, and terms pages
src/routes/w/[slug]/          Public waiver signing flow
src/convex/                   Convex schema, queries, mutations, actions, crons, and HTTP routes
src/lib/                      Shared app components, config, utilities, and client helpers
docs/agents/                  Project-specific engineering guidance
```

## Getting Started

Prerequisites:

- Node.js compatible with the installed SvelteKit/Vite toolchain
- pnpm

Install dependencies:

```sh
pnpm install
```

Run the application:

```sh
pnpm run dev
```

Local service configuration, credentials, and deployment procedures are intentionally not documented in this public repository. Authorized maintainers receive that information through private operational channels. Never commit configuration values, credentials, customer data, or provider account details.

## Preview Deployments

Vercel preview builds deploy an isolated Convex preview backend and compile its URL into the app.
The Vercel build command also derives `PUBLIC_APP_URL` from that deployment's `VERCEL_URL`, so
copied links in a preview stay on that preview rather than pointing at production. See
[Vercel preview deployments](docs/operations/vercel-preview-deployments.md) for the deployment
contract and validation steps.

## Development Scripts

```sh
pnpm run dev          # Start the SvelteKit development server
pnpm run build        # Build the app
pnpm run preview      # Preview the production build
pnpm run check        # Run SvelteKit sync and svelte-check
pnpm run lint         # Run Prettier check and ESLint
pnpm run format       # Format the repository
```

## Engineering Notes

Core product invariants:

- Preserve strict workspace isolation.
- Enforce authorization on the server, especially in Convex functions.
- Treat signed waiver submissions as immutable records.
- Keep external provider identifiers as integration/display values, not authorization truth.

Before changing Convex code, read:

- [`src/convex/_generated/ai/guidelines.md`](src/convex/_generated/ai/guidelines.md)
- [`docs/agents/convex-backend.md`](docs/agents/convex-backend.md)

Additional project guidance:

- [`docs/agents/project-invariants.md`](docs/agents/project-invariants.md)
- [`docs/agents/auth-and-authorization.md`](docs/agents/auth-and-authorization.md)
- [`docs/agents/sveltekit-frontend.md`](docs/agents/sveltekit-frontend.md)
- [`docs/agents/workflow-and-validation.md`](docs/agents/workflow-and-validation.md)

## Validation

For substantive changes, run:

```sh
pnpm run check
pnpm run lint
```

For narrow documentation-only changes, a targeted Prettier check plus `git diff --check` is usually enough:

```sh
pnpm exec prettier --check README.md
git diff --check
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution expectations. For suspected vulnerabilities, follow
[SECURITY.md](SECURITY.md) rather than opening a public issue.

## License

Waiver Director is available under the MIT license.
