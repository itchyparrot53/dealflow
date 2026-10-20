import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import { aiActions, aiConversations, deals, notes } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { HydratedActor } from "@/server/hydrateActor";
import { makeTestDb, type TestDb } from "@/test/db";
import { confirmAiAction } from "./assistant/assistant";
import { createConversation } from "./assistant/conversations";

let h: TestDb;
const SIG = (): AbortSignal => AbortSignal.timeout(10_000);

beforeAll(async () => {
  h = await makeTestDb();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.db.execute(
    sql`TRUNCATE ai_actions, ai_messages, ai_conversations, ai_usage, ai_settings, notes, activities, activity_types, deal_ai_insights, deal_followers, deal_participants, deals, stages, pipelines, visibility_group_members, visibility_groups, users, permission_sets, settings, audit_events RESTART IDENTITY CASCADE`,
  );
});

function actorFor(
  user: { id: string; name: string; email: string },
  type: "admin" | "regular",
): HydratedActor {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: null,
    type,
    isActive: true,
    groupIds: new Set<string>(),
    flags: new Set<PermissionFlagKey>(),
  };
}

async function seedDeal() {
  const owner = await seedUser(h.db, { email: `owner-${Date.now()}@example.com`, name: "Owner" });
  const { pipeline, stages } = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  const [deal] = await h.db
    .insert(deals)
    .values({
      title: "Big deal",
      pipelineId: pipeline.id,
      stageId: stages[0]?.id ?? "",
      ownerId: owner.id,
      visibilityLevel: "all",
      status: "open",
    })
    .returning();
  if (deal === undefined) throw new Error("deal fixture failed");
  return { deal, owner };
}

async function pendingAddNoteAction() {
  const { deal, owner } = await seedDeal();
  const actor = actorFor(owner, "admin");
  const conversationId = await createConversation(h.db, actor.id, SIG());
  const [action] = await h.db
    .insert(aiActions)
    .values({
      conversationId,
      userId: actor.id,
      tool: "add_note",
      args: { entityType: "deal", entityId: deal.id, body: "R1 concurrent note" },
      summary: 'Add note: "R1 concurrent note"',
      status: "pending",
    })
    .returning();
  if (action === undefined) throw new Error("action fixture failed");
  return { action, actor, conversationId, deal };
}

describe("R1: assistant confirm claims the action before running the write", () => {
  test("two concurrent confirms create exactly one note", async () => {
    const { action, actor } = await pendingAddNoteAction();
    // Warm two pool connections first: with a cold pool the first confirm can finish before the
    // second one's connection is established, which hides the race instead of exercising it.
    await Promise.all([h.db.execute(sql`select 1`), h.db.execute(sql`select 1`)]);

    const [first, second] = await Promise.all([
      confirmAiAction(h.db, actor, action.id, SIG()),
      confirmAiAction(h.db, actor, action.id, SIG()),
    ]);

    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
    const rejected = [first, second].find((result) => !result.ok);
    expect(rejected?.ok === false ? rejected.error.id : null).toBe(ERROR_IDS.AI_ACTION_NOT_FOUND);
    const noteRows = await h.db.select().from(notes);
    expect(noteRows).toHaveLength(1);
    expect(noteRows[0]?.body).toBe("R1 concurrent note");
    const [stored] = await h.db.select().from(aiActions);
    expect(stored?.status).toBe("confirmed");
  });

  test("a second confirm after the first one finished is refused", async () => {
    const { action, actor, conversationId } = await pendingAddNoteAction();
    const first = await confirmAiAction(h.db, actor, action.id, SIG());
    expect(first.ok).toBe(true);
    const second = await confirmAiAction(h.db, actor, action.id, SIG());
    expect(second.ok).toBe(false);
    const conversations = await h.db.select().from(aiConversations);
    expect(conversations.map((row) => row.id)).toContain(conversationId);
    const noteRows = await h.db.select().from(notes);
    expect(noteRows).toHaveLength(1);
  });
});
