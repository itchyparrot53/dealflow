// Builds the user-guide PDFs from docs/user-guide/*.md: one per section plus "Dealflow User Guide.pdf".
//   pnpm docs:pdf            (DOCS_CHROME=/path/to/chromium when Playwright's own browser is missing)
// Pipeline: Markdown -> HTML (marked) -> Chromium PDF, rendered twice so the table of contents can
// carry real page numbers (read back from the PDF's named destinations), then pdf-lib prepends the
// cover and stamps the footer. Chromium's own footer cannot skip the cover, which is why pdf-lib does it.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { Marked } from "marked";
import { PDFDict, PDFDocument, PDFName, PDFRef, rgb, StandardFonts } from "pdf-lib";

const ROOT = process.cwd();
const GUIDE = path.join(ROOT, "docs/user-guide");
const OUT = path.join(GUIDE, "pdf");
const VERSION = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const fileUrl = (p) => pathToFileURL(path.join(ROOT, p)).href;

const SECTIONS = [
  "getting-started",
  "pipelines-and-deals",
  "activities",
  "contacts-and-organizations",
  "email",
  "notifications",
  "stats-and-reporting",
  "quotes-and-invoices",
  "projects",
  "forms-and-booking",
  "ai-features",
  "admin",
  "self-hosting",
  "troubleshooting-faq",
];

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\- ]/g, "")
    .trim()
    .replace(/ /g, "-");

// Converts one Markdown file to HTML whose ids and links are namespaced by section, so every
// section can live in one combined document without id clashes.
function toHtml(slug, markdown) {
  const headings = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        const id = `${slug}--${slugify(text)}`;
        const inner = this.parser.parseInline(tokens);
        if (depth <= 2) headings.push({ id, depth, text: inner });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, tokens }) {
        const inner = this.parser.parseInline(tokens);
        if (/^https?:/.test(href)) return `<a href="${href}">${inner}</a>`;
        const [file, anchor] = href.split("#");
        if (file.startsWith("..")) return `<span class="path">${inner}</span>`;
        const target = file === "" ? slug : file.replace(/\.md$/, "");
        return `<a href="#${target}--${anchor ?? "top"}">${inner}</a>`;
      },
      image({ href, text }) {
        const tall = /mobile-/.test(href) ? " tall" : "";
        return `<img class="shot${tall}" src="${pathToFileURL(path.join(GUIDE, href)).href}" alt="${text}">`;
      },
    },
  });
  const html = `<section class="chapter" id="${slug}--top">${marked.parse(markdown, { async: false })}</section>`;
  return { html, headings };
}

