import { eq, inArray, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as exportCsv } from "@/app/(app)/insights/reports/[id]/export.csv/route";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  activities,
  activityTypes,
  aiSettings,
  aiUsage,
  dashboards,
  dashboardWidgets,
  dealAiInsights,
  deals,
  dealTerms,
  notifications,
  reports,
  stageProbabilities,
  userPreferences,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { updateAiSettings } from "@/features/ai/aiSettings";
import { bulkScoreDeals } from "@/features/ai/bulkScore";
import { runBulkScoreJob } from "@/features/ai/bulkScoreJob";
import { fakeProvider } from "@/features/ai/fakeProvider";
import { setAiProviderForTest } from "@/features/ai/provider";
import { ScriptedAiProvider } from "@/features/ai/scriptedProvider";
import { saveRate } from "@/features/currency/rates";
import { getBoardColumns } from "@/features/deals/dealRepo";
import type { PermSetUser } from "@/features/permissions/effective";
import { EVERYONE } from "@/features/stats/ownerIds";
import { stageConversion } from "@/features/stats/stageConversion";
import { setBoss } from "@/jobs/boss";
import { makeTestDb, type TestDb } from "@/test/db";
import { addWidget, createDashboard, getDashboard } from "./dashboards";
import { ensureDefaultDashboard } from "./defaultDashboard";
import type {
  ActivityReportDefinition,
  DealReportDefinition,
  ReportDefinition,
} from "./definition";
import { explainReport } from "./explain";
import { createReport, deleteReport, getReport, listReports, updateReport } from "./reports";
import { runReport } from "./run";

// The export route binds the app pool and the request context when imported, so the tests point
// both at their own database and actor. Nothing about the database itself is mocked.
let currentActor: PermSetUser | null = null;
vi.mock("@/server/trpc/context", () => ({
  createContext: () => Promise.resolve({ actor: currentActor, session: { id: "test-session" } }),
}));
vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

let h: TestDb;
let admin: PermSetUser;
let viewer: PermSetUser;
let otherOwnerId: string;
let viewerId: string;
let pipelineId: string;
let callTypeId: string;
let meetingTypeId: string;
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
  const [callType] = await h.db
    .insert(activityTypes)
    .values({ key: `call-${Date.now()}`, name: "Call", order: 10 })
    .returning();
  const [meetingType] = await h.db
    .insert(activityTypes)
    .values({ key: `meeting-${Date.now()}`, name: "Meeting", order: 11 })
    .returning();
  if (callType === undefined || meetingType === undefined) {
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "activity type seed failed");
  }
  callTypeId = callType.id;
  meetingTypeId = meetingType.id;
}, 60_000);

afterAll(async () => {
  await h.close();
});

