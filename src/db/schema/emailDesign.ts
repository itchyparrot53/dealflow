import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

// Part 13: the company's email identity (one row) and the per-template overrides. The singleton is
// enforced by CHECK (id = 1); the migration seeds it so reads never have to create it.

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const emailDesign = pgTable(
  "email_design",
  {
    id: smallint("id").primaryKey().default(1),
    displayName: text("display_name"),
    accentColor: text("accent_color").notNull().default("#2D8548"),
    showAddress: boolean("show_address").notNull().default(true),
    footerText: text("footer_text"),
    showPoweredBy: boolean("show_powered_by").notNull().default(false),
    newEmailLayout: text("new_email_layout").notNull().default("branded"),
    replyLayout: text("reply_layout").notNull().default("minimal"),
    footerOnReplies: boolean("footer_on_replies").notNull().default(false),
    logoBytes: bytea("logo_bytes"),
    logoMime: text("logo_mime"),
    logoHash: text("logo_hash"),
    logoWidth: integer("logo_width"),
    logoHeight: integer("logo_height"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("email_design_singleton_ck", sql`${t.id} = 1`),
    check("email_design_accent_ck", sql`${t.accentColor} ~ '^#[0-9A-Fa-f]{6}$'`),
    check("email_design_new_layout_ck", sql`${t.newEmailLayout} in ('branded','plain')`),
    check("email_design_reply_layout_ck", sql`${t.replyLayout} in ('minimal','branded','plain')`),
    check("email_design_logo_mime_ck", sql`${t.logoMime} in ('image/png','image/jpeg')`),
  ],
);

export const emailTemplateOverrides = pgTable("email_template_overrides", {
  key: text("key").primaryKey(),
  subject: text("subject").notNull(),
  preheader: text("preheader"),
  bodyHtml: text("body_html").notNull(),
  ctaLabel: text("cta_label"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailDesignRow = typeof emailDesign.$inferSelect;
export type EmailTemplateOverrideRow = typeof emailTemplateOverrides.$inferSelect;
