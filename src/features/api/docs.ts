import { ERROR_IDS } from "@/constants/errorIds";
import { API_DOC_PROSE, type ApiDocSection } from "./docSections";
import { API_ROUTES } from "./registry";
import type { ApiRoute } from "./types";

// One registry, two renderings: the in-app Documentation tab and docs/API.md (via `pnpm api:docs`)
// are both built from these serializable sections, so neither can drift from the routes.

export type { ApiDocRoute, ApiDocSection } from "./docSections";
export { API_DOC_PROSE } from "./docSections";

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

const RESOURCE_TITLES: Record<string, string> = {
  deals: "Deals",
  persons: "People",
  organizations: "Organizations",
  activities: "Activities",
  notes: "Notes",
  products: "Products",
  projects: "Projects",
};

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
