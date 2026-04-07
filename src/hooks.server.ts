// import { dev } from '$app/environment'; 
// $app/environment is a SvelteKit-provided module that gives you information about the current runtime environment
import { withClerkHandler } from 'svelte-clerk/server';

// This handler will authenticate requests and gives you access to the Auth object inside your server loaders and actions.
// Auth object examples: https://clerk.com/docs/reference/backend/types/auth-object#auth-object
// Example you can call debug: dev to see the Auth object in the console for debugging purposes.
export const handle = withClerkHandler();
