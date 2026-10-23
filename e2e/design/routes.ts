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

export function designRoutes(getFixtures: () => Fixtures): DesignRoute[] {
  // Resolve the fixture file on every navigation, not once at module load: Playwright can load a
  // spec before the e2e server has re-seeded, and a stale id turns a detail screen into the 404.
  const routes: Array<Omit<DesignRoute, "path"> & { build: (f: Fixtures) => string }> = [
    { id: "login", build: () => "/login", app: false },
    { id: "board", build: (f) => `/pipeline/${id(f.pipelineId, "board")}`, app: true },
    { id: "deal", build: (f) => `/deals/${id(f.dealId, "deal")}`, app: true },
    {
      id: "deals-list",
      build: (f) => `/pipeline/${id(f.pipelineId, "deals-list")}/list`,
      app: true,
    },
    { id: "people", build: () => "/contacts/people", app: true },
    { id: "person", build: (f) => `/contacts/people/${id(f.personId, "person")}`, app: true },
    { id: "organizations", build: () => "/contacts/orgs", app: true },
    { id: "leads", build: () => "/leads", app: true },
    { id: "activities-list", build: () => "/activities/list", app: true },
    { id: "calendar", build: () => "/activities/calendar", app: true },
    { id: "inbox", build: () => "/inbox", app: true },
    { id: "thread", build: (f) => `/inbox/${id(f.threadId, "thread")}`, app: true },
    { id: "forecast", build: () => "/forecast", app: true },
    { id: "documents", build: () => "/documents", app: true },
    { id: "document", build: (f) => `/documents/${id(f.documentId, "document")}`, app: true },
    { id: "insights", build: () => "/insights", app: true },
    {
      id: "dashboard",
      build: (f) => `/insights/dashboards/${id(f.dashboardId, "dashboard")}`,
      app: true,
    },
    { id: "report", build: (f) => `/insights/reports/${id(f.reportId, "report")}`, app: true },
    { id: "projects", build: () => "/projects", app: true },
    { id: "project", build: (f) => `/projects/${id(f.projectId, "project")}`, app: true },
    { id: "settings-profile", build: () => "/settings/profile", app: true },
    { id: "settings-automation", build: () => "/settings/automations", app: true },
    {
      id: "public-quote",
      build: (f) => `/d/${id(f.documentPublicId, "public-quote")}`,
      app: false,
    },
    { id: "public-form", build: (f) => `/f/${id(f.formPublicId, "public-form")}`, app: false },
    {
      id: "public-booking",
      build: (f) => `/book/${id(f.bookingPublicId, "public-booking")}`,
      app: false,
    },
    { id: "offline", build: () => "/offline", app: false },
  ];
  return routes.map((route) => ({
    id: route.id,
    app: route.app,
    path: () => route.build(getFixtures()),
  }));
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
