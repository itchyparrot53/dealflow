import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { deals, dealTerms, stageProbabilities } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { listChangeLog } from "@/features/collaboration/changeLog";
import { saveRate } from "@/features/currency/rates";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb } from "@/test/db";
import { getForecast, moveDealToMonth } from "./forecast";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let outsider: PermSetUser;
let adminId: string;
let outsiderId: string;
let pipelineId: string;
let stageId: string;

const sig = (): AbortSignal => AbortSignal.timeout(10_000);

beforeAll(async () => {
  h = await makeTestDb();
  const adminRow = await seedUser(h.db, { isAdmin: true });
  const outsiderRow = await seedUser(h.db);
  adminId = adminRow.id;
  outsiderId = outsiderRow.id;
  admin = { id: adminId, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
  outsider = {
    id: outsiderId,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Propose"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
  await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());
  await h.db.insert(stageProbabilities).values({ stageId, probability: 50 });
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(async () => {
  await h.db.delete(dealTerms);
  await h.db.delete(deals);
});

async function addDeal(
  over: Partial<typeof deals.$inferInsert> = {},
): Promise<typeof deals.$inferSelect> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Deal",
      pipelineId,
      stageId,
      ownerId: adminId,
      visibilityLevel: "all",
      boardPosition: "0",
      ...over,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "forecast seed failed");
  return row;
}

describe("getForecast", () => {
  it("buckets open deals by month, pulls overdue ones into the first month and totals in base", async () => {
    await addDeal({
      title: "Overdue",
      value: "200.00",
      expectedCloseDate: "2026-12-15",
      boardPosition: "0",
    });
    await addDeal({
      title: "February USD",
      value: "100.00",
      expectedCloseDate: "2027-02-10",
      boardPosition: "1",
    });
    const eur = await addDeal({
      title: "February EUR",
      value: "100.00",
      expectedCloseDate: "2027-02-11",
      boardPosition: "2",
    });
    await h.db.insert(dealTerms).values({ dealId: eur.id, currency: "EUR", probability: 100 });
    await addDeal({
      title: "Too late",
      value: "400.00",
      expectedCloseDate: "2027-05-01",
      boardPosition: "3",
    });
    await addDeal({ title: "Undated", value: "50.00", boardPosition: "4" });
    const jpy = await addDeal({
      title: "Yen",
      value: "500.00",
      expectedCloseDate: "2027-03-05",
      boardPosition: "5",
    });
    await h.db.insert(dealTerms).values({ dealId: jpy.id, currency: "JPY", probability: 100 });
    await addDeal({
      title: "Won in Feb",
      value: "300.00",
      status: "won",
      expectedCloseDate: "2027-02-01",
      wonTime: new Date("2027-02-20T10:00:00Z"),
      boardPosition: "6",
    });

    const result = await getForecast(h.db, admin, { startMonth: "2027-01", months: 3 }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [january, february, march] = result.value.months;
    expect(result.value.months.map((m) => m.month)).toEqual(["2027-01", "2027-02", "2027-03"]);
    expect(january?.open.map((d) => d.title)).toEqual(["Overdue"]);
    expect(january?.open[0]?.overdue).toBe(true);
    expect(january?.total).toBe("200.00");

    expect(february?.open.map((d) => d.title)).toEqual(["February USD", "February EUR"]);
    expect(february?.total).toBe("208.00");
    expect(february?.weighted).toBe("158.00");
    expect(february?.won.map((d) => d.title)).toEqual(["Won in Feb"]);
    expect(february?.wonTotal).toBe("300.00");

    expect(march?.excluded.map((d) => d.title)).toEqual(["Yen"]);
    expect(march?.total).toBe("0.00");

    expect(result.value.noDateCount).toBe(1);
    expect(result.value.noDate[0]?.title).toBe("Undated");
  });

  it("omits won deals when includeWon is false", async () => {
    await addDeal({
      title: "Won in Feb",
      value: "300.00",
      status: "won",
      wonTime: new Date("2027-02-20T10:00:00Z"),
      boardPosition: "0",
    });
    const result = await getForecast(
      h.db,
      admin,
      { startMonth: "2027-01", months: 3, includeWon: false },
      sig(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.months[1]?.won).toEqual([]);
    expect(result.value.months[1]?.wonTotal).toBe("0.00");
  });

  it("applies the pipeline filter", async () => {
    const other = await seedPipelineWithStages(h.db, ["Other"]);
    await addDeal({
      title: "Other pipeline",
      value: "10.00",
      expectedCloseDate: "2027-02-01",
      pipelineId: other.pipeline.id,
      stageId: other.stages[0]?.id ?? "",
      boardPosition: "0",
    });
    const result = await getForecast(
      h.db,
      admin,
      { startMonth: "2027-01", months: 3, pipelineId },
      sig(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.months[1]?.open).toEqual([]);
  });

  it("hides a deal the viewer may not see", async () => {
    const hidden = await addDeal({
      title: "Someone else's",
      value: "10.00",
      expectedCloseDate: "2027-02-01",
      visibilityLevel: "owner",
      ownerId: adminId,
      boardPosition: "0",
    });
    const result = await getForecast(h.db, outsider, { startMonth: "2027-01", months: 3 }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.months.flatMap((m) => m.open.map((d) => d.id));
    expect(ids).not.toContain(hidden.id);
  });
});

describe("moveDealToMonth", () => {
  it("clamps Jan 31 to the target month's last day and logs the close-date change", async () => {
    const deal = await addDeal({
      title: "Month end",
      value: "10.00",
      expectedCloseDate: "2027-01-31",
      boardPosition: "0",
    });
    const result = await moveDealToMonth(h.db, admin, { dealId: deal.id, month: "2027-02" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.expectedCloseDate).toBe("2027-02-28");
    const [reloaded] = await h.db.select().from(deals).where(eq(deals.id, deal.id));
    expect(reloaded?.expectedCloseDate).toBe("2027-02-28");
    const history = await listChangeLog(h.db, "deal", deal.id, sig());
    const change = history.find((entry) => entry.field === "expected_close_date");
    expect(change?.oldValue).toBe("2027-01-31");
    expect(change?.newValue).toBe("2027-02-28");
  });

  it("defaults an undated deal to the 15th", async () => {
    const deal = await addDeal({ title: "No date", value: "10.00", boardPosition: "0" });
    const result = await moveDealToMonth(h.db, admin, { dealId: deal.id, month: "2027-04" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.expectedCloseDate).toBe("2027-04-15");
  });

  it("refuses to move a won deal", async () => {
    const deal = await addDeal({
      title: "Won",
      value: "10.00",
      status: "won",
      wonTime: new Date("2027-01-05T00:00:00Z"),
      boardPosition: "0",
    });
    const result = await moveDealToMonth(h.db, admin, { dealId: deal.id, month: "2027-02" }, sig());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.id).toBe(ERROR_IDS.DEAL_PRECONDITION);
  });
});
