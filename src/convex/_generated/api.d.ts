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
import type * as billing from "../billing.js";
import type * as bookings from "../bookings.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as emailAI from "../emailAI.js";
import type * as emails from "../emails.js";
import type * as fareharbor from "../fareharbor.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_bookingCredentials from "../lib/bookingCredentials.js";
import type * as lib_bookingSignatures from "../lib/bookingSignatures.js";
import type * as lib_bookings from "../lib/bookings.js";
import type * as lib_customers from "../lib/customers.js";
import type * as lib_emailAIRateLimit from "../lib/emailAIRateLimit.js";
import type * as lib_fareharbor from "../lib/fareharbor.js";
import type * as lib_marketing from "../lib/marketing.js";
import type * as lib_submissionAudit from "../lib/submissionAudit.js";
import type * as lib_submissions from "../lib/submissions.js";
import type * as lib_waivers from "../lib/waivers.js";
import type * as lib_workspaceHandles from "../lib/workspaceHandles.js";
import type * as lib_workspaces from "../lib/workspaces.js";
import type * as mailchimp from "../mailchimp.js";
import type * as marketingIntegrations from "../marketingIntegrations.js";
import type * as search from "../search.js";
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
  billing: typeof billing;
  bookings: typeof bookings;
  crons: typeof crons;
  customers: typeof customers;
  dashboard: typeof dashboard;
  emailAI: typeof emailAI;
  emails: typeof emails;
  fareharbor: typeof fareharbor;
  http: typeof http;
  integrations: typeof integrations;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/billing": typeof lib_billing;
  "lib/bookingCredentials": typeof lib_bookingCredentials;
  "lib/bookingSignatures": typeof lib_bookingSignatures;
  "lib/bookings": typeof lib_bookings;
  "lib/customers": typeof lib_customers;
  "lib/emailAIRateLimit": typeof lib_emailAIRateLimit;
  "lib/fareharbor": typeof lib_fareharbor;
  "lib/marketing": typeof lib_marketing;
  "lib/submissionAudit": typeof lib_submissionAudit;
  "lib/submissions": typeof lib_submissions;
  "lib/waivers": typeof lib_waivers;
  "lib/workspaceHandles": typeof lib_workspaceHandles;
  "lib/workspaces": typeof lib_workspaces;
  mailchimp: typeof mailchimp;
  marketingIntegrations: typeof marketingIntegrations;
  search: typeof search;
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
