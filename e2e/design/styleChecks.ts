import { expect, type Page } from "@playwright/test";

// The 6.10 parity table, read from computed styles rather than from the class names. Every value
// comes from PLAN-PART11.md sections 6.4 to 6.8; a mismatch names the screen, the selector and
// both values so the failure is actionable without a screenshot.
interface Computed {
  backgroundColor: string;
  borderBottomColor: string;
  borderRadius: string;
  borderTopColor: string;
  boxShadow: string;
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  height: number;
  outlineColor: string;
  outlineStyle: string;
  outlineWidth: string;
  viewportHeight: number;
  width: number;
}

async function computed(page: Page, selector: string): Promise<Computed> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        backgroundColor: style.backgroundColor,
        borderBottomColor: style.borderBottomColor,
        borderRadius: style.borderRadius,
        borderTopColor: style.borderTopColor,
        boxShadow: style.boxShadow,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        height: Math.round(rect.height),
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        viewportHeight: window.innerHeight,
        width: Math.round(rect.width),
      };
    });
}

function px(value: string): number {
  return Number.parseFloat(value);
}

async function bodyCheck(page: Page): Promise<void> {
  const body = await computed(page, "body");
  // next/font/local names the family after the file ("inter"), so compare case-insensitively.
  expect(body.fontFamily, "body uses Inter").toMatch(/inter/i);
  expect(body.color, "body primary text").toBe("rgb(33, 35, 44)");
}

async function railCheck(page: Page): Promise<void> {
  const rail = await computed(page, '[data-testid="app-rail"]');
  expect(rail.backgroundColor, "rail fill").toBe("rgb(33, 28, 82)");
  expect(rail.height, "rail fills the viewport").toBe(rail.viewportHeight);
  // Part 12, 6.4: expanded by default, 56 px while collapsed, and back to 232 for the rest of the
  // screen (the cookie would otherwise leave every later gallery screen collapsed).
  expect(rail.width, "rail starts expanded").toBe(232);
  await page.getByTestId("rail-toggle").click();
  await expect
    .poll(async () => (await computed(page, '[data-testid="app-rail"]')).width, {
      message: "rail collapses to 56 px",
    })
    .toBe(56);
  await page.getByTestId("rail-toggle").click();
  await expect
    .poll(async () => (await computed(page, '[data-testid="app-rail"]')).width, {
      message: "rail expands again to 232 px",
    })
    .toBe(232);
}

async function activeRailTileCheck(page: Page): Promise<void> {
  const tile = await computed(page, '[data-testid="app-rail"] [aria-current="page"]');
  expect(tile.backgroundColor, "active rail tile").toBe("rgb(98, 80, 226)");
  expect(tile.width, "active rail tile width").toBe(44);
  expect(tile.height, "active rail tile height").toBe(44);
}

async function topBarCheck(page: Page): Promise<void> {
  const bar = await computed(page, '[data-testid="top-bar"]');
  expect(bar.height, "top bar height").toBe(56);
  expect(bar.borderBottomColor, "top bar border").toBe("rgb(232, 232, 232)");
}

async function pageTitleCheck(page: Page): Promise<void> {
  const title = await computed(page, '[data-testid="page-title"]');
  expect(title.fontSize, "top-bar title size").toBe("16px");
  expect(title.fontWeight, "top-bar title weight").toBe("600");
}

async function primaryButtonCheck(page: Page): Promise<void> {
  const button = await computed(page, '[data-testid="primary-action"]');
  expect(button.backgroundColor, "primary fill").toBe("rgb(45, 133, 72)");
  expect(button.height, "primary height").toBe(32);
  expect(px(button.borderRadius), "primary radius").toBe(4);
  expect(button.fontSize, "primary label size").toBe("14px");
  expect(button.fontWeight, "primary label weight").toBe("600");
}

async function searchPillCheck(page: Page): Promise<void> {
  const pill = await computed(page, '[data-testid="search-pill"]');
  expect(pill.height, "search pill height").toBe(40);
  expect(px(pill.borderRadius), "search pill radius").toBeGreaterThanOrEqual(20);
  expect(pill.borderTopColor, "search pill border").toBe("rgb(202, 202, 202)");
}

