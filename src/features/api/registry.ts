import { activitiesRoutes } from "./resources/activities";
import { dealsRoutes } from "./resources/deals";
import { notesRoutes } from "./resources/notes";
import { organizationsRoutes } from "./resources/organizations";
import { personsRoutes } from "./resources/persons";
import { productsRoutes } from "./resources/products";
import { projectsRoutes } from "./resources/projects";
import type { ApiMethod, ApiRoute } from "./types";

// The single route registry (6.7): routing, Zod validation and both docs surfaces read this list,
// so a resource cannot exist in one and be missing from another.

export const API_ROUTES: readonly ApiRoute[] = [
  ...dealsRoutes,
  ...personsRoutes,
  ...organizationsRoutes,
  ...activitiesRoutes,
  ...notesRoutes,
  ...productsRoutes,
  ...projectsRoutes,
];

export type RouteMatch =
  | { kind: "match"; route: ApiRoute; params: Record<string, string> }
  | { kind: "method" }
  | { kind: "none" };

function matchPath(pattern: string, segments: string[]): Record<string, string> | null {
  const parts = pattern.split("/").filter((part) => part !== "");
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of parts.entries()) {
    const actual = segments[index];
    if (actual === undefined) return null;
    if (part.startsWith(":")) {
      params[part.slice(1)] = actual;
      continue;
    }
    if (part !== actual) return null;
  }
  return params;
}

export function matchRoute(method: ApiMethod, segments: string[]): RouteMatch {
  let pathMatched = false;
  for (const route of API_ROUTES) {
    const params = matchPath(route.path, segments);
    if (params === null) continue;
    if (route.method === method) return { kind: "match", route, params };
    pathMatched = true;
  }
  return pathMatched ? { kind: "method" } : { kind: "none" };
}
