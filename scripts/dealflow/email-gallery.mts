// Part 13 email gallery: render every registry template with sample data and screenshot it at
// 600 and 375 px. No database is needed; a tiny static server serves public/brand so the logo
// resolves inside the browser. Run with `pnpm email:gallery`.

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";

const OUT = "e2e/screenshots/email";
const PORT = 3410;
const BASE = `http://127.0.0.1:${PORT}`;

// tokens.ts reads env.BASE_URL at import time, so set it before the dynamic imports below.
process.env.BASE_URL = BASE;

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0] ?? "/";
  const file = normalize(join("public", path));
  try {
    if (!file.startsWith("public") || !statSync(file).isFile()) throw new Error("not a file");
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));

const { EMAIL_TEMPLATE_KEYS, sampleVariables } = await import(
  "../../src/features/email-design/registry"
);
const { renderDefaultTemplate } = await import("../../src/features/email-design/sendSystemEmail");
const { wrapCustomerEmail } = await import("../../src/features/email-design/wrapCustomerEmail");
const { htmlToText } = await import("../../src/features/email-design/layout");

import type { EmailDesign } from "../../src/features/email-design/tokens";

const customer: EmailDesign = {
  displayName: "Northwind Studio",
  accentColor: "#1F5FBF",
  logo: null,
  showAddress: true,
  addressLines: ["1 Northwind Way", "London EC1A 1AA"],
  footerText: "Northwind Studio Ltd, registered in England.",
  showPoweredBy: false,
  newEmailLayout: "branded",
  replyLayout: "minimal",
  footerOnReplies: false,
};

interface Sample {
  name: string;
  html: string;
  text: string;
}

const samples: Sample[] = [];
for (const key of EMAIL_TEMPLATE_KEYS) {
  const rendered = renderDefaultTemplate(key, sampleVariables(key), customer);
  samples.push({ name: key, html: rendered.html, text: rendered.text });
}

const newEmail = wrapCustomerEmail({
  bodyHtml:
    "<p>Hi Aria,</p><p>Here is the summary we discussed. Let me know what you think.</p><p>Best,<br>Demo Admin</p>",
  mode: "new",
  design: customer,
});
samples.push({ name: "customer_message-new", html: newEmail.html, text: newEmail.text ?? "" });

const reply = wrapCustomerEmail({
  bodyHtml: "<p>Thanks Aria, that works for me.</p><p>Demo Admin</p>",
  mode: "reply",
  design: customer,
});
samples.push({ name: "customer_message-reply", html: reply.html, text: reply.text ?? "" });

samples.push({
  name: "customer_message-plain",
  html: "<p>Hi Aria,</p><p>Plain layout, sent exactly as written.</p>",
  text: htmlToText("<p>Hi Aria,</p><p>Plain layout, sent exactly as written.</p>"),
});

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.DOCS_CHROME || undefined,
});
const page = await browser.newPage({ viewport: { width: 600, height: 900 } });
let failures = 0;

for (const sample of samples) {
  writeFileSync(join(OUT, `${sample.name}.html`), sample.html, "utf8");
  const bytes = Buffer.byteLength(sample.html, "utf8");
  console.log(`${sample.name}.html ${bytes} bytes`);
  if (bytes > 90 * 1024) {
    console.error(`FAIL ${sample.name}: ${bytes} bytes is over 90 KB`);
    failures += 1;
  }
  await page.setContent(sample.html, { waitUntil: "load" });
  await page.waitForTimeout(100);
  await page.setViewportSize({ width: 600, height: 900 });
  await page.screenshot({ path: join(OUT, `${sample.name}-600.png`), fullPage: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: join(OUT, `${sample.name}-375.png`), fullPage: true });
}

await browser.close();
server.close();
const files = samples.length * 2;
console.log(`email gallery: ${samples.length} emails, ${files} screenshots in ${OUT}`);
if (failures > 0) process.exit(1);