async function boardColumnCheck(page: Page): Promise<void> {
  const column = await computed(page, '[data-testid="board-column"]');
  expect(column.backgroundColor, "board column fill").toBe("rgb(245, 245, 245)");
  expect(column.width, "board column width").toBe(248);
}

async function dealCardCheck(page: Page): Promise<void> {
  const card = await computed(page, '[data-testid="deal-card"]');
  expect(px(card.borderRadius), "deal card radius").toBe(4);
  expect(card.borderTopColor, "deal card border").toBe("rgb(227, 227, 227)");
  expect(card.boxShadow, "deal card has no shadow").toBe("none");
}

async function cardTitleCheck(page: Page): Promise<void> {
  const title = await computed(page, '[data-testid="deal-card-title"]');
  expect(title.fontSize, "card title size").toBe("14px");
  expect(title.fontWeight, "card title weight").toBe("600");
}

async function stageTrackCheck(page: Page): Promise<void> {
  // The seeded deal can sit in the first stage, so there may be no passed segment; the current
  // one carries the same green token.
  const current = await computed(page, '[data-testid="stage-track"] [data-state="current"]');
  expect(current.height, "stage track height").toBe(24);
  expect(current.backgroundColor, "current stage fill").toBe("rgb(45, 133, 72)");
  const future = await computed(page, '[data-testid="stage-track"] [data-state="future"]');
  expect(future.backgroundColor, "future stage fill").toBe("rgb(228, 228, 228)");
}

async function dealSidebarCheck(page: Page): Promise<void> {
  const sidebar = await computed(page, '[data-testid="deal-sidebar"]');
  expect(sidebar.width, "deal sidebar width").toBe(400);
  const row = await computed(page, '[data-testid="deal-sidebar"] [data-testid="sidebar-row"]');
  expect(row.height, "sidebar row height").toBe(64);
}

async function dealTitleCheck(page: Page): Promise<void> {
  const title = await computed(page, '[data-testid="deal-title"]');
  expect(title.fontSize, "deal title size").toBe("24px");
  expect(title.fontWeight, "deal title weight").toBe("400");
}

async function activitySideCheck(page: Page): Promise<void> {
  const side = await computed(page, '[data-testid="activity-side"]');
  expect(side.backgroundColor, "activity side fill").toBe("rgb(245, 245, 245)");
}

async function tableRowCheck(page: Page): Promise<void> {
  const row = await computed(page, '[data-testid="table-row"]');
  expect(row.height, "table row height").toBe(33);
}

async function tableHeaderCheck(page: Page): Promise<void> {
  const header = await computed(page, "th");
  expect(header.fontSize, "table header size").toBe("14px");
  expect(header.fontWeight, "table header weight").toBe("600");
}

async function recordLinkCheck(page: Page): Promise<void> {
  const link = await computed(page, '[data-testid="table-row"] a');
  expect(link.color, "record link colour").toBe("rgb(1, 119, 55)");
}

async function focusCheck(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (element === null) return null;
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  expect(outline?.style, "focus ring style").toBe("solid");
  expect(outline?.width, "focus ring width").toBe("2px");
  expect(outline?.color, "focus ring colour").toBe("rgb(17, 104, 201)");
}

// Settings has no rail destination by design (6.7 moves it into the avatar menu), so the active
// tile is checked on the screens that do have one.
const COMMON = [bodyCheck, railCheck, topBarCheck, pageTitleCheck];

const BY_SCREEN: Record<string, Array<(page: Page) => Promise<void>>> = {
  board: [
    ...COMMON,
    activeRailTileCheck,
    primaryButtonCheck,
    searchPillCheck,
    boardColumnCheck,
    dealCardCheck,
    cardTitleCheck,
    focusCheck,
  ],
  deal: [
    ...COMMON,
    stageTrackCheck,
    dealSidebarCheck,
    dealTitleCheck,
    activitySideCheck,
    focusCheck,
  ],
  "activities-list": [
    ...COMMON,
    activeRailTileCheck,
    tableRowCheck,
    tableHeaderCheck,
    recordLinkCheck,
    focusCheck,
  ],
  "settings-profile": [...COMMON, focusCheck],
};

export async function runStyleChecks(page: Page, screen: string): Promise<void> {
  const checks = BY_SCREEN[screen];
  if (checks === undefined) return;
  for (const check of checks) await check(page);
}
