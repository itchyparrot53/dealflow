import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  activities,
  activityRecurrence,
  activityTypes,
  deals,
  domainEvents,
  userPreferences,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { completeActivity, createActivity } from "../repo";
import type { RecurrenceRule } from "./rule";
import { getRecurrence, setRecurrence } from "./series";

let tdb: TestDb;
beforeAll(async () => {
  tdb = await makeTestDb();
}, 60_000);
afterAll(async () => {
  await tdb.close();
});

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

async function callType() {
  const [type] = await tdb.db.select().from(activityTypes).where(eq(activityTypes.key, "call"));
  if (type === undefined) throw new Error("activity type 'call' not found");
  return type;
}

interface MadeActivity {
  id: string;
  actor: PermSetUser;
  userId: string;
}

async function makeActivity(overrides: {
  subject: string;
  dueAt: string;
  dealId?: string;
  durationMinutes?: number | null;
  note?: string;
}): Promise<MadeActivity> {
  const user = await seedUser(tdb.db, { isAdmin: true });
  const actor = makeActor(user);
  const type = await callType();
  const created = await createActivity(
    tdb.db,
    actor,
    {
      typeId: type.id,
      subject: overrides.subject,
      dueAt: overrides.dueAt,
      allDay: false,
      endAt: null,
      durationMinutes: overrides.durationMinutes ?? null,
      priority: null,
      dealId: overrides.dealId ?? null,
      leadId: null,
      personId: null,
      orgId: null,
      guestPersonIds: [],
      participantUserIds: [],
      customFields: {},
      location: null,
      note: overrides.note ?? null,
      videoCallUrl: null,
      done: false,
    },
    signal,
  );
  if (!created.ok) throw new Error(`createActivity failed: ${created.error.message}`);
  return { id: created.value.id, actor, userId: user.id };
}

async function setRule(activityId: string, rule: RecurrenceRule): Promise<void> {
  const user = await tdb.db
    .select({ ownerId: activities.ownerId })
    .from(activities)
    .where(eq(activities.id, activityId));
  const owner = user[0]?.ownerId;
  if (owner === undefined) throw new Error("activity owner missing");
  const result = await setRecurrence(
    tdb.db,
    makeActor({ id: owner, isAdmin: true }),
    activityId,
    rule,
    signal,
  );
  if (!result.ok) throw new Error(`setRecurrence failed: ${result.error.message}`);
}

async function activitiesFor(userId: string) {
  return tdb.db.select().from(activities).where(eq(activities.ownerId, userId));
}