function readSection(slug) {
  const md = readFileSync(path.join(GUIDE, `${slug}.md`), "utf8");
  return { slug, title: md.match(/^# (.+)$/m)?.[1] ?? slug, ...toHtml(slug, md) };
}

// The index page becomes an introduction: the contents table is replaced by the real TOC.
function readIntro() {
  const md = readFileSync(path.join(GUIDE, "index.md"), "utf8")
    .replace(/## Contents[\s\S]*?(?=## Glossary)/, "")
    .replace(/^# .+$/m, "# Introduction");
  return { slug: "index", title: "Introduction", ...toHtml("index", md) };
}

const CSS = `
@font-face { font-family: Inter; src: url("${fileUrl("src/app/fonts/inter-latin-var.woff2")}") format("woff2"); font-weight: 100 900; }
@page { size: A4; margin: 18mm 18mm 22mm 18mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Inter, sans-serif; font-size: 10pt; line-height: 1.5; color: #21232C; margin: 0; }
h1, h2, h3 { color: #211C52; line-height: 1.25; break-after: avoid; break-inside: avoid; }
h2 + p, h3 + p { break-before: avoid; }
h1 { font-size: 22pt; font-weight: 700; margin: 0 0 6mm; padding-bottom: 3mm; border-bottom: 2.5pt solid #2D8548; }
h2 { font-size: 13.5pt; font-weight: 650; margin: 7mm 0 2.5mm; }
h3 { font-size: 11pt; font-weight: 650; margin: 5mm 0 2mm; }
.chapter { break-before: page; }
.chapter:first-of-type { break-before: auto; }
p, li { orphans: 3; widows: 3; }
p { margin: 0 0 2.5mm; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin: 0.6mm 0; }
a { color: #017737; text-decoration: none; }
strong { font-weight: 650; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 8.5pt; background: #F5F5F5; border-radius: 3px; padding: 0.3mm 1mm; }
pre { background: #F5F5F5; border: 1px solid #E3E3E3; border-radius: 4px; padding: 3mm; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
pre code { background: none; padding: 0; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 8.8pt; break-inside: auto; }
tr { break-inside: avoid; }
th, td { border: 1px solid #E5E5E5; padding: 1.6mm 2mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
td code, th code { white-space: nowrap; }
th { background: #F5F5F5; color: #211C52; font-weight: 650; }
p:has(> img.shot) { break-inside: avoid; margin: 3mm 0 4mm; }
img.shot { display: block; max-width: 100%; max-height: 92mm; margin: 0 auto; border: 1px solid #E3E3E3; border-radius: 4px; }
img.shot.tall { max-height: 105mm; }
h2 + p:has(> img.shot) { break-before: avoid; }
.keep { break-inside: avoid; }
.path { font-family: ui-monospace, Menlo, monospace; font-size: 8.5pt; }
.toc h1 { margin-bottom: 4mm; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: baseline; margin: 0; padding: 0.9mm 0; break-inside: avoid; }
.toc li.l1 { font-weight: 650; color: #211C52; margin-top: 2.5mm; }
.toc li.l2 { padding-left: 6mm; font-size: 9.2pt; }
.toc li a { color: inherit; }
.toc .dots { flex: 1; border-bottom: 1px dotted #CACACA; margin: 0 2mm; transform: translateY(-1mm); }
.toc .num { min-width: 7mm; text-align: right; font-variant-numeric: tabular-nums; }
`;

function tocHtml(parts, pages, combined) {
  const items = parts.flatMap((part, i) =>
    part.headings
      .filter((h) => (combined ? h.depth <= 2 : h.depth === 2))
      .map((h) => {
        const label =
          h.depth === 1 && combined && part.slug !== "index" ? `${i}. ${h.text}` : h.text;
        return `<li class="l${h.depth}"><a href="#${h.id}">${label}</a><span class="dots"></span><span class="num">${pages.get(h.id) ?? ""}</span></li>`;
      }),
  );
  return `<section class="toc"><h1>Contents</h1><ol>${items.join("")}</ol></section>`;
}

function coverHtml(subtitle) {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Inter; src: url("${fileUrl("src/app/fonts/inter-latin-var.woff2")}") format("woff2"); font-weight: 100 900; }
@page { size: A4; margin: 0; }
body { margin: 0; font-family: Inter, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cover { box-sizing: border-box; position: relative; width: 210mm; height: 297mm; background: #211C52; color: #fff; overflow: hidden; padding: 34mm 24mm; }
.leaf { position: absolute; right: -60mm; bottom: -40mm; width: 230mm; opacity: 0.1; }
.logo { width: 92mm; display: block; }
.kicker { margin-top: 70mm; font-size: 12pt; letter-spacing: 0.08em; text-transform: uppercase; color: #58CC85; font-weight: 600; }
h1 { font-size: 40pt; line-height: 1.1; margin: 4mm 0 0; font-weight: 700; }
.sub { font-size: 15pt; margin-top: 6mm; opacity: 0.85; }
.meta { position: absolute; left: 24mm; bottom: 24mm; font-size: 10pt; opacity: 0.75; line-height: 1.6; }
</style><div class="cover">
<svg class="leaf" viewBox="4 6 40 40"><path d="M6 26A18 18 0 0 1 24 8h18v18a18 18 0 0 1-36 0z" fill="#58CC85"/></svg>
<img class="logo" src="${fileUrl("brand/svg/logo-horizontal/dealflow-logo-horizontal-reverse.svg")}" alt="Dealflow">
<div class="kicker">User Guide</div><h1>${subtitle}</h1>
<div class="sub">Business development CRM</div>
<div class="meta">Version ${VERSION} · ${date}<br>dealflow.umev.co.uk</div></div>`;
}

// Maps each named destination (heading id) to its 1-based page number in the rendered body.
async function destinationPages(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  const pageIndex = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i + 1]));
  const dests = doc.catalog.lookupMaybe(PDFName.of("Dests"), PDFDict);
  const pages = new Map();
  if (!dests) return pages;
  for (const [name, value] of dests.entries()) {
    const array = doc.context.lookup(value);
    const ref = array?.get?.(0);
    if (ref instanceof PDFRef)
      pages.set(decodeURIComponent(name.decodeText()), pageIndex.get(ref.toString()));
  }
  return pages;
}

// Rendered from a file next to the PDFs: a page set with setContent starts at about:blank, which
// may not load the file:// screenshots, fonts and logo.
async function renderPdf(page, html) {
  const tmp = path.join(OUT, ".render.html");
  writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Keep each heading on the same page as what follows it, up to and including its first
  // screenshot, so no heading is stranded at the bottom of a page.
  await page.evaluate(() => {
    for (const heading of document.querySelectorAll("h2, h3")) {
      const group = [heading];
      let next = heading.nextElementSibling;
      while (next && group.length < 4 && !/^H[1-3]$/.test(next.tagName)) {
        group.push(next);
        if (next.querySelector("img")) break;
        next = next.nextElementSibling;
      }
      const last = group[group.length - 1];
      const members = last.querySelector("img") ? group : group.slice(0, 2);
      const keep = document.createElement("div");
      keep.className = "keep";
      heading.before(keep);
      keep.append(...members);
    }
  });
  return page.pdf({ preferCSSPageSize: true, printBackground: true });
}

async function buildDocument(page, { title, footer, parts, combined }) {
  const body = (pages) =>
    `<!doctype html><html lang="en-GB"><meta charset="utf-8"><title>${title}</title><style>${CSS}</style>` +
    `<body>${tocHtml(parts, pages, combined)}${parts.map((p) => p.html).join("")}</body></html>`;
  // Render, read back where each heading landed, and render again with those numbers until they
  // stop moving (a filled-in TOC can be a page longer than a blank one). Usually two or three passes.
  let numbers = new Map();
  let second;
  for (let pass = 0; pass < 4; pass += 1) {
    second = await renderPdf(page, body(numbers));
    const landed = new Map([...(await destinationPages(second))].map(([id, n]) => [id, n + 1]));
    const stable =
      landed.size === numbers.size && [...landed].every(([id, n]) => numbers.get(id) === n);
    numbers = landed;
    if (stable) break;
  }
  const out = await PDFDocument.create();
  const cover = await PDFDocument.load(await renderPdf(page, coverHtml(title)));
  const bodyDoc = await PDFDocument.load(second);
  for (const p of await out.copyPages(cover, cover.getPageIndices())) out.addPage(p);
  for (const p of await out.copyPages(bodyDoc, bodyDoc.getPageIndices())) out.addPage(p);

  const font = await out.embedFont(StandardFonts.Helvetica);
  const grey = rgb(0.4, 0.41, 0.44);
  out.getPages().forEach((p, i) => {
    if (i === 0) return;
    const { width } = p.getSize();
    const margin = 51; // 18 mm in points
    p.drawLine({
      start: { x: margin, y: 44 },
      end: { x: width - margin, y: 44 },
      thickness: 0.5,
      color: rgb(0.89, 0.89, 0.89),
    });
    p.drawText(footer, { x: margin, y: 31, size: 8, font, color: grey });
    const num = String(i + 1);
    p.drawText(num, {
      x: width - margin - font.widthOfTextAtSize(num, 8),
      y: 31,
      size: 8,
      font,
      color: grey,
    });
  });
  out.setTitle(`Dealflow User Guide${combined ? "" : `: ${title}`}`);
  out.setAuthor("Dealflow");
  out.setSubject("Dealflow user documentation");
  out.setCreator("scripts/dealflow/build-user-guide-pdf.mjs");
  return out.save();
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.DOCS_CHROME ? { executablePath: process.env.DOCS_CHROME } : {},
);
const page = await browser.newPage();
const sections = SECTIONS.map(readSection);
const written = [];

for (const [i, section] of sections.entries()) {
  const name = `${String(i + 1).padStart(2, "0")}-${section.slug}.pdf`;
  const bytes = await buildDocument(page, {
    title: section.title,
    footer: `Dealflow User Guide · ${section.title}`,
    parts: [section],
    combined: false,
  });
  writeFileSync(path.join(OUT, name), bytes);
  written.push(name);
}

const all = await buildDocument(page, {
  title: "Dealflow User Guide",
  footer: "Dealflow User Guide",
  parts: [readIntro(), ...sections],
  combined: true,
});
writeFileSync(path.join(OUT, "Dealflow User Guide.pdf"), all);
written.push("Dealflow User Guide.pdf");

await browser.close();
rmSync(path.join(OUT, ".render.html"), { force: true });
console.log(written.map((w) => `docs/user-guide/pdf/${w}`).join("\n"));
