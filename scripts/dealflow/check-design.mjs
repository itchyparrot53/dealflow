#!/usr/bin/env node
// Flags styling that bypasses the Dealflow design system. Usage: node scripts/dealflow/check-design.mjs [files...] [--json out.json]
// No args: scans src/**/*.tsx. Lines containing "design-ok:" followed by a reason are skipped (and counted).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const RULES = [
  { id: "font-size", re: /\btext-\[\d/, msg: "arbitrary font size; use the type scale" },
  {
    id: "radius",
    re: /\brounded-(?:\[|2xl\b|3xl\b|xs\b)/,
    msg: "off-scale radius; use rounded-sm|md|lg|xl|full",
  },
  {
    id: "shadow",
    re: /(?<![\w-])shadow(?:-(?:sm|md|lg|xl|2xl|inner))?(?![\w-])/,
    msg: "shadow on a non-floating element",
    skipUi: true,
  },
  {
    id: "uppercase",
    re: /\buppercase\b/,
    msg: "all caps outside StatusBadge; use sentence case",
    skipUi: true,
  },
  {
    id: "overlay",
    re: /\bfixed\s+inset-0\b/,
    msg: "custom overlay; use Dialog or Sheet",
    skipUi: true,
  },
  {
    id: "raw-colour",
    re: /\b(?:bg|text|border|fill|stroke|ring|outline|from|to)-\[(?:#|rgb|hsl)/,
    msg: "raw colour; use a token",
  },
  {
    id: "palette",
    re: /\b(?:bg|text|border|ring|fill|stroke|outline|divide)-(?:red|green|blue|emerald|indigo|amber|yellow|orange|sky|violet|purple|pink|rose|teal|cyan|lime|fuchsia|gray|slate|zinc|neutral|stone)-\d{2,3}\b/,
    msg: "Tailwind palette step; use a token",
  },
];
const PAGE_RULE = {
  id: "page-title",
  msg: "app page without PageTitle/usePageTitle or PageToolbar",
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(p)) out.push(p);
  }
  return out;
}
const args = process.argv.slice(2);
let jsonOut = null;
const targets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--json") {
    jsonOut = args[++i] ?? null;
    continue;
  }
  targets.push(args[i]);
}
const expand = (t) => {
  const p = join(ROOT, t);
  return statSync(p).isDirectory() ? walk(p) : [p];
};
const files = (targets.length ? targets.flatMap(expand) : walk(join(ROOT, "src"))).filter(
  (f) => f.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(f),
);

const report = {};
let total = 0;
let optOuts = 0;
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const isUi = rel.startsWith("src/components/ui/");
  const lines = readFileSync(file, "utf8").split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    if (/design-ok:\s*\S/.test(line)) {
      optOuts++;
      return;
    }
    for (const r of RULES) {
      if (r.skipUi && isUi) continue;
      if (r.re.test(line)) hits.push({ line: i + 1, rule: r.id, msg: r.msg });
    }
  });
  if (/^src\/app\/\(app\)\/.*\/page\.tsx$/.test(rel)) {
    const src = lines.join("\n");
    if (!/PageTitle|usePageTitle|PageToolbar/.test(src) && !/design-ok:/.test(src))
      hits.push({ line: 1, rule: PAGE_RULE.id, msg: PAGE_RULE.msg });
  }
  if (hits.length) {
    report[rel] = hits;
    total += hits.length;
  }
}
for (const [f, hits] of Object.entries(report)) {
  console.log(`${f} (${hits.length})`);
  for (const h of hits) console.log(`  ${h.line}: [${h.rule}] ${h.msg}`);
}
console.log(
  `check-design: ${total} violation(s) in ${Object.keys(report).length} file(s); ${optOuts} opt-out(s)`,
);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ total, optOuts, files: report }, null, 2));
process.exit(total > 0 || optOuts > 40 ? 1 : 0);
