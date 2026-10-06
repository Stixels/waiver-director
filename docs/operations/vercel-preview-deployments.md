# Vercel Preview Deployments

## Purpose

Every Vercel preview must use an isolated Convex preview backend and must generate application
links for its own deployment URL. A preview must never send a tester to the production app merely
because it generated a waiver, booking, or canonical URL.

## Vercel Configuration

Keep Vercel's **Automatically expose System Environment Variables** setting enabled. It supplies
`VERCEL_URL` for each deployment.

Use this Vercel build command:

```sh
npx convex deploy --cmd-url-env-var-name PUBLIC_CONVEX_URL --cmd 'PUBLIC_APP_URL="https://$VERCEL_URL" vite build'
```

The command has two responsibilities:

1. With the Preview-scoped `CONVEX_DEPLOY_KEY`, `convex deploy` creates or updates the Convex
   preview deployment associated with the Git branch.
2. It passes that deployment's URL to `vite build` as `PUBLIC_CONVEX_URL` and derives
   `PUBLIC_APP_URL` from Vercel's deployment-specific URL.

Do not set a shared `PUBLIC_APP_URL` for the Vercel **Preview** environment. That value is
compiled into the client bundle and would make every preview generate links to the same URL.
Keep the production `PUBLIC_APP_URL` scoped to **Production** only.

## Environment Boundaries

Vercel build variables and Convex runtime variables are separate.

- `PUBLIC_CONVEX_URL` is set for the Vite build by `convex deploy`; the built preview client uses
  its matching Convex preview backend.
- `PUBLIC_APP_URL` is set for the Vite build from `VERCEL_URL`; client-side copied links and
  marketing canonical URLs remain inside the preview.
- `APP_URL`, `PUBLIC_APP_URL`, and `SITE_URL` used by Convex actions are runtime values on the
  Convex deployment. They do not inherit Vercel variables.

External integrations that require a stable callback or redirect URL, including booking and OAuth
flows, should not be exercised against an ephemeral preview unless a preview-safe callback strategy
has been configured. Do not point those callbacks at production for MR testing.

## Validate a Preview

After a Git-triggered preview deployment:

1. Confirm the Vercel build is `Ready` and its build logs show the Convex preview deploy succeeded.
2. Open the preview and sign in with the configured Clerk test environment.
3. Generate a waiver or booking link and confirm its origin is the preview deployment URL.
4. Confirm protected app requests reach the preview's Convex deployment, not production.

Preview deployments may be protected by Vercel SSO; use an authorized session or a temporary
protected-preview share link for the smoke test.
