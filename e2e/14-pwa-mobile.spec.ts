import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { fixtures, latestMail, linkFrom, shot } from "./helpers";

// Part 10 PWA, offline, push and mobile (Task 4.1). The stack is a production build, so the
// service worker really registers and /offline is served by it when the network is cut. Push runs
// in PUSH_FAKE mode: the browser's PushManager is stubbed (no push service is contacted) and the
// server writes each delivery to .push-capture.
test.use({ storageState: ".e2e/admin.json" });
test.setTimeout(600_000);

const PUSH_DIR = ".push-capture";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Returns a stable fake subscription from any service worker registration. This removes the one
// external dependency the browser would otherwise add (Chrome's FCM connection) while still
// exercising our real subscribe action, the real delivery preference and the real capture mode.
const STUB_PUSH_MANAGER = (): void => {
  const subscription = {
    endpoint: "https://push.invalid/e2e-device",
    toJSON: () => ({
      endpoint: "https://push.invalid/e2e-device",
      keys: { p256dh: "e2e-p256dh-key", auth: "e2e-auth-secret" },
    }),
    unsubscribe: () => Promise.resolve(true),
  };
  Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", {
    configurable: true,
    get() {
      return {
        getSubscription: () => Promise.resolve(null),
        subscribe: () => Promise.resolve(subscription),
      };
    },
  });
};

async function openFirstForm(page: Page): Promise<string> {
  await page.goto("/settings/forms");
  await expect(page.getByTestId("forms-table")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("form-new").click();
  await page.waitForURL(/\/settings\/forms\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("form-editor")).toBeVisible();
  await page.locator("#form-name").fill("P10 push enquiry");
  await page.getByTestId("form-save").click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 30_000 });
  return page.getByTestId("form-public-link").inputValue();
}

async function waitForPushCapture(text: string, timeoutMs = 60_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let files: string[] = [];
    try {
      files = readdirSync(PUSH_DIR).filter((file) => file.endsWith(".json"));
    } catch {
      files = [];
    }
    for (const file of files) {
      const body = readFileSync(join(PUSH_DIR, file), "utf8");
      if (body.includes(text)) return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`no push capture file contained "${text}"`);
}

async function waitForSnapshot(page: Page, store: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await page.evaluate(async (name) => {
      const databases = await indexedDB.databases();
      const dbName = databases.find((entry) => entry.name?.startsWith("dealflow-offline-"))?.name;
      if (dbName === undefined) return 0;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!db.objectStoreNames.contains(name)) {
        db.close();
        return 0;
      }
      const total = await new Promise<number>((resolve) => {
        const request = db.transaction(name, "readonly").objectStore(name).count();
        request.onsuccess = () => resolve(request.result);
      });
      db.close();
      return total;
    }, store);
    if (count > 0) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`no ${store} snapshot was saved within ${String(timeoutMs)}ms`);
}

async function assertNoHorizontalScroll(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `horizontal overflow at ${page.url()}`).toBeLessThanOrEqual(1);
}

async function assertTapTargets(page: Page): Promise<void> {
  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('main button, main a[data-testid], main a[role="button"]')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          id:
            element.getAttribute("data-testid") ??
            `${element.tagName.toLowerCase()}:${(element.textContent ?? "").trim().slice(0, 24)}`,
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter((entry) => entry.visible && entry.height < 40)
      .map((entry) => `${entry.id} (${String(entry.height)}px)`),
  );
  expect(tooSmall, `tap targets under 40px at ${page.url()}`).toEqual([]);
}

