import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { users } from "./identity";

// Part 4 quotes and invoices. One `documents` row per quote or invoice, with
// shared snapshot lines and hand-recorded payments. Kept in side tables so
// upstream tables change as little as possible.

// A single settings row: the boolean primary key defaults true and the check
// keeps it true, so no second row can ever be inserted.
export const documentSettings = pgTable(
  "document_settings",
  {
    id: boolean("id").primaryKey().default(true),
    quotePrefix: text("quote_prefix").notNull().default("Q"),
    invoicePrefix: text("invoice_prefix").notNull().default("INV"),
    quoteValidDays: integer("quote_valid_days").notNull().default(30),
    invoiceDueDays: integer("invoice_due_days").notNull().default(14),
    companyName: text("company_name"),
    companyAddress: text("company_address"),
    companyTaxId: text("company_tax_id"),
    paymentInstructions: text("payment_instructions"),
    footer: text("footer"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("document_settings_singleton_ck", sql`${t.id}`),
    // Prefixes feed the printed number, so only short alphanumerics are allowed.
    check("document_settings_quote_prefix_ck", sql`${t.quotePrefix} ~ '^[A-Z0-9]{1,8}$'`),
    check("document_settings_invoice_prefix_ck", sql`${t.invoicePrefix} ~ '^[A-Z0-9]{1,8}$'`),
    check("document_settings_quote_valid_days_ck", sql`${t.quoteValidDays} between 1 and 365`),
    check("document_settings_invoice_due_days_ck", sql`${t.invoiceDueDays} between 1 and 365`),
  ],
);

export const documentTemplates = pgTable(
  "document_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Text plus a check rather than a pg enum: 6.4 fixes the two kinds and a
    // check is what the contract names.
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    body: text("body").notNull(),
    terms: text("terms"),
    includeProducts: boolean("include_products").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Exactly one default per kind; a plain unique index would forbid the
    // (many) non-default rows.
    uniqueIndex("document_templates_default_uq").on(t.kind).where(sql`${t.isDefault}`),
    check("document_templates_kind_ck", sql`${t.kind} in ('quote', 'invoice')`),
    check("document_templates_body_ck", sql`char_length(${t.body}) <= 20000`),
    check("document_templates_terms_ck", sql`char_length(${t.terms}) <= 5000`),
  ],
);

// Gap-free numbering: the counter row is the only source of the sequence, and
// issue takes it with an INSERT ... ON CONFLICT DO UPDATE so two concurrent
// issues can never pick the same number.
export const documentCounters = pgTable(
  "document_counters",
  {
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.kind, t.year] }),
    check("document_counters_kind_ck", sql`${t.kind} in ('quote', 'invoice')`),
    check("document_counters_last_number_ck", sql`${t.lastNumber} >= 1`),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    // A deal cannot be hard-deleted while a document references it; warpdrive
    // soft-deletes deals, and the public page filters those out itself.
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "restrict" }),
    templateId: uuid("template_id").references(() => documentTemplates.id, {
      onDelete: "set null",
    }),
    // Invoice created from an accepted quote. The AnyPgColumn annotation is
    // the documented escape for a self-referencing column, without which the
    // table type recursively references its own initializer.
    sourceQuoteId: uuid("source_quote_id").references((): AnyPgColumn => documents.id, {
      onDelete: "set null",
    }),
    // Opaque public link key; never the sequential number.
    publicId: text("public_id").notNull().unique(),
    number: text("number").unique(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Money is numeric, never a float, and has already been computed on minor
    // units when this row is written.
    currency: char("currency", { length: 3 }).notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 14, scale: 2 }).notNull(),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    status: text("status").notNull().default("draft"),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerAddress: text("customer_address"),
    issueDate: date("issue_date"),
    validUntil: date("valid_until"),
    dueDate: date("due_date"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    acceptedName: text("accepted_name"),
    acceptedIp: text("accepted_ip"),
    declineReason: text("decline_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("documents_deal_idx").on(t.dealId),
    index("documents_kind_status_idx").on(t.kind, t.status),
    index("documents_due_date_idx").on(t.dueDate).where(sql`${t.kind} = 'invoice'`),
    check("documents_kind_ck", sql`${t.kind} in ('quote', 'invoice')`),
    check(
      "documents_status_ck",
      sql`${t.status} in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'overdue', 'paid', 'void')`,
    ),
    check("documents_title_ck", sql`char_length(${t.title}) between 1 and 150`),
    check("documents_decline_reason_ck", sql`char_length(${t.declineReason}) <= 500`),
  ],
);

export const documentLines = pgTable(
  "document_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    unit: text("unit"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    itemPrice: numeric("item_price", { precision: 14, scale: 2 }).notNull(),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull(),
    taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull(),
    // Line math is stored too: the document totals never re-derive from a
    // later product change.
    net: numeric("net", { precision: 14, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 14, scale: 2 }).notNull(),
    gross: numeric("gross", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    index("document_lines_document_position_idx").on(t.documentId, t.position),
    check("document_lines_quantity_ck", sql`${t.quantity} > 0`),
    check("document_lines_item_price_ck", sql`${t.itemPrice} >= 0`),
    check("document_lines_discount_percent_ck", sql`${t.discountPercent} between 0 and 100`),
    check("document_lines_tax_percent_ck", sql`${t.taxPercent} between 0 and 100`),
  ],
);

export const documentPayments = pgTable(
  "document_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paidOn: date("paid_on").notNull(),
    method: text("method").notNull(),
    reference: text("reference"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("document_payments_document_idx").on(t.documentId),
    check("document_payments_amount_ck", sql`${t.amount} > 0`),
    check(
      "document_payments_method_ck",
      sql`${t.method} in ('bank_transfer', 'card', 'cash', 'other')`,
    ),
  ],
);

export type DocumentSettingsRow = typeof documentSettings.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type NewDocumentTemplate = typeof documentTemplates.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentLine = typeof documentLines.$inferSelect;
export type NewDocumentLine = typeof documentLines.$inferInsert;
export type DocumentPayment = typeof documentPayments.$inferSelect;
export type NewDocumentPayment = typeof documentPayments.$inferInsert;
