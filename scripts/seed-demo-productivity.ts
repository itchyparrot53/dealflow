// Part 9 demo data: one weekly series (Mon and Thu), one monthly series anchored on the 31st,
// three logged calls with different outcomes, two duplicate person pairs and one duplicate
// organization pair. Re-runnable: rows are matched by subject/name and reused.

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "@/db/schema";

const WEEKLY = "Weekly pipeline review";
const MONTHLY = "Monthly close review";

const CALLS = [
  { subject: "Outbound call: Connected", outcome: "connected", direction: "outbound" },
  { subject: "Outbound call: No answer", outcome: "no_answer", direction: "outbound" },
  { subject: "Inbound call: Left voicemail", outcome: "left_voicemail", direction: "inbound" },
] as const;

const PERSON_PAIRS = [
  { name: "Dana Duplicate", email: "dana.duplicate@example.com" },
  { name: "Dana Duplicate (import)", email: "Dana.Duplicate@Example.com" },
  { name: "Sam Same", email: "sam.same@example.com", sameOrg: true },
  { name: "Sam Same (import)", email: "sam.same.import@example.com", sameOrg: true },
] as const;

const ORG_PAIR = [
  { name: "Acme Ltd", domain: "acme-demo.example" },
  { name: "ACME Limited", domain: "www.acme-demo.example" },
] as const;

export async function seedProductivity(args: {
  ownerId: string;
  orgIds: readonly string[];
  pool: Pool;
}): Promise<{ recurring: number; calls: number; duplicatePairs: number }> {
  const db = drizzle(args.pool, { schema });
  const [callType] = await db
    .select({ id: schema.activityTypes.id })
    .from(schema.activityTypes)
    .where(eq(schema.activityTypes.key, "call"));
  if (callType === undefined) throw new Error("demo seed: activity type 'call' not found");

  async function activityId(subject: string): Promise<string | null> {
    const [existing] = await db
      .select({ id: schema.activities.id })
      .from(schema.activities)
      .where(
        and(eq(schema.activities.subject, subject), eq(schema.activities.ownerId, args.ownerId)),
      );
    return existing?.id ?? null;
  }

  let recurring = 0;

  // Weekly series due next Monday at 09:00.
  if ((await activityId(WEEKLY)) === null) {
    const [created] = await db
      .insert(schema.activities)
      .values({
        typeId: callType.id,
        subject: WEEKLY,
        ownerId: args.ownerId,
        assigneeId: args.ownerId,
        dueAt: sqlNow("date_trunc('week', now()) + interval '7 days 9 hours'"),
        allDay: false,
      })
      .returning({ id: schema.activities.id });
    if (created === undefined) throw new Error("demo seed: weekly activity insert failed");
    await db.insert(schema.activityRecurrence).values({
      activityId: created.id,
      seriesId: randomUUID(),
      rule: { freq: "weekly", interval: 1, byWeekday: ["mon", "thu"], end: { type: "never" } },
      anchorDay: 1,
      occurrence: 1,
    });
    recurring += 1;
  }

  // Monthly series anchored on the 31st of next month at 09:00.
  if ((await activityId(MONTHLY)) === null) {
    const [created] = await db
      .insert(schema.activities)
      .values({
        typeId: callType.id,
        subject: MONTHLY,
        ownerId: args.ownerId,
        assigneeId: args.ownerId,
        dueAt: sqlNow("date_trunc('month', now()) + interval '1 month 30 days 9 hours'"),
        allDay: false,
      })
      .returning({ id: schema.activities.id });
    if (created === undefined) throw new Error("demo seed: monthly activity insert failed");
    await db.insert(schema.activityRecurrence).values({
      activityId: created.id,
      seriesId: randomUUID(),
      rule: { freq: "monthly", interval: 1, end: { type: "never" } },
      anchorDay: 31,
      occurrence: 1,
    });
    recurring += 1;
  }

  let calls = 0;
  for (const call of CALLS) {
    if ((await activityId(call.subject)) !== null) continue;
    const [created] = await db
      .insert(schema.activities)
      .values({
        typeId: callType.id,
        subject: call.subject,
        ownerId: args.ownerId,
        assigneeId: args.ownerId,
        dueAt: sqlNow("now() - interval '2 days'"),
        allDay: false,
        done: true,
        doneAt: sqlNow("now() - interval '2 days'"),
        durationMinutes: 5,
      })
      .returning({ id: schema.activities.id });
    if (created === undefined) throw new Error("demo seed: call insert failed");
    await db.insert(schema.activityCalls).values({
      activityId: created.id,
      outcome: call.outcome,
      direction: call.direction,
      durationSeconds: 300,
    });
    calls += 1;
  }

  let duplicatePairs = 0;
  const orgId = args.orgIds[0] ?? null;
  for (const person of PERSON_PAIRS) {
    const [existing] = await db
      .select({ id: schema.persons.id })
      .from(schema.persons)
      .where(and(eq(schema.persons.name, person.name), eq(schema.persons.ownerId, args.ownerId)));
    if (existing !== undefined) continue;
    await db.insert(schema.persons).values({
      name: person.name,
      ownerId: args.ownerId,
      visibilityLevel: "all",
      primaryEmail: person.email,
      emails: [{ value: person.email, label: "work", primary: true }],
      orgId: "sameOrg" in person && person.sameOrg ? orgId : null,
    });
  }
  duplicatePairs += 2;

  for (const org of ORG_PAIR) {
    const [existing] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(
        and(
          eq(schema.organizations.name, org.name),
          eq(schema.organizations.ownerId, args.ownerId),
        ),
      );
    if (existing !== undefined) continue;
    await db.insert(schema.organizations).values({
      name: org.name,
      ownerId: args.ownerId,
      visibilityLevel: "all",
      domain: org.domain,
    });
  }
  duplicatePairs += 1;

  return { recurring, calls, duplicatePairs };
}

// The due dates are relative SQL expressions so a re-run always seeds a future series.
function sqlNow(expression: string) {
  return sql.raw(expression);
}
