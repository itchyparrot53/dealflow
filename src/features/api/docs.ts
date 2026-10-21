import { ERROR_IDS } from "@/constants/errorIds";
import { API_ROUTES } from "./registry";
import type { ApiExample, ApiRoute } from "./types";

// One registry, two renderings: the in-app Documentation tab and docs/API.md (via `pnpm api:docs`)
// are both built from these serializable sections, so neither can drift from the routes.

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

const RESOURCE_TITLES: Record<string, string> = {
  deals: "Deals",
  persons: "People",
  organizations: "Organizations",
  activities: "Activities",
  notes: "Notes",
  products: "Products",
  projects: "Projects",
};

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

const API_ERROR_ROWS = [
  ERROR_IDS.API_TOKEN_MISSING,
  ERROR_IDS.API_TOKEN_INVALID,
  ERROR_IDS.API_SCOPE_DENIED,
  ERROR_IDS.API_RATE_LIMITED,
  ERROR_IDS.API_ROUTE_NOT_FOUND,
  ERROR_IDS.API_BODY_INVALID,
] as const;

function fieldNames(schema: ApiRoute["query"]): string[] {
  if (schema === undefined) return [];
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape;
  return shape === undefined ? [] : Object.keys(shape);
}

function curlFor(route: ApiRoute): string {
  const url = `{BASE_URL}/api/v1${route.path.replace(/:([A-Za-z]+)/g, "{$1}")}`;
  const lines = [`curl -s -X ${route.method} "${url}"`, '  -H "Authorization: Bearer dfk_..."'];
  if (route.method === "POST" || route.method === "PATCH") {
    lines.push('  -H "Content-Type: application/json"');
    lines.push(`  -d '${JSON.stringify(route.example.request ?? {})}'`);
  }
  return lines.join(" \\\n");
}

export function buildApiDocSections(routes: readonly ApiRoute[] = API_ROUTES): ApiDocSection[] {
  const sections: ApiDocSection[] = [];
  for (const route of routes) {
    let section = sections.find((entry) => entry.resource === route.resource);
    if (section === undefined) {
      section = {
        resource: route.resource,
        title: RESOURCE_TITLES[route.resource] ?? route.resource,
        routes: [],
      };
      sections.push(section);
    }
    section.routes.push({
      method: route.method,
      path: route.path,
      scope: route.scope,
      summary: route.summary,
      queryFields: fieldNames(route.query),
      bodyFields: fieldNames(route.body),
      example: route.example,
      curl: curlFor(route),
    });
  }
  return sections;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function renderApiDocsMarkdown(sections: readonly ApiDocSection[]): string {
  const lines: string[] = [
    "# Dealflow REST API",
    "",
    API_DOC_PROSE.intro,
    "",
    "Generated from the route registry (`src/features/api/registry.ts`). Run `pnpm api:docs` after changing a route; a unit test fails when this file is stale.",
    "",
    "## Authentication",
    "",
    ...API_DOC_PROSE.auth.map((line) => `- ${line}`),
    "",
    "## Scopes",
    "",
    ...API_DOC_PROSE.scopes.map((line) => `- ${line}`),
    "",
    "## Pagination",
    "",
    ...API_DOC_PROSE.pagination.map((line) => `- ${line}`),
    "",
    "## Rate limits",
    "",
    ...API_DOC_PROSE.rateLimits.map((line) => `- ${line}`),
    "",
    "## Errors",
    "",
    ...API_DOC_PROSE.errors,
    "",
    "| Id | HTTP |",
    "|---|---|",
    ...API_ERROR_ROWS.map((id) => `| ${id} | ${String(statusForRow(id))} |`),
    "",
  ];
  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    for (const route of section.routes) {
      lines.push(`### ${route.method} ${route.path}`, "");
      lines.push(`Scope: \`${route.scope}\`. ${route.summary}`, "");
      if (route.queryFields.length > 0) {
        lines.push(`Query: ${route.queryFields.map((name) => `\`${name}\``).join(", ")}`, "");
      }
      if (route.bodyFields.length > 0) {
        lines.push(`Body: ${route.bodyFields.map((name) => `\`${name}\``).join(", ")}`, "");
      }
      if (route.example.request !== undefined) {
        lines.push("Example request:", "", "```json", json(route.example.request), "```", "");
      }
      lines.push("Example response:", "", "```json", json(route.example.response), "```", "");
      lines.push("```bash", route.curl, "```", "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function statusForRow(id: string): number {
  switch (id) {
    case ERROR_IDS.API_TOKEN_MISSING:
    case ERROR_IDS.API_TOKEN_INVALID:
      return 401;
    case ERROR_IDS.API_SCOPE_DENIED:
      return 403;
    case ERROR_IDS.API_RATE_LIMITED:
      return 429;
    case ERROR_IDS.API_ROUTE_NOT_FOUND:
      return 404;
    default:
      return 422;
  }
}
