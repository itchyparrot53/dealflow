// Serializable API documentation shapes and prose. Kept apart from docs.ts because the client
// Documentation tab imports these; docs.ts also imports the route registry, which pulls in server
// services and must never land in a client bundle.

import type { ApiExample } from "./types";

export interface ApiDocRoute {
  method: string;
  path: string;
  scope: "read" | "write";
  summary: string;
  queryFields: string[];
  bodyFields: string[];
  example: ApiExample;
  curl: string;
}

export interface ApiDocSection {
  resource: string;
  title: string;
  routes: ApiDocRoute[];
}

export const API_DOC_PROSE = {
  intro:
    "Dealflow's REST API lets a script act as one of your users. Every call runs as the token's user through the same services the interface uses, so visibility, permissions, automations and the change log all apply.",
  auth: [
    "Send the token as a bearer header: `Authorization: Bearer dfk_...`.",
    "Tokens are created in Settings > API and shown once. Requests are never authenticated by session cookie, so a browser cookie alone gets a 401.",
    "The token's user must be active; a deactivated user's tokens stop working.",
  ],
  scopes: [
    "`read` can call GET routes.",
    "`write` can call GET, POST, PATCH and DELETE.",
    "A read token calling a write route gets 403 E_API_003.",
  ],
  pagination: [
    "List routes are ordered by `(updated_at, id)` ascending and return at most `limit` rows (default 50, max 200).",
    "When more rows exist the response carries `nextCursor`; pass it as `?cursor=...` for the next page.",
    "`updated_since` takes an ISO 8601 timestamp and returns only rows changed at or after it.",
  ],
  rateLimits: [
    "Each token is limited to 120 requests per minute.",
    "A limited call gets 429 with a `Retry-After` header (seconds).",
  ],
  errors: [
    'Errors are `{ "error": { "id", "message" } }` with an HTTP status derived from the id: not found 404, permission 403, validation 422, conflict 409.',
  ],
} as const;
