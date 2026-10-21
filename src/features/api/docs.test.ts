import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApiDocSections, renderApiDocsMarkdown } from "./docs";
import { API_ROUTES } from "./registry";

// The committed docs file must always describe the current registry. Regenerate it with
// `pnpm api:docs`; never edit docs/API.md by hand.
describe("API docs", () => {
  it("docs/API.md matches the route registry", () => {
    const expected = renderApiDocsMarkdown(buildApiDocSections(API_ROUTES));
    expect(readFileSync("docs/API.md", "utf8")).toBe(expected);
  });

  it("documents every registered route exactly once", () => {
    const sections = buildApiDocSections(API_ROUTES);
    const documented = sections.flatMap((section) =>
      section.routes.map((route) => `${route.method} ${route.path}`),
    );
    const registered = API_ROUTES.map((route) => `${route.method} ${route.path}`);
    expect(documented.sort()).toEqual(registered.sort());
  });
});
