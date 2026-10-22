// Builds the static marketing site: website/src (pages, layout, assets) + docs/user-guide -> website/public.
//   pnpm site:build
// The output is plain HTML, CSS and images with no runtime dependency on the app, and is committed
// so Vercel can serve website/public without a build step (see website/README.md). It never deletes
// anything: files are written over, so a stale page has to be removed by hand.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Marked } from "marked";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "website/src");
const OUT = path.join(ROOT, "website/public");
const GUIDE = path.join(ROOT, "docs/user-guide");
const ORIGIN = "https://dealflow.umev.co.uk";

// Section order matches the PDFs (scripts/dealflow/build-user-guide-pdf.mjs).
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

const ICONS = {
  kanban:
    '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
  sparkle:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  folder: '<path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  server:
    '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  bell: '<path d="M6 16v-5a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^\w\- ]/g, "")
    .trim()
    .replace(/ /g, "-");

// PNG width and height from the IHDR chunk, so every <img> reserves its space (no layout shift).
function pngSize(file) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const layout = readFileSync(path.join(SRC, "layout.html"), "utf8");
function render({ title, description, urlPath, nav, bodyClass, noindex, content }) {
  let html = layout
    .replaceAll("{{title}}", escapeHtml(title))
    .replaceAll("{{description}}", escapeHtml(description))
    .replaceAll("{{url}}", ORIGIN + urlPath)
    .replaceAll("{{origin}}", ORIGIN)
    .replaceAll("{{bodyClass}}", bodyClass ?? "")
    .replace("{{content}}", content);
  for (const key of ["features", "get-started", "docs", "about"]) {
    html = html.replaceAll(`{{nav:${key}}}`, key === nav ? ' aria-current="page"' : "");
  }
  if (noindex) html = html.replace("</title>", '</title>\n<meta name="robots" content="noindex">');
  return html.replace(/\{\{icon:([a-z]+)\}\}/g, (_, name) => icon(name));
}

function write(urlPath, html) {
  const file = urlPath === "/" ? "index.html" : `${urlPath.replace(/^\//, "")}.html`;
  const target = path.join(OUT, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, html);
}

// --- Static assets -------------------------------------------------------------------------
mkdirSync(path.join(OUT, "assets/fonts"), { recursive: true });
cpSync(path.join(SRC, "assets"), path.join(OUT, "assets"), { recursive: true });
const copy = (from, to) => cpSync(path.join(ROOT, from), path.join(OUT, to), { recursive: true });
copy("src/app/fonts/inter-latin-var.woff2", "assets/fonts/inter-latin-var.woff2");
copy("brand/svg/logo-horizontal/dealflow-logo-horizontal-colour.svg", "assets/dealflow-logo.svg");
copy(
  "brand/svg/logo-horizontal/dealflow-logo-horizontal-reverse.svg",
  "assets/dealflow-logo-reverse.svg",
);
copy("brand/social/og-image-1200x630.png", "assets/og-image.png");
copy("brand/social/x-card-1200x675.png", "assets/x-card.png");
copy("brand/app-icons/favicon.ico", "favicon.ico");
copy("brand/app-icons/icon.svg", "icon.svg");
copy("brand/app-icons/apple-touch-icon.png", "apple-touch-icon.png");
copy("docs/user-guide/images", "docs/images");
copy("docs/user-guide/pdf", "docs/pdf");
writeFileSync(
  path.join(OUT, "assets/leaf.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 6 40 40"><path d="M6 26A18 18 0 0 1 24 8h18v18a18 18 0 0 1-36 0z" fill="#58CC85"/></svg>\n',
);

// --- Marketing pages -----------------------------------------------------------------------
const urls = [];
for (const file of readdirSync(path.join(SRC, "pages"))) {
  const raw = readFileSync(path.join(SRC, "pages", file), "utf8");
  const meta = JSON.parse(raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/)[1]);
  const content = raw.replace(/^<!--[\s\S]*?-->\n/, "");
  write(meta.path, render({ ...meta, urlPath: meta.path, content }));
  if (!meta.noindex) urls.push(meta.path);
}

// --- Docs -----------------------------------------------------------------------------------
function markdownToHtml(md) {
  const headings = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        const id = slugify(text);
        const inner = this.parser.parseInline(tokens);
        if (depth === 2) headings.push({ id, text: inner });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, tokens }) {
        const inner = this.parser.parseInline(tokens);
        if (/^https?:/.test(href)) return `<a href="${href}">${inner}</a>`;
        if (href.startsWith("..")) return `<code>${inner.replace(/<\/?code>/g, "")}</code>`;
        const [file, anchor] = href.split("#");
        const page = file === "" ? "" : `/docs/${file.replace(/\.md$/, "")}`;
        return `<a href="${page}${anchor ? `#${anchor}` : ""}">${inner}</a>`;
      },
      image({ href, text }) {
        const { width, height } = pngSize(path.join(GUIDE, href));
        return `<img src="/docs/${href}" alt="${escapeHtml(text)}" width="${width}" height="${height}" loading="lazy">`;
      },
    },
  });
  const html = marked
    .parse(md, { async: false })
    .replaceAll(
      "<table>",
      '<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table>',
    )
    .replaceAll("</table>", "</table></div>")
    .replaceAll("<pre>", '<pre tabindex="0">');
  return { html, headings };
}

