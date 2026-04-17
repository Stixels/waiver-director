# CLAUDE.md

See `AGENTS.md` for the canonical project policies and implementation guardrails. This file intentionally avoids duplicating those rules so policy updates happen in one place; if CLAUDE-specific exceptions are ever needed, document them below in a short, explicit section.

## CLAUDE-specific Exceptions

None currently.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `src/convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
