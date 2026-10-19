import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { users } from "./identity";

export interface AiToolCallRecord {
  id: string;
  name: string;
  arguments: string;
}
export interface DealSummaryData {
  summary: string;
  health: "good" | "at_risk" | "stalled";
  risks: string[];
  nextSteps: { subject: string; typeKey: string; dueInDays: number }[];
}
export const aiActionStatus = pgEnum("ai_action_status", [
  "pending",
  "confirmed",
  "rejected",
  "failed",
]);

export const aiSettings = pgTable(
  "ai_settings",
  {
    id: boolean("id").primaryKey().default(true),
    enabled: boolean("enabled").notNull().default(true),
    companyMonthlyTokenLimit: integer("company_monthly_token_limit").notNull().default(2_000_000),
    userMonthlyTokenLimit: integer("user_monthly_token_limit"), // null = no per-user cap
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("ai_settings_singleton", sql`${t.id} = true`)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id), // null for future system callers (automations)
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_usage_created_idx").on(t.createdAt),
    index("ai_usage_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(), // total order inside a conversation
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<"user" | "assistant" | "tool">(),
    content: text("content"),
    toolCalls: jsonb("tool_calls").$type<AiToolCallRecord[]>(),
    toolCallId: text("tool_call_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.seq)],
);

export const aiActions = pgTable(
  "ai_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    args: jsonb("args").notNull(),
    summary: text("summary").notNull(),
    status: aiActionStatus("status").notNull().default("pending"),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("ai_actions_conversation_idx").on(t.conversationId, t.seq)],
);

export const dealAiInsights = pgTable("deal_ai_insights", {
  dealId: uuid("deal_id")
    .primaryKey()
    .references(() => deals.id, { onDelete: "cascade" }),
  summary: jsonb("summary").$type<DealSummaryData>(),
  summaryAt: timestamp("summary_at", { withTimezone: true }),
  score: integer("score"),
  scoreReasons: jsonb("score_reasons").$type<string[]>(),
  scoredAt: timestamp("scored_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
