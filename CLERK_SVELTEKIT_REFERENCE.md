# Clerk in This SvelteKit App

This project uses:

- `SvelteKit`, not Next.js
- `svelte-clerk` for Clerk integration
- `locals.auth()` for server-side auth checks
- `clerkClient` for server-side Clerk API access
- `useClerkContext()` for client-side auth/session state
- `Convex` for app-specific user data and authorization

## Direct mapping from Next.js docs

- Next `auth()` -> SvelteKit `locals.auth()`
- Next `currentUser()` -> `clerkClient.users.getUser(locals.auth().userId)`
- Next App Router route protection -> SvelteKit protection in `+layout.server.ts`, `+page.server.ts`, and `+server.ts`
- Next `buildClerkProps()` in `getServerSideProps` -> `buildClerkProps(locals.auth())` in `src/routes/+layout.server.ts`
- Next `useAuth()` / `useUser()` -> `useClerkContext()`

## Current project wiring

- `src/hooks.server.ts` wraps the app with Clerk via `withClerkHandler(...)`
- `src/routes/+layout.server.ts` passes auth state into the app with `buildClerkProps(...)`
- `src/routes/(app)/app/+layout.server.ts` protects signed-in routes with `locals.auth()`
- `src/routes/api/account/delete/+server.ts` shows server-side Clerk API usage with `clerkClient`
- `src/lib/components/auth/ConvexClerkBridge.svelte` uses the Clerk session to fetch Convex auth tokens
- `src/lib/components/auth/ConvexUserSync.svelte` syncs signed-in Clerk users into the app's Convex user record

## Server-side patterns

### Protect a page or layout

```ts
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
	const { userId } = locals.auth();

	if (!userId) {
		const next = `${url.pathname}${url.search}`;
		throw redirect(303, `/sign-in?redirectTo=${encodeURIComponent(next)}`);
	}

	return {};
};
```

### Read the current authenticated user ID

```ts
export const load = async ({ locals }) => {
	const auth = locals.auth();

	if (!auth.isAuthenticated || !auth.userId) {
		return { userId: null };
	}

	return { userId: auth.userId };
};
```

### Read the backend Clerk user object

Use this only when you really need Clerk-hosted user fields on the server.

```ts
import { redirect } from '@sveltejs/kit';
import { clerkClient } from 'svelte-clerk/server';

export const load = async ({ locals }) => {
	const auth = locals.auth();

	if (!auth.isAuthenticated || !auth.userId) {
		throw redirect(303, '/sign-in');
	}

	const user = await clerkClient.users.getUser(auth.userId);

	return {
		user: {
			id: user.id,
			firstName: user.firstName,
			email: user.emailAddresses[0]?.emailAddress ?? null
		}
	};
};
```

Do not pass the full backend user object to the client unless you actually need it.

### Protect an API route

```ts
import { json } from '@sveltejs/kit';
import { clerkClient } from 'svelte-clerk/server';

export const GET = async ({ locals }) => {
	const auth = locals.auth();

	if (!auth.isAuthenticated || !auth.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = await clerkClient.users.getUser(auth.userId);

	return json({
		userId: user.id,
		email: user.emailAddresses[0]?.emailAddress ?? null
	});
};
```

## Client-side patterns

### Read auth/session state

```svelte
<script lang="ts">
	import { useClerkContext } from 'svelte-clerk';

	const clerk = useClerkContext();
</script>

{#if !clerk.isLoaded}
	<div>Loading...</div>
{:else if !clerk.auth.userId}
	<div>Sign in to view this page</div>
{:else}
	<div>Hello, {clerk.auth.userId}!</div>
{/if}
```

### Get a session token for external requests

```ts
const token = await (clerk.clerk?.session ?? clerk.session)?.getToken();
```

If you need the Convex JWT specifically, this app already handles that in `src/lib/components/auth/ConvexClerkBridge.svelte`.

## Recommended rule of thumb for this repo

- Use `locals.auth()` to decide whether someone is signed in
- Use `clerkClient` only when server code needs Clerk-managed user fields
- Use `useClerkContext()` in Svelte components
- Use Convex queries and mutations for your app's real user record, permissions, and business logic

Clerk answers "who is signed in." Convex should answer "what can this user do in this workspace."
