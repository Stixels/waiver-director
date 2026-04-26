/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as app from "../app.js";
import type * as bookings from "../bookings.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bookingSignatures from "../lib/bookingSignatures.js";
import type * as lib_bookings from "../lib/bookings.js";
import type * as lib_customers from "../lib/customers.js";
import type * as lib_waivers from "../lib/waivers.js";
import type * as lib_workspaces from "../lib/workspaces.js";
import type * as users from "../users.js";
import type * as waivers from "../waivers.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  app: typeof app;
  bookings: typeof bookings;
  crons: typeof crons;
  customers: typeof customers;
  http: typeof http;
  integrations: typeof integrations;
  "lib/auth": typeof lib_auth;
  "lib/bookingSignatures": typeof lib_bookingSignatures;
  "lib/bookings": typeof lib_bookings;
  "lib/customers": typeof lib_customers;
  "lib/waivers": typeof lib_waivers;
  "lib/workspaces": typeof lib_workspaces;
  users: typeof users;
  waivers: typeof waivers;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
