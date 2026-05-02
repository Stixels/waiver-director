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
- Convex account and project
- Clerk application
- Resend API key for email delivery
- Bookeo credentials if you are working on booking integrations

Install dependencies:

```sh
pnpm install
```

Create a local environment file:

```sh
touch .env.local
```

Then add the environment variables your local workflow needs from the list below.

Run the app:

```sh
pnpm run dev
```

Run Convex in a second terminal when working against a local/dev Convex deployment:

```sh
pnpm exec convex dev
```

## Environment Variables

Public SvelteKit values:

```sh
PUBLIC_APP_URL=
PUBLIC_CONVEX_URL=
PUBLIC_CONVEX_SITE_URL=
```

Server-only SvelteKit values:

```sh
CLERK_SECRET_KEY=
CLERK_FRONTEND_API_URL=
RESEND_API_KEY=
BOOKEO_API_KEY=
BOOKEO_SECRET_KEY=
```

Convex runtime values used by backend functions:

```sh
APP_URL=
PUBLIC_APP_URL=
SITE_URL=
CONVEX_SITE_URL=
PUBLIC_CONVEX_SITE_URL=
CLERK_FRONTEND_API_URL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
BOOKEO_SECRET_KEY=
BOOKEO_AUTHORIZATION_URL=
```

Do not commit real secrets or workspace-specific credentials.

To sync local environment values into Convex when needed:

```sh
pnpm exec convex env set --from-file .env.local
```

Use `--force` only when intentionally replacing existing Convex values.

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

Issues and pull requests should keep changes focused and explain the product behavior being changed. For code changes, include the validation commands you ran.

## License

Waiver Director is available under the MIT license.
