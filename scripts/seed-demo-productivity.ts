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
  { name: "Dana Duplicate", email: "dana.duplicate@example.com", sameOrg: false },
  { name: "Dana Duplicate (import)", email: "Dana.Duplicate@Example.com", sameOrg: false },
  { name: "Sam Same", email: "sam.same@example.com", sameOrg: true },
  { name: "Sam Same (import)", email: "sam.same.import@example.com", sameOrg: true },
] as const;

const ORG_PAIR = [
  { name: "Acme Ltd", domain: "acme-demo.example" },
  { name: "ACME Limited", domain: "www.acme-demo.example" },
] as const;

type Db = ReturnType<typeof drizzle<typeof schema>>;

// The due dates are relative SQL expressions so a re-run always seeds a future series.
function sqlNow(expression: string) {
  return sql.raw(expression);
}

async function seedSeries(
  db: Db,
  args: { ownerId: string; typeId: string },
  input: { subject: string; dueExpr: string; rule: unknown; anchorDay: number },
): Promise<boolean> {
  const [existing] = await db
    .select({ id: schema.activities.id })
    .from(schema.activities)
    .where(
      and(
        eq(schema.activities.subject, input.subject),
        eq(schema.activities.ownerId, args.ownerId),
      ),
    );
  if (existing !== undefined) return false;
  const [created] = await db
    .insert(schema.activities)
    .values({
      typeId: args.typeId,
      subject: input.subject,
      ownerId: args.ownerId,
      assigneeId: args.ownerId,
      dueAt: sqlNow(input.dueExpr),
      allDay: false,
    })
    .returning({ id: schema.activities.id });
  if (created === undefined) throw new Error(`demo seed: ${input.subject} insert failed`);
  await db.insert(schema.activityRecurrence).values({
    activityId: created.id,
    seriesId: randomUUID(),
    rule: input.rule,
    anchorDay: input.anchorDay,
    occurrence: 1,
  });
  return true;
}

async function seedCall(
  db: Db,
  args: { ownerId: string; typeId: string },
  call: (typeof CALLS)[number],
): Promise<boolean> {
  const [existing] = await db
    .select({ id: schema.activities.id })
    .from(schema.activities)
    .where(
      and(eq(schema.activities.subject, call.subject), eq(schema.activities.ownerId, args.ownerId)),
    );
  if (existing !== undefined) return false;
  const [created] = await db
    .insert(schema.activities)
    .values({
      typeId: args.typeId,
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
  return true;
}

async function seedPerson(
  db: Db,
  args: { ownerId: string; orgId: string | null },
  person: (typeof PERSON_PAIRS)[number],
): Promise<void> {
  const [existing] = await db
    .select({ id: schema.persons.id })
    .from(schema.persons)
    .where(and(eq(schema.persons.name, person.name), eq(schema.persons.ownerId, args.ownerId)));
  if (existing !== undefined) return;
  await db.insert(schema.persons).values({
    name: person.name,
    ownerId: args.ownerId,
    visibilityLevel: "all",
    primaryEmail: person.email,
    emails: [{ value: person.email, label: "work", primary: true }],
    orgId: person.sameOrg ? args.orgId : null,
  });
}

async function seedOrgPair(db: Db, ownerId: string, org: (typeof ORG_PAIR)[number]): Promise<void> {
  const [existing] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(and(eq(schema.organizations.name, org.name), eq(schema.organizations.ownerId, ownerId)));
  if (existing !== undefined) return;
  await db.insert(schema.organizations).values({
    name: org.name,
    ownerId,
    visibilityLevel: "all",
    domain: org.domain,
  });
}

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
  const typeArgs = { ownerId: args.ownerId, typeId: callType.id };

  let recurring = 0;
  if (
    await seedSeries(db, typeArgs, {
      subject: WEEKLY,
      dueExpr: "date_trunc('week', now()) + interval '7 days 9 hours'",
      rule: { freq: "weekly", interval: 1, byWeekday: ["mon", "thu"], end: { type: "never" } },
      anchorDay: 1,
    })
  ) {
    recurring += 1;
  }
  if (
    await seedSeries(db, typeArgs, {
      subject: MONTHLY,
      dueExpr: "date_trunc('month', now()) + interval '1 month 30 days 9 hours'",
      rule: { freq: "monthly", interval: 1, end: { type: "never" } },
      anchorDay: 31,
    })
  ) {
    recurring += 1;
  }

  let calls = 0;
  for (const call of CALLS) {
    if (await seedCall(db, typeArgs, call)) calls += 1;
  }

  const orgId = args.orgIds[0] ?? null;
  for (const person of PERSON_PAIRS) {
    await seedPerson(db, { ownerId: args.ownerId, orgId }, person);
  }
  for (const org of ORG_PAIR) {
    await seedOrgPair(db, args.ownerId, org);
  }

  return { recurring, calls, duplicatePairs: 3 };
}
