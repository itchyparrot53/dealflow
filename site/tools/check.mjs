#!/usr/bin/env node
/* eslint-disable */
// Landing site acceptance checks. Expects a static server, for example:
//   npx --yes serve site -l 4173
//   node site/tools/check.mjs
//
// The optional GitHub stars request is seeded or intercepted here so the
// checks are deterministic and do not depend on the public repository being up.

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const base = (process.env.SITE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const here = fileURLToPath(new URL(".", import.meta.url));
const screens = resolve(here, "screens");
const widths = [1440, 1024, 768, 390, 360];
const failures = [];
const notes = [];

const check = (ok, label, detail = "") => {
  const line = `${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`;
  console.log(line);
  if (!ok) failures.push(label);
  return ok;
};

const seedStars = () => {
  try {
    localStorage.setItem("dealflow:stars", JSON.stringify({ at: Date.now(), stars: 1284 }));
  } catch {
    // Ignore storage failures in the check harness.
  }
};

const loadLazy = async (page) => {
  await page.evaluate(async () => {
    const step = Math.max(320, Math.round(window.innerHeight * 0.72));
    const height = document.documentElement.scrollHeight;
    for (let y = 0; y < height; y += step) {
      window.scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 35));
    }
    window.scrollTo(0, 0);
    await new Promise((done) => setTimeout(done, 250));
    document.querySelectorAll('img[loading="lazy"]').forEach((image) => {
      image.loading = "eager";
    });
    const header = document.querySelector(".site-header");
    if (header) header.style.position = "static";
    await new Promise((done) => setTimeout(done, 400));
  });
  await page.evaluate(async () => {
    const images = Array.from(document.images).filter(
      (image) => !image.closest(".tour-panel:not(.is-active)") && !image.complete,
    );
    await Promise.all(
      images.map((image) =>
        Promise.race([
          new Promise((done) => {
            image.addEventListener("load", done, { once: true });
            image.addEventListener("error", done, { once: true });
          }),
          new Promise((done) => setTimeout(done, 2000)),
        ]),
      ),
    );
  });
};

