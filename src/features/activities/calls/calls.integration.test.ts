import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { activities, activityCalls, activityTypes, deals } from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { listActivitiesForEntity } from "../forEntity";
import { logCall, resolveCallType } from "./calls";

const signal = new AbortController().signal;

function makeActor(user: { id: string; isAdmin: boolean }): PermSetUser {
  return {
    id: user.id,
    type: user.isAdmin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}

async function seedDeal(
  db: Parameters<Parameters<typeof withTestDb>[0]>[0],
  ownerId: string,
  visibilityLevel: "all" | "owner" = "all",
) {
  const pipe = await seedPipelineWithStages(db, ["Lead"]);
  const stage = pipe.stages[0];
  if (stage === undefined) throw new Error("stage seed failed");
  const [deal] = await db
    .insert(deals)
    .values({
      title: "Call deal",
      pipelineId: pipe.pipeline.id,
      stageId: stage.id,
      ownerId,
      visibilityLevel,
    })
    .returning();
  if (deal === undefined) throw new Error("deal seed failed");
  return deal;
}

describe("logCall", () => {
  it("creates a done activity of the call type plus the call row", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      const actor = makeActor(user);
      const deal = await seedDeal(db, user.id);
      const type = await resolveCallType(db, signal);
      expect(type).not.toBeNull();

      const created = await logCall(
        db,
        actor,
        {
          dealId: deal.id,
          outcome: "no_answer",
          direction: "outbound",
          durationSeconds: 90,
          note: "Left a message",
          at: "2026-05-01T10:00:00.000Z",
        },
        signal,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const [activity] = await db
        .select()
        .from(activities)
        .where(eq(activities.id, created.value.id));
      expect(activity).toBeDefined();
      if (activity === undefined) return;
      expect(activity.done).toBe(true);
      expect(activity.doneAt).not.toBeNull();
      expect(activity.subject).toBe("Outbound call: No answer");
      expect(activity.typeId).toBe(type?.id);
      expect(activity.durationMinutes).toBe(2);
      expect(activity.dealId).toBe(deal.id);
      expect(activity.dueAt?.toISOString()).toBe("2026-05-01T10:00:00.000Z");

      const [call] = await db
        .select()
        .from(activityCalls)
        .where(eq(activityCalls.activityId, activity.id));
      expect(call).toMatchObject({
        outcome: "no_answer",
        direction: "outbound",
        durationSeconds: 90,
      });
    });
  });

  it("stores no duration for a zero-length call", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      const created = await logCall(
        db,
        makeActor(user),
        { outcome: "busy", direction: "outbound", durationSeconds: 0 },
        signal,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const [activity] = await db
        .select()
        .from(activities)
        .where(eq(activities.id, created.value.id));
      expect(activity?.durationMinutes).toBeNull();
      const [call] = await db
        .select()
        .from(activityCalls)
        .where(eq(activityCalls.activityId, created.value.id));
      expect(call?.durationSeconds).toBe(0);
    });
  });

  it("returns E_CALL_001 when no call type exists", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      await db.update(activityTypes).set({ archivedAt: new Date() });
      expect(await resolveCallType(db, signal)).toBeNull();

      const created = await logCall(
        db,
        makeActor(user),
        { outcome: "connected", direction: "inbound" },
        signal,
      );
      expect(created.ok).toBe(false);
      if (created.ok) return;
      expect(created.error.id).toBe("E_CALL_001");
    });
  });

  it("includes the outcome on the timeline read", async () => {
    await withTestDb(async (db) => {
      const user = await seedUser(db, { isAdmin: true });
      const actor = makeActor(user);
      const deal = await seedDeal(db, user.id);

      const created = await logCall(
        db,
        actor,
        { dealId: deal.id, outcome: "connected", direction: "inbound", durationSeconds: 300 },
        signal,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const rows = await listActivitiesForEntity(db, actor, "deal", deal.id, signal);
      const row = rows.find((entry) => entry.id === created.value.id);
      expect(row?.call).toEqual({
        outcome: "connected",
        direction: "inbound",
        durationSeconds: 300,
      });
    });
  });

  it("refuses a deal the actor cannot see", async () => {
    await withTestDb(async (db) => {
      const owner = await seedUser(db);
      const other = await seedUser(db);
      const deal = await seedDeal(db, owner.id, "owner");

      const created = await logCall(
        db,
        makeActor(other),
        { dealId: deal.id, outcome: "busy", direction: "outbound" },
        signal,
      );
      expect(created.ok).toBe(false);
    });
  });
});