async function mobileScreenshots(context: BrowserContext): Promise<{ deal: string }> {
  const page = await context.newPage();
  const { dealId } = fixtures();

  await page.goto("/pipeline");
  await page.waitForURL(/\/pipeline\/[0-9a-f-]+$/, { timeout: 30_000 });
  const boardUrl = page.url();
  await assertNoHorizontalScroll(page);
  await assertTapTargets(page);
  await shot(page, "p10-mobile-board");

  await page.goto(`/deals/${dealId}`);
  await expect(page.getByRole("main").first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  await assertTapTargets(page);
  await shot(page, "p10-mobile-deal");

  await page.goto("/activities/list");
  await expect(page.getByTestId("activities-search")).toBeVisible({ timeout: 30_000 });
  await assertNoHorizontalScroll(page);
  await shot(page, "p10-mobile-activities");

  await page.goto("/contacts/people");
  await expect(page.getByTestId("contact-card").first()).toBeVisible({ timeout: 20_000 });
  await assertNoHorizontalScroll(page);
  await assertTapTargets(page);
  await shot(page, "p10-mobile-contacts");

  await page.goto("/contacts/orgs");
  await assertNoHorizontalScroll(page);

  await page.goto("/inbox");
  await assertNoHorizontalScroll(page);

  await page.goto("/documents");
  await assertNoHorizontalScroll(page);

  await page.goto("/projects");
  const projectHref = await page.locator('a[href^="/projects/"]').first().getAttribute("href");
  if (projectHref !== null) {
    await page.goto(projectHref);
    await assertNoHorizontalScroll(page);
  }

  await page.goto("/insights");
  const dashboardHref = await page
    .locator('a[href^="/insights/dashboards/"]')
    .first()
    .getAttribute("href");
  await page.goto(dashboardHref ?? "/insights");
  await assertNoHorizontalScroll(page);

  // More opens the sheet with the remaining navigation items.
  await page.goto(boardUrl);
  await page.locator('[data-testid="bottom-nav-item"][data-href="more"]').click();
  await expect(page.getByTestId("more-sheet")).toBeVisible();
  // The sheet slides in from the right; wait for it to settle so the screenshot is not a slice.
  await page.waitForTimeout(500);
  await shot(page, "p10-mobile-more");
  await page.keyboard.press("Escape");

  // Settings > Profile shows the iOS Home Screen instructions in this context.
  await page.goto("/settings/profile");
  await expect(page.getByTestId("install-app")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("install-app").scrollIntoViewIfNeeded();
  await shot(page, "p10-install");

  // The calendar defaults to the day agenda on a phone.
  await page.goto("/activities/calendar");
  await expect(
    page.getByTestId("day-agenda").or(page.getByText("Nothing scheduled for this day.")).first(),
  ).toBeVisible({ timeout: 20_000 });
  await assertNoHorizontalScroll(page);

  return { deal: `/deals/${dealId}` };
}

test("PWA install, offline records, push capture and mobile layouts", async ({
  page,
  context,
  browser,
}) => {
  const { dealId, personId } = fixtures();
  rmSync(PUSH_DIR, { recursive: true, force: true });
  mkdirSync(PUSH_DIR, { recursive: true });
  await context.addInitScript(STUB_PUSH_MANAGER);
  await context.grantPermissions(["notifications"]);

  // 1. Manifest and service worker.
  await page.goto("/manifest.webmanifest");
  const manifest = JSON.parse(await page.locator("body").innerText()) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    background_color: string;
    theme_color: string;
    categories: string[];
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBe("Dealflow");
  expect(manifest.short_name).toBe("Dealflow");
  expect(manifest.start_url).toBe("/deals?source=pwa");
  expect(manifest.scope).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.background_color).toBe("#ffffff");
  expect(manifest.theme_color).toBe("#0f172a");
  expect(manifest.categories).toEqual(["business", "productivity"]);
  expect(manifest.icons.map((icon) => icon.sizes).sort()).toEqual(
    ["192x192", "512x512", "512x512"].sort(),
  );
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);

  await page.goto("/deals");
  await page.waitForLoadState("networkidle");
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 60_000,
  });

  // 2. Offline records: open a deal and a person, then cut the network and navigate.
  await page.goto(`/deals/${dealId}`);
  await expect(page.getByRole("main").first()).toBeVisible({ timeout: 30_000 });
  await waitForSnapshot(page, "deal");
  if (personId !== null) {
    await page.goto(`/contacts/people/${personId}`);
  } else {
    await page.goto("/contacts/people");
    const firstPerson = await page
      .locator('a[href^="/contacts/people/"]')
      .first()
      .getAttribute("href");
    if (firstPerson !== null) await page.goto(firstPerson);
  }
  // The snapshots are written after mount; poll the store itself (waitForFunction does not await
  // an async predicate, so a promise-returning check would pass immediately).
  await waitForSnapshot(page, "person");

  await context.setOffline(true);
  await page.goto("/deals").catch(() => undefined);
  await expect(page.getByTestId("offline-app")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("offline-record").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("offline-saved-at").first()).not.toBeEmpty();
  await shot(page, "p10-offline");

  await page.locator('[data-testid="offline-tab"][data-type="person"]').click();
  await expect(page.getByTestId("offline-record").first()).toBeVisible();
  await page.getByTestId("offline-record").first().click();
  await expect(page.getByText("Saved", { exact: false }).first()).toBeVisible();

  // The banner reflects the browser's online state. Playwright's setOffline flips
  // navigator.onLine; dispatching the events mirrors what the browser does on a real change.
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await page.goto("/deals");
  await expect(page).toHaveURL(/\/(deals|pipeline)/);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);

  // 3. Push: enable this device, then submit a public form so the admin receives a real
  // notification whose type is push-by-default.
  await page.goto("/settings/notifications");
  await expect(page.getByTestId("push-settings")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("push-enable").click();
  await expect(page.getByTestId("push-status")).toHaveText("Push is on for this device", {
    timeout: 30_000,
  });
  await shot(page, "p10-push-settings");

  const publicFormLink = await openFirstForm(page);
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(publicFormLink);
  await expect(visitorPage.getByTestId("public-form")).toBeVisible({ timeout: 30_000 });
  await visitorPage.waitForTimeout(2_500);
  await visitorPage
    .locator('[data-testid="public-form-field"][data-key="name"] input')
    .fill("P10 Push Visitor");
  await visitorPage
    .locator('[data-testid="public-form-field"][data-key="email"] input')
    .fill("p10.push@example.com");
  const messageField = visitorPage.locator(
    '[data-testid="public-form-field"][data-key="message"] textarea',
  );
  if ((await messageField.count()) > 0) await messageField.fill("Push capture check.");
  await visitorPage.getByTestId("public-form-submit").click();
  await expect(visitorPage.getByTestId("public-form-success")).toBeVisible({ timeout: 30_000 });
  await visitor.close();

  const captured = await waitForPushCapture("P10 push enquiry");
  expect(captured).toContain("push.invalid/e2e-device");

  // 4. Mobile layouts at 390x844 with touch.
  const mobile = await browser.newContext({
    storageState: ".e2e/admin.json",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE_UA,
  });
  await mobileScreenshots(mobile);
  await mobile.close();

  // 5. Create anywhere: n then d on an unrelated page opens the deal dialog in place.
  await page.goto("/insights");
  await page.keyboard.press("n");
  await page.keyboard.press("d");
  await expect(page.getByRole("dialog")).toContainText("Add deal", { timeout: 20_000 });
  await page.keyboard.press("Escape");

  // 6. Sign out wipes this device's offline records; a different user starts empty.
  await page.goto("/deals");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  await page.goto("/offline");
  await expect(page.getByText(/Nothing saved yet/).first()).toBeVisible({ timeout: 20_000 });

  await page.goto("/login");
  await page.getByRole("tab", { name: "Email link" }).click();
  await page.locator("#link-email").fill("demo2@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByTestId("login-sent")).toBeVisible({ timeout: 20_000 });
  const mail = latestMail("demo2@example.com");
  if (mail === null) throw new Error("no magic link for demo2");
  await page.goto(linkFrom(mail));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/pipeline/, { timeout: 30_000 });
  await page.goto("/offline");
  await expect(page.getByText(/Nothing saved yet/).first()).toBeVisible({ timeout: 20_000 });
});
