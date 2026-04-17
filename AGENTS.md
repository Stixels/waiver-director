# AGENTS.md

Waiver Director is a multi-tenant SaaS for waiver operations; preserve strict workspace isolation, server-side authorization, and signed-record integrity in every change.

- Package manager: `pnpm`
- Common validation: `pnpm run check`, `pnpm run lint`

Relevant docs:

- [Project invariants](docs/agents/project-invariants.md)
- [Convex backend](docs/agents/convex-backend.md)
- [Authentication and authorization](docs/agents/auth-and-authorization.md)
- [Svelte and route boundaries](docs/agents/sveltekit-frontend.md)
- [Change scope and validation](docs/agents/workflow-and-validation.md)

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `src/convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