beforeEach(async () => {
  await h.db.delete(notifications);
  await h.db.delete(aiUsage);
  await h.db.delete(aiSettings);
  await h.db.delete(dashboardWidgets);
  await h.db.delete(dashboards);
  await h.db.delete(reports);
  await h.db.delete(activities);
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

async function addActivity(over: Partial<typeof activities.$inferInsert> = {}): Promise<string> {
  const [row] = await h.db
    .insert(activities)
    .values({
      typeId: callTypeId,
      subject: "Activity",
      ownerId: admin.id,
      assigneeId: admin.id,
      ...over,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "activity seed failed");
  return row.id;
}

function activityDef(over: Partial<ActivityReportDefinition> = {}): ActivityReportDefinition {
  return {
    entity: "activity",
    measure: { kind: "count" },
    groupBy: null,
    segmentBy: null,
    dateRange: { field: "due_at", preset: "all_time" },
    filter: null,
    chart: "table",
    ...over,
  };
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

  it("leaves deals without the grouped date out instead of rolling them into Other", async () => {
    await addDeal({ title: "Still open" });
    await addDeal({
      title: "Won",
      status: "won",
      value: "10.00",
      wonTime: new Date("2026-02-10T10:00:00Z"),
    });

    const out = await run(
      admin,
      def({ measure: { kind: "sum_value" }, groupBy: { field: "won_at", interval: "month" } }),
    );
    expect(out.rows.map((row) => row.g)).toEqual(["2026-02"]);
    expect(out.total.count).toBe(1);
  });

  it("labels a missing group value as None", async () => {
    await addDeal({ title: "No source", sourceChannel: null });
    const out = await run(admin, def({ groupBy: { field: "source_channel" } }));
    expect(out.rows[0]?.gLabel).toBe("None");
  });

  it("counts activities by type and buckets them by ISO week", async () => {
    await addActivity({ typeId: callTypeId, dueAt: new Date("2026-10-21T10:00:00Z") });
    await addActivity({ typeId: callTypeId, dueAt: new Date("2026-10-22T10:00:00Z") });
    await addActivity({ typeId: meetingTypeId, dueAt: new Date("2026-10-28T10:00:00Z") });

    const byType = await run(admin, activityDef({ groupBy: { field: "activity_type" } }));
    expect(byType.rows.map((row) => [row.gLabel, row.count])).toEqual([
      ["Call", 2],
      ["Meeting", 1],
    ]);
    expect(byType.total.count).toBe(3);

    const byWeek = await run(
      admin,
      activityDef({
        groupBy: { field: "due_at", interval: "week" },
        dateRange: { field: "due_at", preset: "custom", from: "2026-10-19", to: "2026-10-30" },
        chart: "line",
      }),
    );
    expect(byWeek.rows.map((row) => [row.g, row.gLabel, row.count])).toEqual([
      ["2026-W43", "Week 43, 2026", 2],
      ["2026-W44", "Week 44, 2026", 1],
    ]);
  });

  it("sums activity duration in minutes", async () => {
    await addActivity({ durationMinutes: 30, dueAt: new Date("2026-10-21T09:00:00Z") });
    await addActivity({ durationMinutes: 45, dueAt: new Date("2026-10-21T10:00:00Z") });
    await addActivity({ durationMinutes: null, dueAt: new Date("2026-10-21T11:00:00Z") });

    const out = await run(admin, activityDef({ measure: { kind: "sum_duration" } }));
    expect(out.total).toEqual({ value: "75", count: 3 });
    expect(out.rows[0]?.value).toBe("75");
  });

  it("applies the activity done filter", async () => {
    await addActivity({ done: true, dueAt: new Date("2026-10-21T09:00:00Z") });
    await addActivity({ done: true, dueAt: new Date("2026-10-21T10:00:00Z") });
    await addActivity({ done: false, dueAt: new Date("2026-10-21T11:00:00Z") });

    const out = await run(admin, activityDef({ filter: { done: true } }));
    expect(out.total.count).toBe(2);
  });

  it("hides a parentless activity assigned to someone else", async () => {
    const other = await seedUser(h.db, { name: "Otto Other" });
    await addActivity({ assigneeId: viewerId, dueAt: new Date("2026-10-21T09:00:00Z") });
    await addActivity({
      assigneeId: other.id,
      ownerId: other.id,
      dueAt: new Date("2026-10-21T10:00:00Z"),
    });

    const mine = await run(viewer, activityDef());
    expect(mine.total.count).toBe(1);

    const everything = await run(admin, activityDef());
    expect(everything.total.count).toBe(2);
  });

  it("leaves activities without the grouped date out", async () => {
    await addActivity({ done: true, doneAt: new Date("2026-02-10T10:00:00Z") });
    await addActivity({ done: false, doneAt: null });

    const out = await run(admin, activityDef({ groupBy: { field: "done_at", interval: "month" } }));
    expect(out.rows.map((row) => row.g)).toEqual(["2026-02"]);
    expect(out.rows.some((row) => row.g === "__other")).toBe(false);
  });

  it("matches the stats stage conversion for the same pipeline and range", async () => {
    const funnelPipeline = await seedPipelineWithStages(h.db, ["First", "Second", "Third"]);
    const first = funnelPipeline.stages[0]?.id ?? "";
    const second = funnelPipeline.stages[1]?.id ?? "";
    await addDeal({
      title: "First",
      pipelineId: funnelPipeline.pipeline.id,
      stageId: first,
      createdAt: new Date("2026-03-01T10:00:00Z"),
    });
    await addDeal({
      title: "Second A",
      pipelineId: funnelPipeline.pipeline.id,
      stageId: second,
      createdAt: new Date("2026-04-01T10:00:00Z"),
    });
    await addDeal({
      title: "Second B",
      pipelineId: funnelPipeline.pipeline.id,
      stageId: second,
      createdAt: new Date("2026-05-01T10:00:00Z"),
    });

    const result = await run(
      admin,
      def({
        chart: "funnel",
        funnelPipelineId: funnelPipeline.pipeline.id,
        dateRange: { field: "created_at", preset: "custom", from: "2026-01-01", to: "2026-06-30" },
      }),
    );
    expect(result.funnel?.map((stage) => [stage.name, stage.reached])).toEqual([
      ["First", 3],
      ["Second", 2],
      ["Third", 0],
    ]);
    expect(result.rows.map((row) => [row.gLabel, row.count])).toEqual([
      ["First", 3],
      ["Second", 2],
      ["Third", 0],
    ]);

    const direct = await stageConversion(
      h.db,
      admin,
      {
        pipelineId: funnelPipeline.pipeline.id,
        owners: EVERYONE,
        from: "2026-01-01",
        to: "2026-06-30",
      },
      sig(),
    );
    expect(result.funnel?.map((stage) => [stage.stageId, stage.reached, stage.conversion])).toEqual(
      direct.map((stage) => [stage.stageId, stage.reached, stage.conversion]),
    );
  });

  describe("reports and dashboards services", () => {
    function otherActor(): PermSetUser {
      return {
        id: otherOwnerId,
        type: "regular",
        isActive: true,
        groupIds: new Set(),
        flags: new Set(),
      };
    }

    it("lets only the owner or an admin edit or delete a report", async () => {
      const created = await createReport(
        h.db,
        viewer,
        { name: "Vic report", definition: def() },
        sig(),
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const denied = await updateReport(
        h.db,
        otherActor(),
        created.value.id,
        { name: "Hijack" },
        sig(),
      );
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.id).toBe(ERROR_IDS.INSIGHT_FORBIDDEN);

      const deleted = await deleteReport(h.db, otherActor(), created.value.id, sig());
      expect(deleted.ok).toBe(false);
      if (!deleted.ok) expect(deleted.error.id).toBe(ERROR_IDS.INSIGHT_FORBIDDEN);

      const hidden = await getReport(h.db, otherActor(), created.value.id, sig());
      expect(hidden.ok).toBe(false);
      if (!hidden.ok) expect(hidden.error.id).toBe(ERROR_IDS.INSIGHT_NOT_FOUND);

      const byAdmin = await updateReport(h.db, admin, created.value.id, { name: "Renamed" }, sig());
      expect(byAdmin.ok).toBe(true);
      if (byAdmin.ok) expect(byAdmin.value.name).toBe("Renamed");
    });

    it("lists a shared report for another user but not a private one", async () => {
      const shared = await createReport(
        h.db,
        viewer,
        { name: "Shared report", definition: def(), shared: true },
        sig(),
      );
      const priv = await createReport(
        h.db,
        viewer,
        { name: "Private report", definition: def() },
        sig(),
      );
      expect(shared.ok && priv.ok).toBe(true);

      const names = (await listReports(h.db, otherActor(), sig())).map((report) => report.name);
      expect(names).toContain("Shared report");
      expect(names).not.toContain("Private report");
    });

    it("omits a dashboard widget whose report the viewer cannot read", async () => {
      const report = await createReport(
        h.db,
        viewer,
        { name: "Vic private", definition: def() },
        sig(),
      );
      const dashboard = await createDashboard(
        h.db,
        viewer,
        { name: "Vic board", shared: true },
        sig(),
      );
      expect(report.ok && dashboard.ok).toBe(true);
      if (!report.ok || !dashboard.ok) return;

      const added = await addWidget(
        h.db,
        viewer,
        dashboard.value.id,
        { kind: "report", reportId: report.value.id },
        sig(),
      );
      expect(added.ok).toBe(true);

      const asOther = await getDashboard(h.db, otherActor(), dashboard.value.id, sig());
      expect(asOther.ok).toBe(true);
      if (asOther.ok) expect(asOther.value.widgets).toHaveLength(0);

      const asOwner = await getDashboard(h.db, viewer, dashboard.value.id, sig());
      expect(asOwner.ok).toBe(true);
      if (asOwner.ok) expect(asOwner.value.widgets).toHaveLength(1);

      const denied = await addWidget(
        h.db,
        otherActor(),
        dashboard.value.id,
        { kind: "report", reportId: report.value.id },
        sig(),
      );
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.id).toBe(ERROR_IDS.INSIGHT_FORBIDDEN);
    });

    it("creates the default dashboard once under two concurrent calls", async () => {
      await h.db.execute(sql`select 1`);
      const [first, second] = await Promise.all([
        ensureDefaultDashboard(h.db, sig()),
        ensureDefaultDashboard(h.db, sig()),
      ]);
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.value.id).toBe(second.value.id);

      const defaults = await h.db.select().from(dashboards).where(eq(dashboards.isDefault, true));
      expect(defaults).toHaveLength(1);
      expect(defaults[0]?.name).toBe("Sales overview");
      expect(defaults[0]?.shared).toBe(true);

      const widgets = await h.db
        .select()
        .from(dashboardWidgets)
        .where(eq(dashboardWidgets.dashboardId, first.value.id));
      expect(widgets).toHaveLength(6);
      const reportRows = await h.db.select().from(reports);
      expect(reportRows).toHaveLength(6);
      expect(reportRows.every((row) => row.shared)).toBe(true);
    });

    it("exports CSV from the saved report route with the formula guard applied", async () => {
      const pipeline = await seedPipelineWithStages(h.db, ["=SUM(A1)", "Won"]);
      await addDeal({
        title: "Guarded",
        pipelineId: pipeline.pipeline.id,
        stageId: pipeline.stages[0]?.id ?? "",
      });
      const created = await createReport(
        h.db,
        admin,
        { name: "Stage, export", definition: def({ groupBy: { field: "stage" } }) },
        sig(),
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      currentActor = admin;
      const response = await exportCsv(
        new NextRequest(`http://localhost/insights/reports/${created.value.id}/export.csv`),
        { params: Promise.resolve({ id: created.value.id }) },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/csv");
      expect(response.headers.get("content-disposition")).toContain("stage-export-");

      const body = await response.text();
      const lines = body.split("\r\n");
      // The shared RFC 4180 writer quotes only when needed; the formula guard remains.
      expect(lines[0]).toBe("Group,Segment,Count,Value");
      expect(body).toContain("'=SUM(A1)");
      currentActor = null;
    });
  });

  describe("explain and bulk scoring", () => {
    const scoreReply = { content: JSON.stringify({ score: 72, reasons: ["engaged", "soon"] }) };

    function sessionFor(actor: PermSetUser) {
      return {
        userId: actor.id,
        isAdmin: actor.type === "admin",
        isActive: actor.isActive,
        sessionLive: true,
        visibilityGroupIds: Array.from(actor.groupIds),
        managedUserIds: Array.from(actor.managedUserIds ?? []),
      };
    }

    function fakeBoss(): { boss: PgBoss; sends: { name: string; data: unknown }[] } {
      const sends: { name: string; data: unknown }[] = [];
      const boss = {
        send(name: string, data: unknown) {
          sends.push({ name, data });
          return Promise.resolve();
        },
      } as unknown as PgBoss;
      return { boss, sends };
    }

    it("returns three deterministic insights with the fake provider", async () => {
      await addDeal({
        title: "Won one",
        status: "won",
        value: "100.00",
        wonTime: new Date("2026-02-01T10:00:00Z"),
      });
      const report = await createReport(
        h.db,
        admin,
        { name: "Explain me", definition: def({ measure: { kind: "sum_value" } }) },
        sig(),
      );
      expect(report.ok).toBe(true);
      if (!report.ok) return;

      setAiProviderForTest(fakeProvider());
      const out = await explainReport(h.db, admin, { reportId: report.value.id }, sig());
      expect(out.ok).toBe(true);
      if (out.ok) {
        expect(out.value.insights).toHaveLength(3);
        expect(out.value.insights.join(" ")).toContain("Total:");
      }
    });

    it("sends only aggregated rows to the model", async () => {
      await addDeal({ title: "Secret deal title", value: "500.00" });
      const scripted = new ScriptedAiProvider({
        content: JSON.stringify({ insights: ["first", "second", "third"] }),
      });
      setAiProviderForTest(scripted);

      const out = await explainReport(
        h.db,
        admin,
        { definition: def({ measure: { kind: "sum_value" }, groupBy: { field: "stage" } }) },
        sig(),
      );
      expect(out.ok).toBe(true);
      const messages = scripted.calls[0]?.messages ?? [];
      const prompt = messages.map((message) => String(message.content)).join("\n");
      expect(prompt).toContain('"group"');
      expect(prompt).not.toContain("Secret deal title");
      expect(prompt).not.toContain("@example.com");
    });

    it("maps an AI cap error to E_INSIGHT_004", async () => {
      setAiProviderForTest(new ScriptedAiProvider({ content: "{}" }));
      await updateAiSettings(
        h.db,
        { enabled: true, companyMonthlyTokenLimit: 0, userMonthlyTokenLimit: null },
        sig(),
      );
      const out = await explainReport(h.db, admin, { definition: def() }, sig());
      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.error.id).toBe(ERROR_IDS.INSIGHT_EXPLAIN_UNAVAILABLE);
        expect(out.error.context?.cause).toBe(ERROR_IDS.AI_COMPANY_LIMIT);
      }
    });

    it("scores three deals and notifies the requester once", async () => {
      await updateAiSettings(
        h.db,
        { enabled: true, companyMonthlyTokenLimit: 1_000_000, userMonthlyTokenLimit: null },
        sig(),
      );
      setAiProviderForTest(
        new ScriptedAiProvider({ ...scoreReply }, { ...scoreReply }, { ...scoreReply }),
      );
      const ids = [
        await addDeal({ title: "One", value: "10.00" }),
        await addDeal({ title: "Two", value: "20.00" }),
        await addDeal({ title: "Three", value: "30.00" }),
      ];

      const outcome = await runBulkScoreJob(h.db, { requesterId: admin.id, dealIds: ids }, sig());
      expect(outcome.ok).toBe(true);
      if (outcome.ok) expect(outcome.value.scored).toBe(3);

      const scores = await h.db
        .select({ dealId: dealAiInsights.dealId, score: dealAiInsights.score })
        .from(dealAiInsights)
        .where(inArray(dealAiInsights.dealId, ids));
      expect(scores).toHaveLength(3);
      expect(scores.every((row) => row.score === 72)).toBe(true);

      const notes = await h.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, "ai_bulk_score"));
      expect(notes).toHaveLength(1);
      expect(notes[0]?.payload.message).toBe("Scored 3 of 3 deals");

      const board = await getBoardColumns(h.db, sessionFor(admin), pipelineId, sig());
      expect(board.cards.find((card) => card.id === ids[0])?.score).toBe(72);
    });

    it("stops at the AI cap and says so in the notification", async () => {
      await updateAiSettings(
        h.db,
        { enabled: true, companyMonthlyTokenLimit: 150, userMonthlyTokenLimit: null },
        sig(),
      );
      setAiProviderForTest(new ScriptedAiProvider({ ...scoreReply }));
      const ids = [
        await addDeal({ title: "One", value: "10.00" }),
        await addDeal({ title: "Two", value: "20.00" }),
        await addDeal({ title: "Three", value: "30.00" }),
      ];

      const outcome = await runBulkScoreJob(h.db, { requesterId: admin.id, dealIds: ids }, sig());
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.value.scored).toBe(1);
        expect(outcome.value.stopped).toBe(true);
      }
      const notes = await h.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, "ai_bulk_score"));
      expect(notes[0]?.payload.message).toBe("Scored 1 of 3 deals (AI limit reached)");
    });

    it("drops deals the actor cannot edit before enqueuing", async () => {
      const { boss, sends } = fakeBoss();
      setBoss(boss);
      const mine = await addDeal({ title: "Mine", ownerId: viewerId });
      const theirs = await addDeal({
        title: "Theirs",
        ownerId: otherOwnerId,
        visibilityLevel: "owner",
      });

      const viewerEditor: PermSetUser = {
        ...viewer,
        flags: new Set(["deal.edit_own"]),
      };
      const queued = await bulkScoreDeals(h.db, viewerEditor, { dealIds: [mine, theirs] }, sig());
      expect(queued.ok).toBe(true);
      if (queued.ok) expect(queued.value.queued).toBe(1);
      expect(sends).toHaveLength(1);
      const data = sends[0]?.data as { requesterId: string; dealIds: string[] };
      expect(data.requesterId).toBe(viewerId);
      expect(data.dealIds).toEqual([mine]);
    });
  });
});
