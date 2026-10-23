import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("./", import.meta.url));

// Paper surfaces are the one deliberate exception: email HTML and the document preview assume a
// white sheet, so those two files may set the dark ink that reads on paper (PLAN-PART12.md 6.7.5
// and 6.7.6, each also opted out in check-design). No other file gets a fixed-palette exemption;
// Part 11 removed the last general one (components/shell/LeftNav.tsx).

// A fixed gray-family step that does not follow the theme, captured with its whole variant chain
// so a `dark:` anywhere in that chain reads as the deliberate escape hatch.
const PALETTE_UTILITY = /(?:[a-z-]+:)*(?:text|bg|border)-(?:gray|slate|zinc|neutral)-\d{2,3}\b/g;

function lightOnly(source: string): string[] {
  return (source.match(PALETTE_UTILITY) ?? []).filter((cls) => !cls.includes("dark:"));
}

function productionTsxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) files.push(...productionTsxFiles(`${path}/`));
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) files.push(path);
  }
  return files;
}

function relative(path: string): string {
  return path.replace(SRC_DIR, "");
}

const PAPER_PANEL_FILES = new Set([
  "features/documents/ui/DocumentEditor.tsx",
  "features/email/MessageBodyFrame.tsx",
]);

function offenders(path: string): string[] {
  const found = lightOnly(readFileSync(path, "utf8"));
  if (!PAPER_PANEL_FILES.has(relative(path))) return found;
  // Only the paper ink is excused; any other palette step in these files still fails.
  return found.filter((cls) => !cls.endsWith("text-neutral-900"));
}

describe("theme palette tokens", () => {
  it("renders every surface from semantic tokens so both Day and Night are legible", () => {
    const found = productionTsxFiles(SRC_DIR).flatMap((path) =>
      offenders(path).map((cls) => `${relative(path)}: ${cls}`),
    );
    expect(found).toEqual([]);
  });

  it("still flags a light-only utility behind a hover prefix but accepts a dark pair", () => {
    expect(lightOnly('className="hover:bg-gray-50"')).toEqual(["hover:bg-gray-50"]);
    expect(lightOnly('className="bg-muted dark:bg-slate-800"')).toEqual([]);
  });

  // A dark variant can sit anywhere in the chain, so the escape hatch cannot be a lookbehind on
  // the utility alone.
  it("accepts a dark variant that is not the last one in the chain", () => {
    expect(lightOnly('className="bg-muted dark:hover:bg-gray-800"')).toEqual([]);
  });
});
