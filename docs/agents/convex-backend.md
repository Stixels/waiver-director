# Convex Backend

This project uses [Convex](https://convex.dev) as its backend.

- When working on Convex code, read [`src/convex/_generated/ai/guidelines.md`](../../src/convex/_generated/ai/guidelines.md) first. Its rules override generic Convex assumptions.
- Keep public function APIs intentionally small: use `internalQuery`, `internalMutation`, and `internalAction` for server-only behavior, and validate every function argument.
- Derive the caller from `ctx.auth.getUserIdentity()` and enforce workspace membership in trusted Convex code; never authorize from a client-supplied user or workspace identifier.
- Treat schema, indexes, and generated Convex artifacts as a unit. Plan schema/data changes explicitly, preserve signed records, and regenerate or commit generated code only when the Convex workflow changes it intentionally.
