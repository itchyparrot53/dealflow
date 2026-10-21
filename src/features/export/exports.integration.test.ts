import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as exportRoute } from "@/app/(app)/export/[entity]/route";
import { ERROR_IDS } from "@/constants/errorIds";
import { activities, activityTypes, deals } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { exportTable } from "./exports";

// Export against real Postgres. The route binds the pool and request context at import, so both
// are pointed at this test's database and actor; nothing about the data layer is mocked.

let h: TestDb;
let admin: PermSetUser;
let regular: PermSetUser;
let exporter: PermSetUser;
let pipelineId: string;
let stageId: string;
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

const sig = (): AbortSignal => AbortSignal.timeout(20_000);

function actor(row: { id: string; isAdmin: boolean }, flags: string[] = []): PermSetUser {
  return {
    id: row.id,
    type: row.isAdmin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(flags) as PermSetUser["flags"],
  };
}

beforeAll(async () => {
  h = await makeTestDb();
  admin = actor(await seedUser(h.db, { isAdmin: true, name: "Ada Admin" }));
  regular = actor(await seedUser(h.db, { name: "Rita Regular" }));
  exporter = actor(await seedUser(h.db, { name: "Eve Exporter" }), ["data.export"]);
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

async function seedDeal(title: string, ownerId: string, visibilityLevel: "all" | "owner") {
  const [row] = await h.db
    .insert(deals)
    .values({
      title,
      pipelineId,
      stageId,
      ownerId,
      visibilityLevel,
      boardPosition: "0",
    })
    .returning({ id: deals.id });
  if (row === undefined) throw new Error("deal seed failed");
  return row.id;
}

describe("exportTable", () => {
  it("respects the list visibility and the chosen columns", async () => {
    await seedDeal("Visible export", admin.id, "all");
    await seedDeal("Hidden export", regular.id, "owner");

    const result = await exportTable(h.db, admin, "deals", { columns: "title" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.header).toEqual(["Title"]);
    const titles = result.value.rows.map((row) => row[0]);
    expect(titles).toContain("Visible export");
    expect(titles).toContain("Hidden export");

    const exporterResult = await exportTable(h.db, exporter, "deals", { columns: "title" }, sig());
    expect(exporterResult.ok).toBe(true);
    if (!exporterResult.ok) return;
    const exporterTitles = exporterResult.value.rows.map((row) => row[0]);
    expect(exporterTitles).toContain("Visible export");
    expect(exporterTitles).not.toContain("Hidden export");
  });

  it("narrows the activities export by the list's URL filter", async () => {
    const [type] = await h.db.select().from(activityTypes).where(eq(activityTypes.key, "call"));
    if (type === undefined) throw new Error("activity type 'call' not found");
    await h.db.insert(activities).values([
      {
        typeId: type.id,
        subject: "Open admin call",
        ownerId: admin.id,
        assigneeId: admin.id,
        dueAt: new Date("2026-07-10T09:00:00.000Z"),
        done: false,
      },
      {
        typeId: type.id,
        subject: "Done admin call",
        ownerId: admin.id,
        assigneeId: admin.id,
        dueAt: new Date("2026-07-11T09:00:00.000Z"),
        done: true,
      },
      {
        typeId: type.id,
        subject: "Regular call",
        ownerId: regular.id,
        assigneeId: regular.id,
        dueAt: new Date("2026-07-12T09:00:00.000Z"),
        done: false,
      },
    ]);

    const result = await exportTable(
      h.db,
      admin,
      "activities",
      { ownerId: admin.id, done: "open", from: "2026-07-01", to: "2026-07-31" },
      sig(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const subjects = result.value.rows.map((row) => row[0]);
    expect(subjects).toContain("Open admin call");
    expect(subjects).not.toContain("Done admin call");
    expect(subjects).not.toContain("Regular call");
  });

  it("refuses without data.export", async () => {
    const result = await exportTable(h.db, regular, "deals", {}, sig());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.EXPORT_FORBIDDEN);
  });

  it("refuses an export larger than the cap", async () => {
    const result = await exportTable(h.db, admin, "deals", {}, sig(), 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.id).toBe(ERROR_IDS.EXPORT_TOO_LARGE);
  });

  it("guards a formula-leading cell in the streamed file", async () => {
    await seedDeal("=SUM(A1)", admin.id, "all");
    const result = await exportTable(h.db, admin, "deals", { columns: "title" }, sig());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.some((row) => row[0] === "=SUM(A1)")).toBe(true);
  });
});

describe("export route", () => {
  it("downloads a CSV with the list columns and an attachment name", async () => {
    currentActor = admin;
    const response = await exportRoute(
      new NextRequest("http://localhost/export/deals?columns=title"),
      {
        params: Promise.resolve({ entity: "deals" }),
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toMatch(/deals-\d{4}-\d{2}-\d{2}\.csv/);
    // Response.text() strips a UTF-8 BOM per the fetch spec, so assert the decoded first line.
    const text = await response.text();
    expect(text.startsWith("Title\r\n")).toBe(true);
  });

  it("returns 403 for a user without data.export", async () => {
    currentActor = regular;
    const response = await exportRoute(new NextRequest("http://localhost/export/deals"), {
      params: Promise.resolve({ entity: "deals" }),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { id: string } };
    expect(body.error.id).toBe(ERROR_IDS.EXPORT_FORBIDDEN);
  });

  it("returns 401 without a session", async () => {
    currentActor = null;
    const response = await exportRoute(new NextRequest("http://localhost/export/deals"), {
      params: Promise.resolve({ entity: "deals" }),
    });
    expect(response.status).toBe(401);
  });
});