const sections = SECTIONS.map((slug, i) => {
  const md = readFileSync(path.join(GUIDE, `${slug}.md`), "utf8");
  const title = md.match(/^# (.+)$/m)?.[1] ?? slug;
  const intro = md
    .replace(/^# .+$/m, "")
    .trim()
    .split("\n\n")[0]
    .replace(/[*`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return { slug, title, intro, md, pdf: `${String(i + 1).padStart(2, "0")}-${slug}.pdf` };
});

const sidebar = (current, headings) =>
  `<nav class="docs-side" aria-label="User guide"><h2>User guide</h2><ul><li><a href="/docs"${current === "" ? ' aria-current="page"' : ""}>Overview</a></li>${sections
    .map(
      (s) =>
        `<li><a href="/docs/${s.slug}"${s.slug === current ? ' aria-current="page"' : ""}>${s.title}</a></li>`,
    )
    .join("")}</ul>${
    headings.length > 0
      ? `<h2>On this page</h2><ul>${headings.map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`).join("")}</ul>`
      : ""
  }<h2>Download</h2><ul><li><a class="pdf-link" href="/docs/pdf/Dealflow%20User%20Guide.pdf">Full guide</a></li></ul></nav>`;

sections.forEach((s, i) => {
  const { html, headings } = markdownToHtml(s.md);
  const prev = sections[i - 1];
  const next = sections[i + 1];
  const pager = `<nav class="pager" aria-label="Previous and next">${
    prev ? `<a href="/docs/${prev.slug}">← ${prev.title}</a>` : "<span></span>"
  }${next ? `<a href="/docs/${next.slug}">${next.title} →</a>` : "<span></span>"}</nav>`;
  const content = `<div class="wrap docs-layout">${sidebar(s.slug, headings)}<article class="prose">${html}<p><a class="pdf-link" href="/docs/pdf/${encodeURIComponent(s.pdf)}">Download this section as a PDF</a></p>${pager}</article></div>`;
  write(
    `/docs/${s.slug}`,
    render({
      title: `${s.title}: Dealflow User Guide`,
      description: s.intro.slice(0, 155),
      urlPath: `/docs/${s.slug}`,
      nav: "docs",
      content,
    }),
  );
  urls.push(`/docs/${s.slug}`);
});

const indexMd = readFileSync(path.join(GUIDE, "index.md"), "utf8");
const glossary = markdownToHtml(indexMd.slice(indexMd.indexOf("## Glossary"))).html;
const cards = sections
  .map(
    (s) =>
      `<div class="card"><h3><a href="/docs/${s.slug}">${s.title}</a></h3><p>${escapeHtml(s.intro)}</p><a class="pdf-link" href="/docs/pdf/${encodeURIComponent(s.pdf)}">PDF</a></div>`,
  )
  .join("");
write(
  "/docs",
  render({
    title: "User guide: Dealflow",
    description:
      "Step-by-step guides for everyone who uses Dealflow, from first sign-in to admin settings and self-hosting, with PDF downloads.",
    urlPath: "/docs",
    nav: "docs",
    content: `<section class="docs-hero"><div class="wrap"><span class="eyebrow">Docs</span><h1>Dealflow User Guide</h1><p class="lead">Task-based guides for sales and business development staff, admins and the person who runs the server. Every section is also available as a PDF.</p><div class="btn-row"><a class="btn btn-primary" href="/docs/getting-started">Start with Getting started</a><a class="btn btn-ghost" href="/docs/pdf/Dealflow%20User%20Guide.pdf">Download the full guide (PDF)</a></div></div></section><section class="section" style="padding-top:56px"><div class="wrap"><div class="grid doc-cards">${cards}</div><div class="prose" style="margin-top:72px">${glossary}</div></div></section>`,
  }),
);
urls.push("/docs");

// --- SEO files ------------------------------------------------------------------------------
writeFileSync(
  path.join(OUT, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`,
);
writeFileSync(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .sort()
    .map((u) => `  <url><loc>${ORIGIN}${u === "/" ? "/" : u}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
);

if (!existsSync(path.join(OUT, "index.html"))) throw new Error("site build produced no index.html");
console.log(`website/public: ${urls.length} pages`);
