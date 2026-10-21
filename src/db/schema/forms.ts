import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { activities } from "./activities";
import { activityTypes } from "./activityTypes";
import { deals } from "./deals";
import { users } from "./identity";
import { leads } from "./leads";
import { persons } from "./persons";
import { pipelines } from "./pipelines";
import { stages } from "./stages";

// Part 6 public web forms and booking pages. Everything lives in new tables so the upstream
// schema stays untouched: a form is a definition plus its submissions, and a booking is an
// activity with the visitor's answers recorded alongside it.

export const webForms = pgTable(
  "web_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 12 random bytes base64url, so the public URL leaks no sequence and needs no auth.
    publicId: text("public_id").notNull().unique(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    // An ordered FormField[]; validated by the forms feature, not by the column.
    fields: jsonb("fields").notNull(),
    creates: text("creates").notNull(),
    // A deal form needs both, and they are validated to belong together in the service.
    pipelineId: uuid("pipeline_id").references(() => pipelines.id, { onDelete: "set null" }),
    stageId: uuid("stage_id").references(() => stages.id, { onDelete: "set null" }),
    // Records are created as this user, so no form can outlive the person who owns it.
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    successMessage: text("success_message").notNull().default("Thanks, we will be in touch."),
    redirectUrl: text("redirect_url"),
    active: boolean("active").notNull().default(true),
    submissionCount: integer("submission_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("web_forms_name_ck", sql`char_length(${t.name}) between 1 and 120`),
    check("web_forms_title_ck", sql`char_length(${t.title}) between 1 and 150`),
    check("web_forms_description_ck", sql`char_length(${t.description}) <= 1000`),
    check("web_forms_creates_ck", sql`${t.creates} in ('lead', 'deal')`),
    check("web_forms_redirect_url_ck", sql`${t.redirectUrl} is null or ${t.redirectUrl} ~ '^https://'`),
  ],
);

export const webFormSubmissions = pgTable(
  "web_form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => webForms.id, { onDelete: "cascade" }),
    values: jsonb("values").notNull(),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("web_form_submissions_form_idx").on(t.formId, t.createdAt.desc())],
);

export const bookingPages = pgTable(
  "booking_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull().unique(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    minNoticeHours: integer("min_notice_hours").notNull().default(4),
    daysAhead: integer("days_ahead").notNull().default(30),
    // The page's zone; the host's profile preference wins when it is set.
    timezone: text("timezone").notNull(),
    // An Availability record (per-weekday ranges); validated by the scheduling feature.
    availability: jsonb("availability").notNull(),
    activityTypeId: uuid("activity_type_id")
      .notNull()
      .references(() => activityTypes.id, { onDelete: "restrict" }),
    location: text("location"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("booking_pages_title_ck", sql`char_length(${t.title}) between 1 and 120`),
    check("booking_pages_description_ck", sql`char_length(${t.description}) <= 1000`),
    check("booking_pages_duration_ck", sql`${t.durationMinutes} between 15 and 240`),
    check("booking_pages_buffer_ck", sql`${t.bufferMinutes} between 0 and 120`),
    check("booking_pages_notice_ck", sql`${t.minNoticeHours} between 0 and 168`),
    check("booking_pages_days_ahead_ck", sql`${t.daysAhead} between 1 and 90`),
    check("booking_pages_location_ck", sql`char_length(${t.location}) <= 300`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => bookingPages.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id").references(() => activities.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    visitorName: text("visitor_name").notNull(),
    visitorEmail: text("visitor_email").notNull(),
    note: text("note"),
    // Only the SHA-256 hex of the cancel token is stored, so a database read cannot cancel.
    cancelTokenHash: text("cancel_token_hash").notNull().unique(),
    status: text("status").notNull().default("booked"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_page_start_idx").on(t.pageId, t.startAt),
    check("bookings_status_ck", sql`${t.status} in ('booked', 'cancelled')`),
    check("bookings_visitor_name_ck", sql`char_length(${t.visitorName}) between 1 and 100`),
    check("bookings_note_ck", sql`char_length(${t.note}) <= 1000`),
    check("bookings_span_ck", sql`${t.endAt} > ${t.startAt}`),
  ],
);

export type WebForm = typeof webForms.$inferSelect;
export type NewWebForm = typeof webForms.$inferInsert;
export type WebFormSubmission = typeof webFormSubmissions.$inferSelect;
export type BookingPage = typeof bookingPages.$inferSelect;
export type NewBookingPage = typeof bookingPages.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
