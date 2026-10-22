import type { Fixtures } from "../helpers";

export interface DesignRoute {
  // The gallery name, which is also the screenshot prefix.
  id: string;
  // Resolved lazily: a run of one screen must not fail because another screen's demo row is absent.
  path: () => string;
  // Public screens render without a session and always in light.
  app: boolean;
}

// The 26 gallery screens (PLAN-PART11.md 6.10). {id} values come from the e2e fixture file, so a
// selected screen is skipped only when its demo row is genuinely missing, and the error says which.
function id(value: string | null, screen: string): string {
  if (value === null) throw new Error(`design gallery: no seeded record for ${screen}`);
  return value;
}

export function designRoutes(f: Fixtures): DesignRoute[] {
  return [
    { id: "login", path: () => "/login", app: false },
    { id: "board", path: () => `/pipeline/${id(f.pipelineId, "board")}`, app: true },
    { id: "deal", path: () => `/deals/${id(f.dealId, "deal")}`, app: true },
    { id: "deals-list", path: () => `/pipeline/${id(f.pipelineId, "deals-list")}/list`, app: true },
    { id: "people", path: () => "/contacts/people", app: true },
    { id: "person", path: () => `/contacts/people/${id(f.personId, "person")}`, app: true },
    { id: "organizations", path: () => "/contacts/orgs", app: true },
    { id: "leads", path: () => "/leads", app: true },
    { id: "activities-list", path: () => "/activities/list", app: true },
    { id: "calendar", path: () => "/activities/calendar", app: true },
    { id: "inbox", path: () => "/inbox", app: true },
    { id: "thread", path: () => `/inbox/${id(f.threadId, "thread")}`, app: true },
    { id: "forecast", path: () => "/forecast", app: true },
    { id: "documents", path: () => "/documents", app: true },
    { id: "document", path: () => `/documents/${id(f.documentId, "document")}`, app: true },
    { id: "insights", path: () => "/insights", app: true },
    {
      id: "dashboard",
      path: () => `/insights/dashboards/${id(f.dashboardId, "dashboard")}`,
      app: true,
    },
    { id: "report", path: () => `/insights/reports/${id(f.reportId, "report")}`, app: true },
    { id: "projects", path: () => "/projects", app: true },
    { id: "project", path: () => `/projects/${id(f.projectId, "project")}`, app: true },
    { id: "settings-profile", path: () => "/settings/profile", app: true },
    { id: "settings-automation", path: () => "/settings/automations", app: true },
    { id: "public-quote", path: () => `/d/${id(f.documentPublicId, "public-quote")}`, app: false },
    { id: "public-form", path: () => `/f/${id(f.formPublicId, "public-form")}`, app: false },
    {
      id: "public-booking",
      path: () => `/book/${id(f.bookingPublicId, "public-booking")}`,
      app: false,
    },
    { id: "offline", path: () => "/offline", app: false },
  ];
}

// DESIGN_SCREENS=board,deal narrows a run (used while the restyle is still in progress).
export function selectedScreens(all: DesignRoute[], filter: string | undefined): DesignRoute[] {
  if (filter === undefined || filter.trim() === "") return all;
  const wanted = new Set(
    filter
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ""),
  );
  const selected = all.filter((route) => wanted.has(route.id));
  const missing = [...wanted].filter((entry) => !selected.some((route) => route.id === entry));
  if (missing.length > 0)
    throw new Error(`DESIGN_SCREENS names unknown screens: ${missing.join(", ")}`);
  return selected;
}
