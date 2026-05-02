# Authentication And Authorization

- Use [Clerk](https://clerk.com) as the identity provider for the SvelteKit app.
- Wire Convex authentication through Clerk JWTs in `auth.config.ts`.
- Treat Clerk as "who is signed in" only; enforce workspace access and roles in trusted Convex server code via membership checks.
- Keep local app users keyed by `identity.tokenIdentifier`; never trust client-passed user ids for authorization decisions.
- Reference implementation: [Convex + Clerk auth docs](https://docs.convex.dev/auth/clerk).
