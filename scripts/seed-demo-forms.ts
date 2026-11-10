// Part 6 demo data: one active "Contact us" form with two submissions, and one active "Intro call"
// booking page with a future booking and its activity. Re-runnable: it removes only the rows it
// created (matched by their fixed names and emails) before inserting.

import { createHash, randomBytes } from "node:crypto";
import { addDays, utcToZoned, zonedToUtc } from "@/features/scheduling/zonedTime";
import type { Db } from "./seed-smoke-phase5-infra";

const FORM_NAME = "Contact us";
const PAGE_TITLE = "Intro call";
const VISITOR_EMAILS = ["riley.chen@example.com", "maya.patel@example.com"];

const AVAILABILITY = {
  mon: [{ from: "09:00", to: "17:00" }],
  tue: [{ from: "09:00", to: "17:00" }],
  wed: [{ from: "09:00", to: "17:00" }],
  thu: [{ from: "09:00", to: "17:00" }],
  fri: [{ from: "09:00", to: "17:00" }],
  sat: [],
  sun: [],
};

const FIELDS = [
  { key: "name", label: "Name", required: true, placeholder: null },
  { key: "email", label: "Email", required: true, placeholder: null },
  { key: "organization", label: "Organization", required: false, placeholder: null },
  { key: "message", label: "Message", required: false, placeholder: null },
  // Part 14: the consent field the campaign e2e ticks; unticked on the other specs, where it
  // changes nothing.
  {
    key: "marketing_consent",
    label: "I'd like to receive news and offers by email. I can unsubscribe at any time.",
    required: false,
    placeholder: null,
  },
];

