import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { users } from "./identity";
import { stages } from "./stages";

// Part 3 sales model: product catalog, deal lines, per-deal currency and
// probability, stage probabilities and manual exchange rates. Kept in side
// tables so upstream tables change as little as possible.

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Optional human SKU; unique only when present (partial index below).
    code: text("code"),
    unit: text("unit"),
    // Money and percent are numeric so Postgres never sees a float.
    price: numeric("price", { precision: 14, scale: 2 }).notNull().default("0"),
    currency: char("currency", { length: 3 }).notNull(),
    taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    // Archived products stay readable but cannot be added to new lines.
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("products_code_uq").on(t.code).where(sql`${t.code} is not null`),
    check("products_price_ck", sql`${t.price} >= 0`),
    check("products_tax_percent_ck", sql`${t.taxPercent} between 0 and 100`),
  ],
);

export const dealProducts = pgTable(
  "deal_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    // A product used on a deal cannot be deleted; archive it instead.
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    // 1-based order of the lines as the UI shows them.
    position: integer("position").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    // Item price is in the deal's currency; conversion happens at add time.
    itemPrice: numeric("item_price", { precision: 14, scale: 2 }).notNull(),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    comments: text("comments"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("deal_products_deal_position_idx").on(t.dealId, t.position),
    check("deal_products_quantity_ck", sql`${t.quantity} > 0`),
    check("deal_products_item_price_ck", sql`${t.itemPrice} >= 0`),
    check("deal_products_discount_percent_ck", sql`${t.discountPercent} between 0 and 100`),
    check("deal_products_tax_percent_ck", sql`${t.taxPercent} between 0 and 100`),
  ],
);

export const dealTerms = pgTable(
  "deal_terms",
  {
    dealId: uuid("deal_id")
      .primaryKey()
      .references(() => deals.id, { onDelete: "cascade" }),
    // A deal with no row is in the base currency (see the deals.value comment).
    currency: char("currency", { length: 3 }).notNull(),
    // Null means "use the stage's probability, then 100".
    probability: integer("probability"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("deal_terms_probability_ck", sql`${t.probability} between 0 and 100`)],
);

export const stageProbabilities = pgTable(
  "stage_probabilities",
  {
    stageId: uuid("stage_id")
      .primaryKey()
      .references(() => stages.id, { onDelete: "cascade" }),
    probability: integer("probability").notNull(),
  },
  (t) => [check("stage_probabilities_probability_ck", sql`${t.probability} between 0 and 100`)],
);

export const currencyRates = pgTable(
  "currency_rates",
  {
    // Base currency is not stored here; it always has a rate of 1.
    code: char("code", { length: 3 }).primaryKey(),
    // How many base units one unit of this code is worth, scaled by 1e8.
    rateToBase: numeric("rate_to_base", { precision: 18, scale: 8 }).notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("currency_rates_rate_ck", sql`${t.rateToBase} > 0`)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type DealProduct = typeof dealProducts.$inferSelect;
export type NewDealProduct = typeof dealProducts.$inferInsert;
export type DealTerms = typeof dealTerms.$inferSelect;
export type StageProbability = typeof stageProbabilities.$inferSelect;
export type CurrencyRate = typeof currencyRates.$inferSelect;
