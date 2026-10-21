import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";

// Part 8 REST API tokens. The plain token is returned once, at creation; only the SHA-256 hex and
// an 8-character display prefix are stored, and authentication is a hash lookup.

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    scope: text("scope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("api_tokens_user_idx").on(t.userId),
    check("api_tokens_name_ck", sql`char_length(${t.name}) between 1 and 80`),
    check("api_tokens_scope_ck", sql`${t.scope} in ('read','write')`),
  ],
);

export type ApiToken = typeof apiTokens.$inferSelect;
