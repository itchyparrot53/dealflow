import { readdirSync } from "node:fs";
import { join } from "node:path";

// Routes and selectors for e2e/16-polish.spec.ts (PLAN-PART12.md 6.11). The settings list is read
// from the filesystem so a new page is covered without editing a second list in this part.

const SETTINGS_ROOT = join("src", "app", "(app)", "settings");

// Every settings page.tsx without a dynamic segment, as its URL. Dynamic editors need a seeded
// row, so they are not part of the scroll sweep.
export function settingsRoutes(): string[] {
  const routes: string[] = [];
  const visit = (dir: string, segments: string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!entry.name.startsWith("[") && !entry.name.startsWith("(")) {
          visit(join(dir, entry.name), [...segments, entry.name]);
        }
        continue;
      }
      if (entry.name === "page.tsx") routes.push(["/settings", ...segments].join("/"));
    }
  };
  visit(SETTINGS_ROOT, []);
  return routes.sort();
}

// The content scroller the settings layout publishes (task 2.3). The window must not scroll here:
// the check needs a container whose own scrollTop can be driven to its end.
export const SETTINGS_SCROLL = '[data-testid="settings-scroll"]';

// The one long list that stays a Select: the 96-entry quarter-hour picker in the booking page
// editor. Currency and time zone pickers are Comboboxes (6.3), so this is the Select that proves
// the new max-height and the End key.
export const LONG_LIST_SELECT = {
  listRoute: "/settings/booking",
  rowLink: '[data-testid="booking-page-row"] a',
  trigger: '[data-testid="availability-day"][data-day="mon"] [aria-label="Monday From"]',
};
