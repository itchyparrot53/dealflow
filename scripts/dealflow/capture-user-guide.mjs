// Captures the user-guide screenshots from a running, seeded Dealflow (docs/user-guide/images).
// Needs a development-mode app (the dev login route) with the demo seed, AI_FAKE=true and MAIL_FAKE=true:
//   DOCS_BASE_URL=http://localhost:3001 node scripts/dealflow/capture-user-guide.mjs [name ...]
// Optional DOCS_CHROME points at a Chromium binary when Playwright's own browser is not installed.
// IDs are looked up by visible text, so a reseeded database works without editing this file.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.DOCS_BASE_URL ?? "http://localhost:3001";
const OUT = path.resolve("docs/user-guide/images");
const USER = process.env.DOCS_USER ?? "demo1@example.com";
const only = new Set(process.argv.slice(2));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(
  process.env.DOCS_CHROME ? { executablePath: process.env.DOCS_CHROME } : {},
);
// Avatars in the demo seed come from a stock-photo service; block them so only initials show.
// The style hides the Next.js development badge.
async function newPage(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({
    viewport,
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Europe/London",
  });
  await ctx.route(/pravatar/, (r) => r.abort());
  await ctx.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}";
      document.head.append(s);
    });
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  return ctx.newPage();
}
const settle = (p) =>
  p
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => {})
    .then(() => p.waitForTimeout(700));
const go = async (p, url) => {
  await p.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await settle(p);
};
const signIn = async (p) => {
  await p.goto(`${BASE}/auth/dev-login?email=${encodeURIComponent(USER)}`);
  await settle(p);
};
async function hrefOf(p, url, linkText) {
  await go(p, url);
  const href = await p.getByRole("link", { name: linkText }).first().getAttribute("href");
  if (href === null) throw new Error(`no link "${linkText}" on ${url}`);
  return href;
}