describe("recurring activities", () => {
  it("creates exactly one next activity with copied fields and the right date", async () => {
    const pipe = await seedPipelineWithStages(tdb.db, ["Lead"]);
    const firstStage = pipe.stages[0];
    if (firstStage === undefined) throw new Error("stage seed failed");
    const [deal] = await tdb.db
      .insert(deals)
      .values({
        title: "Recurring deal",
        pipelineId: pipe.pipeline.id,
        stageId: firstStage.id,
        ownerId: (await seedUser(tdb.db)).id,
        visibilityLevel: "all",
      })
      .returning();
    if (deal === undefined) throw new Error("deal seed failed");

    const made = await makeActivity({
      subject: "Weekly sync",
      dueAt: "2026-01-01T09:00:00.000Z",
      dealId: deal.id,
      durationMinutes: 30,
      note: "<p>agenda</p>",
    });
    await setRule(made.id, {
      freq: "weekly",
      interval: 1,
      byWeekday: ["mon", "thu"],
      end: { type: "never" },
    });

    const done = await completeActivity(tdb.db, made.actor, made.id, true, signal);
    expect(done.ok).toBe(true);

    const rows = await activitiesFor(made.userId);
    expect(rows).toHaveLength(2);
    const next = rows.find((row) => row.id !== made.id);
    expect(next).toBeDefined();
    if (next === undefined) return;
    expect(next.subject).toBe("Weekly sync");
    expect(next.dueAt?.toISOString()).toBe("2026-01-05T09:00:00.000Z");
    expect(next.dealId).toBe(deal.id);
    expect(next.ownerId).toBe(made.userId);
    expect(next.assigneeId).toBe(made.userId);
    expect(next.durationMinutes).toBe(30);
    expect(next.note).toBe("<p>agenda</p>");
    expect(next.done).toBe(false);
    expect(next.doneAt).toBeNull();
  });

  it("uses the assignee's time zone across a DST change", async () => {
    const made = await makeActivity({ subject: "London daily", dueAt: "2026-03-28T09:00:00.000Z" });
    await tdb.db.insert(userPreferences).values({ userId: made.userId, timezone: "Europe/London" });
    await setRule(made.id, { freq: "daily", interval: 1, end: { type: "never" } });

    await completeActivity(tdb.db, made.actor, made.id, true, signal);
    const next = (await activitiesFor(made.userId)).find((row) => row.id !== made.id);
    expect(next?.dueAt?.toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("creates only one next occurrence when completed twice concurrently", async () => {
    const made = await makeActivity({ subject: "Concurrent", dueAt: "2026-02-02T09:00:00.000Z" });
    await setRule(made.id, { freq: "daily", interval: 1, end: { type: "never" } });

    const [first, second] = await Promise.all([
      completeActivity(tdb.db, made.actor, made.id, true, signal),
      completeActivity(tdb.db, made.actor, made.id, true, signal),
    ]);
    expect(first.ok && second.ok).toBe(true);

    expect(await activitiesFor(made.userId)).toHaveLength(2);
    const firstOccurrence = await getRecurrence(tdb.db, made.id, signal);
    expect(firstOccurrence).not.toBeNull();
    if (firstOccurrence === null) return;
    const series = await tdb.db
      .select()
      .from(activityRecurrence)
      .where(eq(activityRecurrence.seriesId, firstOccurrence.seriesId));
    expect(series).toHaveLength(2);
  });

  it("stops after the count is reached", async () => {
    const made = await makeActivity({ subject: "Counted", dueAt: "2026-02-02T09:00:00.000Z" });
    await setRule(made.id, { freq: "daily", interval: 1, end: { type: "count", count: 2 } });

    await completeActivity(tdb.db, made.actor, made.id, true, signal);
    const rows = await activitiesFor(made.userId);
    expect(rows).toHaveLength(2);
    const second = rows.find((row) => row.id !== made.id);
    if (second === undefined) return;

    await completeActivity(tdb.db, made.actor, second.id, true, signal);
    expect(await activitiesFor(made.userId)).toHaveLength(2);
  });

  it("ending the series stops creation", async () => {
    const made = await makeActivity({ subject: "Ended", dueAt: "2026-02-02T09:00:00.000Z" });
    await setRule(made.id, { freq: "daily", interval: 1, end: { type: "never" } });
    const ended = await setRecurrence(tdb.db, made.actor, made.id, null, signal);
    expect(ended.ok).toBe(true);
    expect(await getRecurrence(tdb.db, made.id, signal)).toMatchObject({ ended: true });

    await completeActivity(tdb.db, made.actor, made.id, true, signal);
    expect(await activitiesFor(made.userId)).toHaveLength(1);
  });

  it("editing the rule on occurrence 2 changes occurrence 3", async () => {
    const made = await makeActivity({ subject: "Edited", dueAt: "2026-01-01T09:00:00.000Z" });
    await setRule(made.id, {
      freq: "weekly",
      interval: 1,
      byWeekday: ["mon", "thu"],
      end: { type: "never" },
    });
    await completeActivity(tdb.db, made.actor, made.id, true, signal);
    const occurrence2 = (await activitiesFor(made.userId)).find((row) => row.id !== made.id);
    expect(occurrence2?.dueAt?.toISOString()).toBe("2026-01-05T09:00:00.000Z");
    if (occurrence2 === undefined) return;

    await setRule(occurrence2.id, { freq: "daily", interval: 1, end: { type: "never" } });
    await completeActivity(tdb.db, made.actor, occurrence2.id, true, signal);

    const occurrence3 = (await activitiesFor(made.userId)).find(
      (row) => row.id !== made.id && row.id !== occurrence2.id,
    );
    expect(occurrence3?.dueAt?.toISOString()).toBe("2026-01-06T09:00:00.000Z");
  });

  it("a deleted occurrence creates nothing", async () => {
    const made = await makeActivity({ subject: "Deleted", dueAt: "2026-02-02T09:00:00.000Z" });
    await setRule(made.id, { freq: "daily", interval: 1, end: { type: "never" } });
    await tdb.db
      .update(activities)
      .set({ deletedAt: new Date() })
      .where(eq(activities.id, made.id));

    const done = await completeActivity(tdb.db, made.actor, made.id, true, signal);
    expect(done.ok).toBe(false);
    expect(await activitiesFor(made.userId)).toHaveLength(1);
  });

  it("emits activity.created for the next occurrence", async () => {
    const made = await makeActivity({ subject: "Eventful", dueAt: "2026-02-02T09:00:00.000Z" });
    await setRule(made.id, { freq: "daily", interval: 1, end: { type: "never" } });
    await completeActivity(tdb.db, made.actor, made.id, true, signal);

    const next = (await activitiesFor(made.userId)).find((row) => row.id !== made.id);
    expect(next).toBeDefined();
    if (next === undefined) return;
    const events = await tdb.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.entityId, next.id));
    expect(events.some((event) => event.type === "activity.created")).toBe(true);
  });
});
