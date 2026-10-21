import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { deals, dealTerms, stageProbabilities, userPreferences } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { saveRate } from "@/features/currency/rates";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import type { DealReportDefinition, ReportDefinition } from "./definition";
import { runReport } from "./run";

let h: TestDb;
let admin: PermSetUser;
let viewer: PermSetUser;
let otherOwnerId: string;
let viewerId: string;
let pipelineId: string;
let leadStageId: string;
let proposeStageId: string;

const sig = (): AbortSignal => AbortSignal.timeout(20_000);

beforeAll(async () => {
  h = await makeTestDb();
  const adminRow = await seedUser(h.db, { isAdmin: true, name: "Ada Admin" });
  const viewerRow = await seedUser(h.db, { name: "Vic Viewer" });
  const otherRow = await seedUser(h.db, { name: "Otto Other" });
  admin = { id: adminRow.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
  viewer = {
    id: viewerRow.id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
  viewerId = viewerRow.id;
  otherOwnerId = otherRow.id;
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Propose", "Won"]);
  pipelineId = seeded.pipeline.id;
  leadStageId = seeded.stages[0]?.id ?? "";
  proposeStageId = seeded.stages[1]?.id ?? "";
  await saveRate(h.db, admin, { code: "EUR", rate: "1.08" }, sig());
  await h.db.insert(stageProbabilities).values({ stageId: leadStageId, probability: 50 });
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(async () => {
  await h.db.delete(dealTerms);
  await h.db.delete(deals);
});

async function addDeal(over: Partial<typeof deals.$inferInsert> = {}): Promise<string> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Deal",
      pipelineId,
      stageId: leadStageId,
      ownerId: admin.id,
      visibilityLevel: "all",
      ...over,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "deal seed failed");
  return row.id;
}

function def(over: Partial<DealReportDefinition> = {}): DealReportDefinition {
  return {
    entity: "deal",
    measure: { kind: "count" },
    groupBy: null,
    segmentBy: null,
    dateRange: { field: "created_at", preset: "all_time" },
    filter: null,
    chart: "table",
    ...over,
  };
}

async function run(actor: PermSetUser, definition: ReportDefinition, timeoutMs?: number) {
  const result = await runReport(h.db, actor, definition, sig(), {
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  if (!result.ok) throw new Error(`report failed: ${result.error.id}`);
  return result.value;
}

describe("deal reports", () => {
  it("counts deals by stage", async () => {
    await addDeal({ title: "A", stageId: leadStageId });
    await addDeal({ title: "B", stageId: leadStageId });
    await addDeal({ title: "C", stageId: proposeStageId, status: "open" });

    const out = await run(admin, def({ groupBy: { field: "stage" } }));
    expect(out.rows.map((r) => [r.gLabel, r.count, r.value])).toEqual([
      ["Lead", 2, "2"],
      ["Propose", 1, "1"],
    ]);
    expect(out.total).toEqual({ value: "3", count: 3 });
    expect(out.baseCurrency).toBe("USD");
    expect(out.truncated).toBe(false);
    expect(out.generatedAt).toBeTypeOf("string");
  });

  it("converts won value to base by month, fills empty months and lists the excluded currency", async () => {
    const eur = await addDeal({
      title: "EUR won",
      status: "won",
      value: "100.00",
      wonTime: new Date("2026-02-10T10:00:00Z"),
    });
    await h.db.insert(dealTerms).values({ dealId: eur, currency: "EUR", probability: 100 });
    await addDeal({
      title: "USD won",
      status: "won",
      value: "50.00",
      wonTime: new Date("2026-02-15T10:00:00Z"),
    });
    const jpy = await addDeal({
      title: "JPY won",
      status: "won",
      value: "500.00",
      wonTime: new Date("2026-03-05T10:00:00Z"),
    });
    await h.db.insert(dealTerms).values({ dealId: jpy, currency: "JPY", probability: 100 });

    const out = await run(
      admin,
      def({
        measure: { kind: "sum_value" },
        groupBy: { field: "won_at", interval: "month" },
        dateRange: { field: "won_at", preset: "custom", from: "2026-01-01", to: "2026-04-30" },
        chart: "bar",
      }),
    );

    expect(out.rows.map((r) => [r.g, r.gLabel, r.value, r.count])).toEqual([
      ["2026-01", "Jan 2026", "0.00", 0],
      ["2026-02", "Feb 2026", "158.00", 2],
      ["2026-03", "Mar 2026", "0.00", 0],
      ["2026-04", "Apr 2026", "0.00", 0],
    ]);
    expect(out.total).toEqual({ value: "158.00", count: 2 });
    expect(out.excluded).toEqual([{ currency: "JPY", count: 1 }]);
  });

  it("averages after conversion over counted deals only", async () => {
    await addDeal({ title: "Low", value: "100.00" });
    await addDeal({ title: "High", value: "300.00" });
    const jpy = await addDeal({ title: "Yen", value: "500.00" });
    await h.db.insert(dealTerms).values({ dealId: jpy, currency: "JPY", probability: 100 });

    const out = await run(admin, def({ measure: { kind: "avg_value" } }));
    expect(out.total).toEqual({ value: "200.00", count: 2 });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]?.value).toBe("200.00");
    expect(out.excluded).toEqual([{ currency: "JPY", count: 1 }]);
  });

  it("weights by override, then stage probability, then 100", async () => {
    await addDeal({ title: "Stage probability", stageId: leadStageId, value: "100.00" });
    await addDeal({ title: "No probability", stageId: proposeStageId, value: "100.00" });
    const override = await addDeal({
      title: "Override",
      stageId: leadStageId,
      value: "100.00",
    });
    await h.db.insert(dealTerms).values({ dealId: override, currency: "USD", probability: 20 });

    const out = await run(admin, def({ measure: { kind: "weighted_value" } }));
    expect(out.total).toEqual({ value: "170.00", count: 3 });
  });

  it("stacks segments by status", async () => {
    await addDeal({ title: "Open one", stageId: proposeStageId });
    await addDeal({ title: "Open two", stageId: proposeStageId });
    await addDeal({
      title: "Won one",
      stageId: proposeStageId,
      status: "won",
      wonTime: new Date("2026-02-01T10:00:00Z"),
    });

    const out = await run(
      admin,
      def({
        groupBy: { field: "stage" },
        segmentBy: { field: "status" },
        chart: "stacked_bar",
      }),
    );
    expect(out.rows.map((r) => [r.gLabel, r.s, r.sLabel, r.count])).toEqual([
      ["Propose", "open", "Open", 2],
      ["Propose", "won", "Won", 1],
    ]);
    expect(out.total.count).toBe(3);
  });

  it("rolls the 51st and later groups into Other", async () => {
    const many = await seedPipelineWithStages(
      h.db,
      Array.from({ length: 55 }, (_, index) => `Stage ${index + 1}`),
    );
    for (const stage of many.stages) {
      await addDeal({
        title: `Deal ${stage.order}`,
        pipelineId: many.pipeline.id,
        stageId: stage.id,
      });
    }

    const out = await run(admin, def({ groupBy: { field: "stage" } }));
    expect(out.rows).toHaveLength(51);
    const other = out.rows.find((row) => row.g === "__other");
    expect(other?.gLabel).toBe("Other");
    expect(other?.count).toBe(5);
    expect(out.total.count).toBe(55);
    expect(out.truncated).toBe(true);
  });

  it("rolls the 13th and later segments into Other", async () => {
    for (let index = 0; index < 15; index += 1) {
      const owner = await seedUser(h.db, { name: `Owner ${index + 1}` });
      await addDeal({ title: `Deal ${index + 1}`, stageId: proposeStageId, ownerId: owner.id });
    }

    const out = await run(
      admin,
      def({ groupBy: { field: "stage" }, segmentBy: { field: "owner" } }),
    );
    expect(out.rows).toHaveLength(13);
    const other = out.rows.find((row) => row.s === "__other");
    expect(other?.sLabel).toBe("Other");
    expect(other?.count).toBe(3);
    expect(out.total.count).toBe(15);
    expect(out.truncated).toBe(true);
  });

  it("buckets a deal in the viewer's time zone and fills both months", async () => {
    await addDeal({ title: "Late October", createdAt: new Date("2026-10-31T23:30:00Z") });
    await h.db
      .insert(userPreferences)
      .values({ userId: viewerId, timezone: "Asia/Tokyo" })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { timezone: "Asia/Tokyo" } });

    const definition = def({
      groupBy: { field: "created_at", interval: "month" },
      dateRange: {
        field: "created_at",
        preset: "custom",
        from: "2026-10-01",
        to: "2026-11-30",
      },
      chart: "bar",
    });

    const tokyo = await run(viewer, definition);
    expect(tokyo.rows.map((r) => [r.g, r.count])).toEqual([
      ["2026-10", 0],
      ["2026-11", 1],
    ]);

    const utc = await run(admin, definition);
    expect(utc.rows.map((r) => [r.g, r.count])).toEqual([
      ["2026-10", 1],
      ["2026-11", 0],
    ]);
  });

  it("hides another owner's private deal from a regular viewer but not from an admin", async () => {
    await addDeal({ title: "Mine", ownerId: viewerId, value: "10.00" });
    await addDeal({
      title: "Theirs",
      ownerId: otherOwnerId,
      visibilityLevel: "owner",
      value: "20.00",
    });

    const mine = await run(viewer, def({ measure: { kind: "sum_value" } }));
    expect(mine.total).toEqual({ value: "10.00", count: 1 });
    expect(mine.rows.map((r) => r.count)).toEqual([1]);

    const everything = await run(admin, def({ measure: { kind: "sum_value" } }));
    expect(everything.total).toEqual({ value: "30.00", count: 2 });
  });

  it("narrows rows with a saved-filter AST", async () => {
    await addDeal({ title: "Open one", status: "open" });
    await addDeal({ title: "Open two", status: "open" });
    await addDeal({
      title: "Won",
      status: "won",
      wonTime: new Date("2026-02-01T10:00:00Z"),
    });

    const out = await run(
      admin,
      def({
        filter: { combinator: "and", conditions: [{ field: "status", op: "eq", value: "open" }] },
      }),
    );
    expect(out.total.count).toBe(2);
  });

  it("maps a statement timeout to E_INSIGHT_003", async () => {
    // A few thousand rows make the grouped query take longer than the 1 ms budget every run.
    await h.db.insert(deals).values(
      Array.from({ length: 3_000 }, (_, index) => ({
        title: `Timeout ${index}`,
        pipelineId,
        stageId: leadStageId,
        ownerId: admin.id,
        visibilityLevel: "all" as const,
      })),
    );
    const result = await runReport(h.db, admin, def(), sig(), { timeoutMs: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.INSIGHT_QUERY_TIMEOUT);
  });

  it("labels a missing group value as None", async () => {
    await addDeal({ title: "No source", sourceChannel: null });
    const out = await run(admin, def({ groupBy: { field: "source_channel" } }));
    expect(out.rows[0]?.gLabel).toBe("None");
  });
});