const results = [];
async function shot(p, name, fn) {
  if (only.size > 0 && !only.has(name)) return;
  try {
    await fn();
    await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e.message).split("\n")[0]}`);
  }
  await p.keyboard.press("Escape").catch(() => {});
}

// Signed out.
const out = await newPage();
await shot(out, "sign-in", () => go(out, "/login"));
await shot(out, "sign-in-email-link", async () => {
  await go(out, "/login");
  await out.getByRole("tab", { name: "Email link" }).click();
});

const p = await newPage();
await signIn(p);
const pipeline = await hrefOf(p, "/pipeline", "List view").then((h) => h.replace(/\/list$/, ""));
const deal = await hrefOf(p, `${pipeline}/list`, "enterprise plan deal #6");
const dealProducts = await hrefOf(p, `${pipeline}/list`, "Demo GBP rollout");

// Getting started.
await shot(p, "board", () => go(p, pipeline));
await shot(p, "quick-add", async () => {
  await go(p, pipeline);
  await p.getByRole("button", { name: "Quick add" }).click();
  await p.waitForTimeout(600);
});
await shot(p, "command-palette", async () => {
  await go(p, pipeline);
  await p.keyboard.press("ControlOrMeta+k");
  await p.waitForTimeout(400);
});
await shot(p, "search", async () => {
  await go(p, pipeline);
  await p.getByRole("button", { name: "Open search" }).click();
  await p.keyboard.type("North", { delay: 40 });
  await p.waitForTimeout(1500);
});
await shot(p, "page-info", async () => {
  await go(p, pipeline);
  await p.getByRole("button", { name: "Page information" }).first().hover();
  await p.waitForTimeout(900);
});
await shot(p, "account-menu", async () => {
  await go(p, pipeline);
  await p.getByRole("button", { name: "Account menu" }).click();
  await p.waitForTimeout(600);
});

// Pipelines and deals.
await shot(p, "pipeline-list", () => go(p, `${pipeline}/list`));
await shot(p, "pipeline-filter", async () => {
  await go(p, pipeline);
  await p.getByRole("button", { name: "Filter" }).first().click();
  await p.waitForTimeout(600);
});
await shot(p, "pipeline-edit", () => go(p, `${pipeline}/edit`));
await shot(p, "forecast", () => go(p, "/forecast"));
await shot(p, "deal", () => go(p, deal));
await shot(p, "deal-products", async () => {
  await go(p, dealProducts);
  await p
    .getByText("Products", { exact: true })
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
});
await shot(p, "deal-won-lost", async () => {
  await go(p, deal);
  await p.getByRole("button", { name: "Lost" }).first().click();
  await p.waitForTimeout(400);
});
await shot(p, "leads", () => go(p, "/leads"));
await shot(p, "lead", async () => {
  await go(p, "/leads");
  await p
    .getByText(/via Contact us/)
    .first()
    .click();
  await settle(p);
});

// Activities.
await shot(p, "activities", async () => {
  await go(p, "/activities/list");
  await p.getByRole("button", { name: "This week" }).first().click();
  await settle(p);
});
await shot(p, "calendar", () => go(p, "/activities/calendar?view=week"));
await shot(p, "add-activity", async () => {
  await go(p, "/activities/list");
  await p.getByRole("button", { name: "+ Activity" }).click();
  await p.waitForTimeout(500);
});
await shot(p, "log-call", async () => {
  await go(p, deal);
  await p
    .getByRole("button", { name: "Call" })
    .first()
    .click()
    .catch(() => {});
  await p.waitForTimeout(500);
});

// Contacts and organizations.
await shot(p, "people", () => go(p, "/contacts/people"));
await shot(p, "person", async () => {
  await go(p, "/contacts/people");
  await p.getByRole("link", { name: "Aria Cohen" }).first().click();
  await settle(p);
});
await shot(p, "organizations", () => go(p, "/contacts/orgs"));
await shot(p, "organization", async () => {
  await go(p, "/contacts/orgs");
  await p.getByRole("link", { name: "Apex Dynamics" }).first().click();
  await settle(p);
});
await shot(p, "contacts-timeline", () => go(p, "/contacts/timeline"));
await shot(p, "duplicates", () => go(p, "/contacts/duplicates"));
await shot(p, "import", () => go(p, "/settings/import/new"));

// Email.
await shot(p, "inbox", () => go(p, "/inbox"));
await shot(p, "thread", async () => {
  await go(p, "/inbox");
  await p.getByText("Intro and next steps").first().click();
  await settle(p);
});
await shot(p, "compose", async () => {
  await go(p, "/inbox/compose");
  await p.waitForTimeout(600);
});
await shot(p, "email-templates", () => go(p, "/settings/email"));

// Notifications.
await shot(p, "notifications", async () => {
  await go(p, pipeline);
  await p.getByRole("button", { name: "Notifications" }).click();
  await p.waitForTimeout(600);
});
await shot(p, "notification-settings", () => go(p, "/settings/notifications"));

// Stats and reporting.
await shot(p, "performance", () => go(p, "/dashboard"));
await shot(p, "goals", () => go(p, "/settings/goals"));
await shot(p, "insights", () => go(p, "/insights"));
await shot(p, "insights-dashboard", async () => {
  await go(p, "/insights");
  await p.getByRole("link", { name: "Sales overview" }).first().click();
  await settle(p);
});
await shot(p, "insights-report", async () => {
  await go(p, "/insights");
  await p
    .getByRole("tab", { name: "Reports" })
    .click()
    .catch(() => p.getByRole("link", { name: "Reports" }).first().click());
  await settle(p);
  await p.getByRole("link", { name: "Won value by month" }).first().click();
  await settle(p);
});

// AI.
await shot(p, "ai-deal-summary", async () => {
  await go(p, deal);
  const gen = p.getByRole("button", { name: /Generate summary|Refresh summary/ }).first();
  await gen.click();
  await p.waitForTimeout(2500);
});
await shot(p, "ai-assistant", async () => {
  await go(p, pipeline);
  await p.getByRole("button", { name: "Open assistant" }).click();
  await p.waitForTimeout(600);
});
await shot(p, "ai-filter", async () => {
  await go(p, "/contacts/people");
  await p.getByLabel("Describe a filter").first().fill("people at North Systems");
});
await shot(p, "ai-email-draft", async () => {
  await go(p, deal);
  await p.getByRole("tab", { name: "Email" }).first().click();
  await p.waitForTimeout(600);
});
await shot(p, "ai-settings", () => go(p, "/settings/ai"));

// Quotes, invoices and products.
await shot(p, "documents", () => go(p, "/documents"));
await shot(p, "quote", async () => {
  await go(p, "/documents");
  await p.getByRole("link", { name: "Q-2026-0012" }).first().click();
  await settle(p);
});
await shot(p, "invoices", async () => {
  await go(p, "/documents");
  await p.getByRole("tab", { name: "Invoices" }).click();
  await settle(p);
});
await shot(p, "invoice", async () => {
  await go(p, "/documents");
  await p.getByRole("tab", { name: "Invoices" }).click();
  await settle(p);
  await p.getByRole("link", { name: "INV-2026-0022" }).first().click();
  await settle(p);
});
await shot(p, "public-quote", async () => {
  await go(p, "/documents");
  await p.getByRole("link", { name: "Q-2026-0012" }).first().click();
  await settle(p);
  await p.getByRole("button", { name: "Copy link" }).click();
  const link = await p.evaluate(() => navigator.clipboard.readText());
  await p.goto(new URL(new URL(link).pathname, BASE).toString());
  await settle(p);
});
await shot(p, "products", () => go(p, "/settings/products"));
await shot(p, "document-settings", () => go(p, "/settings/documents"));
await shot(p, "currencies", () => go(p, "/settings/currencies"));

// Projects.
await shot(p, "projects", () => go(p, "/projects"));
await shot(p, "project", async () => {
  await go(p, "/projects");
  await p.getByRole("link", { name: "Website relaunch" }).first().click();
  await settle(p);
});

// Forms and booking pages.
await shot(p, "forms", () => go(p, "/settings/forms"));
await shot(p, "form-editor", async () => {
  await go(p, "/settings/forms");
  await p.getByRole("link", { name: "Contact us" }).first().click();
  await settle(p);
});
await shot(p, "booking-pages", () => go(p, "/settings/booking"));
await shot(p, "booking-editor", async () => {
  await go(p, "/settings/booking");
  await p.getByRole("link", { name: "Intro call" }).first().click();
  await settle(p);
});

// Admin.
for (const [name, url] of [
  ["profile", "/settings/profile"],
  ["users", "/settings/users"],
  ["teams", "/settings/teams"],
  ["permission-sets", "/settings/permission-sets"],
  ["visibility-groups", "/settings/visibility-groups"],
  ["company-settings", "/settings/company"],
  ["data-fields", "/settings/fields"],
  ["automations", "/settings/automations"],
  ["webhooks", "/settings/webhooks"],
  ["api-tokens", "/settings/api"],
  ["connected-apps", "/settings/connections"],
  ["recycle-bin", "/settings/recycle-bin"],
  ["audit-log", "/settings/audit-log"],
  ["backups", "/settings/backups"],
  ["offline", "/offline"],
])
  await shot(p, name, () => go(p, url));
await shot(p, "automation-editor", async () => {
  await go(p, "/settings/automations");
  await p
    .getByRole("link", { name: /Onboarding call when a deal is won/ })
    .first()
    .click();
  await settle(p);
});

// Public pages (signed out) and mobile.
const pub = await newPage();
// The form editor shows the embed snippet, which carries the public path.
const formLink = await (async () => {
  await go(p, "/settings/forms");
  await p.getByRole("link", { name: "Contact us" }).first().click();
  await settle(p);
  const path = await p.evaluate(() => document.body.innerHTML.match(/\/f\/[\w-]+/)?.[0]);
  return path ? BASE + path : undefined;
})();
const bookLink = await (async () => {
  await go(p, "/settings/booking");
  return p.evaluate(() =>
    [...document.querySelectorAll("a")].map((a) => a.href).find((h) => /\/book\//.test(h)),
  );
})();
if (formLink) await shot(pub, "public-form", () => go(pub, new URL(formLink).pathname));
if (bookLink)
  await shot(pub, "public-booking", async () => {
    await go(pub, new URL(bookLink).pathname);
    await pub
      .getByRole("button", { name: /Mon/ })
      .first()
      .click()
      .catch(() => {});
    await settle(pub);
  });

// Only the admin has no mailbox connected, so Email sync shows the connect form. The admin account
// may prefer Night mode; the class is dropped for this screenshot only, nothing is saved.
const a = await newPage();
await a.goto(`${BASE}/auth/dev-login?email=admin%40example.com`);
await settle(a);
await shot(a, "email-sync", async () => {
  await go(a, "/settings/email-sync");
  await a.evaluate(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  });
  await a.waitForTimeout(300);
});

const m = await newPage({ width: 390, height: 844 });
await signIn(m);
await shot(m, "mobile-board", () => go(m, pipeline));
await shot(m, "mobile-more", async () => {
  await go(m, pipeline);
  await m.getByRole("button", { name: "More" }).last().click();
  await m.waitForTimeout(500);
});

await browser.close();
console.log(results.join("\n"));