async function meetingTypeId(db: Db): Promise<string | null> {
  const rows = await db.q<{ id: string }>(
    `SELECT id FROM activity_types WHERE archived_at IS NULL
     ORDER BY (lower(name) = 'meeting') DESC, "order" LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

export async function seedFormsBooking(
  db: Db,
  args: { ownerId: string },
): Promise<{ forms: number; submissions: number; pages: number; bookings: number }> {
  // Clean up this seed's own rows first. Activities go before the page so no orphan is left when
  // the booking's activity_id is nulled by the cascade.
  await db.q(`DELETE FROM activities WHERE subject LIKE 'Intro call with %'`);
  await db.q(`DELETE FROM booking_pages WHERE title = $1`, [PAGE_TITLE]);
  await db.q(`DELETE FROM web_forms WHERE name = $1`, [FORM_NAME]);
  await db.q(`DELETE FROM leads WHERE title LIKE $1`, [`% via ${FORM_NAME}`]);
  await db.q(`DELETE FROM persons WHERE primary_email = ANY($1::citext[])`, [VISITOR_EMAILS]);

  const formId = await insertForm(db, args.ownerId);
  const submissions = await insertSubmissions(db, formId, args.ownerId);
  const pageId = await insertPage(db, args.ownerId);
  const booking = await insertBooking(db, pageId, args.ownerId);

  return { forms: 1, submissions, pages: 1, bookings: booking };
}

async function insertForm(db: Db, ownerId: string): Promise<string> {
  const publicId = randomBytes(12).toString("base64url");
  const rows = await db.q<{ id: string }>(
    `INSERT INTO web_forms
       (public_id, name, title, description, fields, creates, owner_id, success_message, active)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'lead', $6, $7, true)
     RETURNING id`,
    [
      publicId,
      FORM_NAME,
      FORM_NAME,
      "Tell us about your project and we will get back to you.",
      JSON.stringify(FIELDS),
      ownerId,
      "Thanks, we will be in touch.",
    ],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("demo form insert returned no row");
  return id;
}

async function insertPerson(db: Db, ownerId: string, name: string, email: string): Promise<string> {
  const rows = await db.q<{ id: string }>(
    `INSERT INTO persons (name, primary_email, emails, owner_id, visibility_level)
     VALUES ($1, $2::citext, $3::jsonb, $4, 'all')
     RETURNING id`,
    [name, email, JSON.stringify([{ label: "work", value: email, primary: true }]), ownerId],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("demo person insert returned no row");
  return id;
}

async function insertSubmissions(db: Db, formId: string, ownerId: string): Promise<number> {
  const seeds = [
    { name: "Riley Chen", org: "Chen Studio", message: "We are looking for a simple CRM." },
    { name: "Maya Patel", org: "Patel Design", message: "Can we book a demo next week?" },
  ];
  let count = 0;
  for (const seed of seeds) {
    const email = VISITOR_EMAILS[count] ?? `visitor${count}@example.com`;
    const personId = await insertPerson(db, ownerId, seed.name, email);
    const leads = await db.q<{ id: string }>(
      `INSERT INTO leads (title, person_id, source_origin, source_channel, owner_id, visibility_level)
       VALUES ($1, $2, 'web_form', 'web_form', $3, 'all')
       RETURNING id`,
      [`${seed.name} via ${FORM_NAME}`, personId, ownerId],
    );
    const leadId = leads[0]?.id;
    if (leadId === undefined) throw new Error("demo lead insert returned no row");
    await db.q(
      `INSERT INTO web_form_submissions (form_id, "values", person_id, lead_id)
       VALUES ($1, $2::jsonb, $3, $4)`,
      [
        formId,
        JSON.stringify({
          name: seed.name,
          email,
          organization: seed.org,
          message: seed.message,
        }),
        personId,
        leadId,
      ],
    );
    count += 1;
  }
  await db.q(`UPDATE web_forms SET submission_count = $2 WHERE id = $1`, [formId, count]);
  return count;
}

async function insertPage(db: Db, ownerId: string): Promise<string> {
  const activityTypeId = await meetingTypeId(db);
  if (activityTypeId === null) throw new Error("demo booking page needs an activity type");
  const publicId = randomBytes(12).toString("base64url");
  const rows = await db.q<{ id: string }>(
    `INSERT INTO booking_pages
       (public_id, host_id, title, description, duration_minutes, buffer_minutes, min_notice_hours,
        days_ahead, timezone, availability, activity_type_id, location, active)
     VALUES ($1, $2, $3, $4, 30, 0, 4, 30, 'Europe/London', $5::jsonb, $6, 'Video call', true)
     RETURNING id`,
    [
      publicId,
      ownerId,
      PAGE_TITLE,
      "A 30 minute introduction call.",
      JSON.stringify(AVAILABILITY),
      activityTypeId,
    ],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("demo booking page insert returned no row");
  return id;
}

async function insertBooking(db: Db, pageId: string, ownerId: string): Promise<number> {
  const activityTypeId = await meetingTypeId(db);
  if (activityTypeId === null) return 0;

  const today = utcToZoned(new Date(), "Europe/London").date;
  const day = addDays(today, 3);
  const start = zonedToUtc(day, "10:00", "Europe/London");
  const end = new Date(start.getTime() + 30 * 60_000);
  const visitorName = "Riley Chen";
  const visitorEmail = VISITOR_EMAILS[0] ?? "riley.chen@example.com";
  const personId = await insertPerson(db, ownerId, visitorName, visitorEmail);

  const activities = await db.q<{ id: string }>(
    `INSERT INTO activities
       (type_id, subject, due_at, end_at, duration_minutes, owner_id, assignee_id, person_id, location)
     VALUES ($1, $2, $3, $4, 30, $5, $5, $6, 'Video call')
     RETURNING id`,
    [activityTypeId, `${PAGE_TITLE} with ${visitorName}`, start, end, ownerId, personId],
  );
  const activityId = activities[0]?.id;
  if (activityId === undefined) return 0;

  const cancelToken = randomBytes(24).toString("base64url");
  const cancelHash = createHash("sha256").update(cancelToken).digest("hex");
  await db.q(
    `INSERT INTO bookings
       (page_id, activity_id, person_id, start_at, end_at, visitor_name, visitor_email,
        cancel_token_hash, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'booked')`,
    [pageId, activityId, personId, start, end, visitorName, visitorEmail, cancelHash],
  );
  return 1;
}
