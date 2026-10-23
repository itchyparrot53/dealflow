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
// File-level rules (Part 12, 6.10). They need the whole file, so they run once per file rather
// than per line, the way PAGE_RULE does.
const DIALOG_ANATOMY = {
  id: "dialog-anatomy",
  msg: 'DialogContent without DialogHeader or closeButton="corner"|"none"',
};
const DIALOG_MARGIN = {
  id: "dialog-anatomy",
  msg: "negative header/footer margin; the Dialog primitives own the padding",
};
const LONG_LIST = {
  id: "select-long-list",
  msg: "long list in a Select; use Combobox",
};
// The long lists 6.10 names, plus the local prop names the code actually uses for them.
const LONG_LIST_NAMES =
  /supportedCurrencyCodes|currencyOptions|timeZoneOptions|zoneOptions|Intl\.supportedValuesOf|codeOptions|rateOptions|TIMEZONES/;

// A <Select> renders inline in these files, so its tag (and the options prop) can span lines and
// contain "=>" inside a prop expression. Walk to the first ">" at brace/paren depth zero.
function selectTagAt(src, index) {
  let depth = 0;
  let quote = null;
  for (let i = index; i < src.length; i++) {
    const char = src[i];
    if (quote !== null) {
      if (char === quote && src[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{" || char === "(" || char === "[") depth++;
    else if (char === "}" || char === ")" || char === "]") depth--;
    else if (char === ">" && depth === 0) return src.slice(index, i + 1);
  }
  return src.slice(index, index + 1600);
}

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
  const src = lines.join("\n");
  // A file-level rule is opted out only by a "design-ok:" marker near the construct it excuses,
  // not by an unrelated marker elsewhere in the file.
  const optOutNear = (line, radius = 3) =>
    lines
      .slice(Math.max(0, line - radius - 1), line + radius)
      .some((text) => /design-ok:\s*\S/.test(text));
  const lineOf = (index) => src.slice(0, index).split("\n").length;
  // 6.2: a dialog owns a header (which owns the close button) or asks for a corner/none button.
  const dialogStart = src.indexOf("<DialogContent");
  if (dialogStart !== -1) {
    const hasHeader = /DialogHeader/.test(src) || /closeButton="(?:corner|none)"/.test(src);
    if (!hasHeader && !optOutNear(lineOf(dialogStart))) {
      hits.push({ line: lineOf(dialogStart), rule: DIALOG_ANATOMY.id, msg: DIALOG_ANATOMY.msg });
    }
  }
  // 6.2: the header and footer own their padding, so a usage must not pull them out again. The
  // margin sits on a nearby line of the same element, hence the small window.
  lines.forEach((line, i) => {
    if (!/-(?:mt|mx)-6\b/.test(line) || optOutNear(i, 1)) return;
    const around = lines.slice(Math.max(0, i - 3), i + 4).join("\n");
    if (/DialogHeader|DialogFooter/.test(around)) {
      hits.push({ line: i + 1, rule: DIALOG_MARGIN.id, msg: DIALOG_MARGIN.msg });
    }
  });
  // 6.3: lists over 12 options are comboboxes, never Selects.
  for (const match of src.matchAll(/<Select\b/g)) {
    const tag = selectTagAt(src, match.index ?? 0);
    const line = lineOf(match.index ?? 0);
    if (LONG_LIST_NAMES.test(tag) && !optOutNear(line, 4)) {
      hits.push({ line, rule: LONG_LIST.id, msg: LONG_LIST.msg });
    }
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
const byRule = {};
for (const hits of Object.values(report)) {
  for (const h of hits) byRule[h.rule] = (byRule[h.rule] ?? 0) + 1;
}
console.log(
  `check-design: ${total} violation(s) in ${Object.keys(report).length} file(s); ${optOuts} opt-out(s)`,
);
if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ total, optOuts, byRule, files: report }, null, 2));
}
process.exit(total > 0 || optOuts > 40 ? 1 : 0);
