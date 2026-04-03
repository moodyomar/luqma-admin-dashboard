import type { CallableOptions } from "firebase-functions/v2/https";

/**
 * Options for HTTPS callables invoked from the admin SPA on custom domains
 * (e.g. https://admin.luqma.co.il, https://admin.jeeb.delivery).
 *
 * **invoker: "public"** — Browsers send a CORS preflight (OPTIONS) without a Firebase ID
 * token. Cloud Run must allow unauthenticated invocation at the edge; the callable handler
 * still rejects unauthenticated *data* requests via `request.auth` / HttpsError.
 * Without this, preflight fails and Chrome reports missing `Access-Control-Allow-Origin`.
 *
 * **cors: true** — Allow cross-origin POST from the admin origin (cors middleware).
 */
export const adminSpaCallableOpts: CallableOptions = {
  region: "us-central1",
  cors: true,
  invoker: "public",
};