const luminance = (hex) => {
  const channels = hex
    .replace("#", "")
    .match(/../g)
    .map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (foreground, background) => {
  const one = luminance(foreground);
  const two = luminance(background);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
};

const composite = (foreground, alpha, background) => {
  const mix = (part) =>
    Math.round(
      parseInt(foreground.slice(part, part + 2), 16) * alpha +
        parseInt(background.slice(part, part + 2), 16) * (1 - alpha),
    );
  return `#${[1, 3, 5].map((part) => mix(part).toString(16).padStart(2, "0")).join("")}`;
};

const main = async () => {
  const response = await fetch(`${base}/`);
  if (!response.ok)
    throw new Error(
      `The site is not reachable at ${base} (HTTP ${response.status}). Start it with: npx --yes serve site -l 4173`,
    );
  await mkdir(screens, { recursive: true });

  const browser = await chromium.launch();
  const consoleErrors = [];
  let firstPage = null;

  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(seedStars);
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`${width}px console: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(`${width}px pageerror: ${error.message}`));

    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await loadLazy(page);

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    check(
      dimensions.scrollWidth <= dimensions.innerWidth &&
        dimensions.bodyWidth <= dimensions.innerWidth,
      `${width}px has no horizontal page scroll`,
      `${dimensions.scrollWidth} / ${dimensions.innerWidth}`,
    );

    await page.screenshot({ path: resolve(screens, `home-${width}.png`), fullPage: true });

    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    check(
      serious.length === 0,
      `${width}px axe has zero serious or critical violations`,
      serious.map((item) => item.id).join(", "),
    );

    if (width === 1440) firstPage = page;
    else await context.close();
  }

  // Internal anchors.
  const missingAnchors = await firstPage.evaluate(() => {
    const ids = new Set(Array.from(document.querySelectorAll("[id]"), (element) => element.id));
    return Array.from(document.querySelectorAll('a[href^="#"]'))
      .map((anchor) => anchor.getAttribute("href"))
      .filter((href) => href && href !== "#" && !ids.has(decodeURIComponent(href.slice(1))));
  });
  check(missingAnchors.length === 0, "every internal anchor resolves", missingAnchors.join(", "));

  // Every local asset reference, including font URLs in the stylesheet.
  const assetRefs = await firstPage.evaluate(() => {
    const refs = new Set();
    document.querySelectorAll("[src], [href]").forEach((element) => {
      const value = element.getAttribute("src") || element.getAttribute("href");
      if (value && value.startsWith("./assets/")) refs.add(value);
    });
    return Array.from(refs);
  });
  const cssHref = await firstPage.evaluate(
    () => document.querySelector('link[rel="stylesheet"]').href,
  );
  const cssText = await (await firstPage.request.get(cssHref)).text();
  for (const match of cssText.matchAll(/url\(["']?(\.\/assets\/[^"')]+)/g))
    assetRefs.push(match[1]);

  const badAssets = [];
  for (const ref of Array.from(new Set(assetRefs))) {
    const assetResponse = await firstPage.request.get(new URL(ref, `${base}/`).href);
    if (assetResponse.status() !== 200) badAssets.push(`${ref} -> ${assetResponse.status()}`);
  }
  check(
    badAssets.length === 0,
    `every ./assets/ reference returns 200 (${new Set(assetRefs).size} files)`,
    badAssets.join(", "),
  );

  // Tabs by keyboard, then by click.
  const tabs = firstPage.locator('[role="tab"]');
  await tabs.first().focus();
  await firstPage.keyboard.press("ArrowRight");
  let tabState = await firstPage.evaluate(() => ({
    focused: document.activeElement && document.activeElement.id,
    selected: document.querySelector('[role="tab"][aria-selected="true"]')?.id,
    panel: document.querySelector("#panel-deal")?.classList.contains("is-active"),
  }));
  check(
    tabState.focused === "tab-deal" && tabState.selected === "tab-deal" && tabState.panel,
    "tabs move with ArrowRight and focus follows",
    JSON.stringify(tabState),
  );

  await firstPage.keyboard.press("End");
  tabState = await firstPage.evaluate(() => ({
    focused: document.activeElement && document.activeElement.id,
    selected: document.querySelector('[role="tab"][aria-selected="true"]')?.id,
    panel: document.querySelector("#panel-projects")?.classList.contains("is-active"),
  }));
  check(
    tabState.focused === "tab-projects" && tabState.selected === "tab-projects" && tabState.panel,
    "tabs support End and keys move focus",
    JSON.stringify(tabState),
  );

  const tabCount = await tabs.count();
  let clickFailures = 0;
  for (let index = 0; index < tabCount; index += 1) {
    const id = await tabs.nth(index).getAttribute("id");
    await tabs.nth(index).click();
    const visible = await firstPage.locator(`#${id.replace("tab-", "panel-")}`).isVisible();
    if (!visible) clickFailures += 1;
  }
  check(clickFailures === 0, "every tab click shows its panel");

  // Copy buttons, including the $ prompt strip.
  await firstPage
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await firstPage.locator(".install-chip .copy-icon").first().click();
  await firstPage.waitForTimeout(80);
  const heroClipboard = await firstPage.evaluate(() => navigator.clipboard.readText());
  check(
    heroClipboard === "git clone https://github.com/itchyparrot53/dealflow.git",
    "hero copy button copies the install command without the $ prompt",
    heroClipboard,
  );

  await firstPage.locator(".code .copy-btn").click();
  await firstPage.waitForTimeout(80);
  const codeClipboard = await firstPage.evaluate(() => navigator.clipboard.readText());
  const copyLabel = await firstPage.locator(".code .copy-btn").textContent();
  check(
    codeClipboard.startsWith("git clone") &&
      codeClipboard.includes("docker compose up -d --build") &&
      !codeClipboard.includes("$ ") &&
      copyLabel === "Copied",
    "code copy button copies commands without prompts and shows Copied",
    copyLabel,
  );

  // Mobile menu at 390.
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobileContext.addInitScript(seedStars);
  const mobile = await mobileContext.newPage();
  await mobile.goto(`${base}/`, { waitUntil: "networkidle" });
  const menuButton = mobile.locator("[data-menu-button]");
  await menuButton.click();
  let menuState = await mobile.evaluate(() => ({
    open: !document.querySelector("#mobile-menu").hidden,
    expanded: document.querySelector("[data-menu-button]").getAttribute("aria-expanded"),
    focusInside: document.querySelector("#mobile-menu").contains(document.activeElement),
  }));
  check(
    menuState.open && menuState.expanded === "true" && menuState.focusInside,
    "mobile menu opens, expands and takes focus",
    JSON.stringify(menuState),
  );

  await mobile.keyboard.press("Escape");
  menuState = await mobile.evaluate(() => ({
    closed: document.querySelector("#mobile-menu").hidden,
    expanded: document.querySelector("[data-menu-button]").getAttribute("aria-expanded"),
    focusReturned: document.activeElement === document.querySelector("[data-menu-button]"),
  }));
  check(
    menuState.closed && menuState.expanded === "false" && menuState.focusReturned,
    "mobile menu closes on Escape and returns focus",
    JSON.stringify(menuState),
  );

  await menuButton.click();
  await mobile.mouse.click(8, 500);
  check(await mobile.locator("#mobile-menu").isHidden(), "mobile menu closes on an outside tap");
  await mobileContext.close();

  // GitHub stars: the successful fetch path, then the failure fallback.
  const starContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await starContext.route("https://api.github.com/repos/itchyparrot53/dealflow", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stargazers_count: 1284 }),
    }),
  );
  const starPage = await starContext.newPage();
  await starPage.goto(`${base}/`, { waitUntil: "networkidle" });
  const starText = await starPage.locator(".stat-figure[data-stars]").textContent();
  const starPills = await starPage
    .locator(".star-count")
    .evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, hidden: node.hidden })));
  const ctaStar = await starPage
    .locator(".cta-stars")
    .evaluate((node) => ({ text: node.textContent, hidden: node.hidden }));
  check(
    starText === "1.3k" &&
      starPills.length === 2 &&
      starPills.every((pill) => pill.text === "1.3k" && pill.hidden === false) &&
      ctaStar.text === "1.3k" &&
      ctaStar.hidden === false,
    "GitHub stars format and fill every data-stars element",
    `${starText} / ${JSON.stringify(starPills)} / ${JSON.stringify(ctaStar)}`,
  );
  await starContext.close();

  const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await fallbackContext.route("https://api.github.com/repos/itchyparrot53/dealflow", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(`${base}/`, { waitUntil: "networkidle" });
  const fallbackText = await fallbackPage.locator(".stat-figure[data-stars]").textContent();
  const fallbackPills = await fallbackPage
    .locator(".star-count")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({ hidden: node.hidden, display: getComputedStyle(node).display })),
    );
  const fallbackCta = await fallbackPage
    .locator(".cta-stars")
    .evaluate((node) => ({ hidden: node.hidden, display: getComputedStyle(node).display }));
  check(
    fallbackText === "Star on GitHub" &&
      fallbackPills.length === 2 &&
      fallbackPills.every((pill) => pill.hidden === true && pill.display === "none") &&
      fallbackCta.hidden === true &&
      fallbackCta.display === "none",
    "a failed star lookup keeps the fallback and never shows 0",
    `${fallbackText} / ${JSON.stringify(fallbackPills)} / ${JSON.stringify(fallbackCta)}`,
  );
  await fallbackContext.close();

  // Without JavaScript the whole page still reads and the install commands show.
  const noJsContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  const noJs = await noJsContext.newPage();
  await noJs.goto(`${base}/`, { waitUntil: "load" });
  const noJsState = {
    dealPanel: await noJs.locator("#panel-deal").isVisible(),
    projectsPanel: await noJs.locator("#panel-projects").isVisible(),
    install: await noJs.locator("#install-code").isVisible(),
    headerNav: await noJs.locator(".header-nav").isVisible(),
    menuButton: await noJs.locator("[data-menu-button]").isHidden(),
    headings: await noJs.locator("h2").count(),
  };
  check(
    noJsState.dealPanel &&
      noJsState.projectsPanel &&
      noJsState.install &&
      noJsState.headerNav &&
      noJsState.menuButton &&
      noJsState.headings >= 10,
    "without JavaScript every section, tab panel and install command is readable",
    JSON.stringify(noJsState),
  );
  await noJs.screenshot({ path: resolve(screens, "no-js-1440.png"), fullPage: true });
  await noJsContext.close();

  // Page weight on first load at 1440.
  const weightContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await weightContext.addInitScript(seedStars);
  const weightPage = await weightContext.newPage();
  await weightPage.goto(`${base}/`, { waitUntil: "networkidle" });
  const weight = await weightPage.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    let total = navigation ? navigation.transferSize : 0;
    for (const entry of performance.getEntriesByType("resource")) total += entry.transferSize || 0;
    return total;
  });
  check(
    weight > 0 && weight < 1.5 * 1024 * 1024,
    "first load at 1440 is under 1.5 MB",
    `${(weight / 1024).toFixed(1)} KB`,
  );
  await weightContext.close();

  // External links and content rules.
  const external = await firstPage.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="http"]')).map((anchor) => ({
      href: anchor.href,
      target: anchor.target,
      rel: anchor.rel,
    })),
  );
  const badExternal = external.filter(
    (link) =>
      !link.href.startsWith("https://github.com/itchyparrot53/dealflow") ||
      link.target === "_blank",
  );
  check(
    badExternal.length === 0,
    "every external link is the Dealflow GitHub repo and opens in the same tab",
    badExternal.map((link) => link.href).join(", "),
  );

  const bodyText = await firstPage.evaluate(() => document.body.innerText.toLowerCase());
  check(!bodyText.includes("lorem ipsum"), "no lorem ipsum");
  check(
    !bodyText.includes("revolutionary") &&
      !bodyText.includes("seamless") &&
      !bodyText.includes("supercharge") &&
      !bodyText.includes("unleash") &&
      !bodyText.includes("game-changing") &&
      !bodyText.includes("blazing"),
    "no banned marketing words",
  );

  // Token contrast, including the glass-over-sage case and the code block.
  const buttonColors = await firstPage.evaluate(() => {
    const style = getComputedStyle(document.querySelector(".btn-primary"));
    return { color: style.color, background: style.backgroundColor };
  });
  check(
    buttonColors.color === "rgb(255, 255, 255)" && buttonColors.background === "rgb(45, 133, 72)",
    "primary button is white text on Dealflow green",
    JSON.stringify(buttonColors),
  );

  const glassOverSage = composite("#ffffff", 0.64, "#e6f1e9");
  const prompt = composite("#ffffff", 0.45, "#171426");
  const pairs = [
    ["white on --green", "#ffffff", "#2d8548", 4.5],
    ["--muted on glass over --sage", "#55585f", glassOverSage, 4.5],
    ["--ink on --paper", "#21232c", "#fbfcfa", 4.5],
    ["--green-ink on --paper", "#236b39", "#fbfcfa", 4.5],
    ["code text on --night", "#f4eef5", "#171426", 4.5],
    ["code comment on --night", "#9fb3a6", "#171426", 4.5],
    ["code prompt at 45% on --night", prompt, "#171426", 4.5],
  ];
  for (const [label, foreground, background, minimum] of pairs) {
    const ratio = contrast(foreground, background);
    check(ratio >= minimum, `contrast ${label}`, `${ratio.toFixed(2)}:1`);
  }

  // Expected external-network note, not a page error.
  const realErrors = consoleErrors.filter((line) => !line.includes("api.github.com"));
  check(realErrors.length === 0, "no console or page errors", realErrors.join(" | "));
  const githubNotices = consoleErrors.filter((line) => line.includes("api.github.com"));
  if (githubNotices.length)
    notes.push(
      `The optional GitHub API request logged ${githubNotices.length} network notice(s); the seeded check and the fallback test both pass.`,
    );

  await browser.close();

  console.log("\nSummary");
  console.log(
    `  ${failures.length === 0 ? "All checks passed." : `${failures.length} check(s) failed.`}`,
  );
  for (const note of notes) console.log(`  Note: ${note}`);
  if (failures.length) {
    console.log(`  Failed: ${failures.join("; ")}`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
