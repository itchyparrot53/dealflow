import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import { aiActions, aiMessages, deals, notes } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { HydratedActor } from "@/server/hydrateActor";
import { makeTestDb, type TestDb } from "@/test/db";
import { setAiProviderForTest } from "../provider";
import { ScriptedAiProvider } from "../scriptedProvider";
import { confirmAiAction, rejectAiAction, sendAssistantMessage } from "./assistant";
import { createConversation } from "./conversations";

let h: TestDb;
const SIG = (): AbortSignal => AbortSignal.timeout(10_000);
let provider: ScriptedAiProvider;

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
  provider = new ScriptedAiProvider();
  setAiProviderForTest(provider);
});
afterEach(() => {
  setAiProviderForTest(undefined);
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

function toolCall(name: string, args: unknown) {
  return {
    content: null,
    toolCalls: [{ id: "call-1", name, arguments: JSON.stringify(args) }],
  };
}

describe("sendAssistantMessage", () => {
  test("stores a plain answer and titles the conversation from the first message", async () => {
    const { owner } = await seedDeal();
    const actor = actorFor(owner, "admin");
    const conversationId = await createConversation(h.db, actor.id, SIG());
    provider.push({ content: "Hello there" });

    const result = await sendAssistantMessage(h.db, actor, conversationId, "Hi", SIG());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe("Hi");
    expect(
      result.value.items.some((item) => item.kind === "message" && item.content === "Hello there"),
    ).toBe(true);
  });

  test("sends a read tool result back to the provider", async () => {
    const { owner } = await seedDeal();
    const actor = actorFor(owner, "admin");
    const conversationId = await createConversation(h.db, actor.id, SIG());
    provider.push(toolCall("search", { q: "big" }), { content: "Found it" });

    const result = await sendAssistantMessage(h.db, actor, conversationId, "find big", SIG());
    expect(result.ok).toBe(true);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]?.messages.some((message) => message.role === "tool")).toBe(true);
  });

  test("a write tool creates a pending action and no note", async () => {
    const { deal, owner } = await seedDeal();
    const actor = actorFor(owner, "admin");
    const conversationId = await createConversation(h.db, actor.id, SIG());
    provider.push(
      toolCall("add_note", { entityType: "deal", entityId: deal.id, body: "Assistant note" }),
      { content: "Proposed it" },
    );

    const result = await sendAssistantMessage(h.db, actor, conversationId, "note it", SIG());
    expect(result.ok).toBe(true);
    const actions = await h.db.select().from(aiActions);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.status).toBe("pending");
    expect(await h.db.select().from(notes)).toHaveLength(0);
    if (result.ok) {
      expect(actions[0]?.summary).toBe('Add note: "Assistant note"');
      expect(
        result.value.items.some((item) => item.kind === "action" && item.status === "pending"),
      ).toBe(true);
    }
  });

  test("invalid arguments return an error tool result and create no action", async () => {
    const { owner } = await seedDeal();
    const actor = actorFor(owner, "admin");
    const conversationId = await createConversation(h.db, actor.id, SIG());
    provider.push(toolCall("add_note", {}), { content: "Try again" });

    await sendAssistantMessage(h.db, actor, conversationId, "bad args", SIG());
    expect(await h.db.select().from(aiActions)).toHaveLength(0);
    const toolRow = (await h.db.select().from(aiMessages)).find((row) => row.role === "tool");
    expect(toolRow?.content).toContain("Invalid arguments");
  });

  test("a tool outside the allow-list returns Unknown tool", async () => {
    const { owner } = await seedDeal();
    const actor = actorFor(owner, "admin");
    const conversationId = await createConversation(h.db, actor.id, SIG());
    provider.push(toolCall("delete_email_draft", {}), { content: "No" });

    await sendAssistantMessage(h.db, actor, conversationId, "delete it", SIG());
    const toolRow = (await h.db.select().from(aiMessages)).find((row) => row.role === "tool");
    expect(toolRow?.content).toContain("Unknown tool");
  });

  test("six tool-calling replies end with the step-limit message", async () => {
    const { owner } = await seedDeal();
    const actor = actorFor(owner, "admin");
    const conversationId = await createConversation(h.db, actor.id, SIG());
    for (let i = 0; i < 6; i++) provider.push(toolCall("search", { q: "loop" }));

    const result = await sendAssistantMessage(h.db, actor, conversationId, "loop", SIG());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.items.some(
        (item) =>
          item.kind === "message" &&
          item.content ===
            "I couldn't finish that within the step limit. Try a more specific request.",
      ),
    ).toBe(true);
  });
});

describe("confirm and reject", () => {
  async function pendingActionFor() {
    const { deal, owner } = await seedDeal();
    const actor = actorFor(owner, "admin");
    const conversationId = await createConversation(h.db, actor.id, SIG());
    provider.push(
      toolCall("add_note", { entityType: "deal", entityId: deal.id, body: "Assistant note E2E" }),
      { content: "Proposed it" },
    );
    await sendAssistantMessage(h.db, actor, conversationId, "note it", SIG());
    const [action] = await h.db.select().from(aiActions);
    if (action === undefined) throw new Error("no pending action");
    return { action, actor, deal };
  }

  test("confirming creates the note and records Done", async () => {
    const { action, actor } = await pendingActionFor();
    const result = await confirmAiAction(h.db, actor, action.id, SIG());
    expect(result.ok).toBe(true);
    const rows = await h.db.select().from(aiActions);
    expect(rows[0]?.status).toBe("confirmed");
    const noteRows = await h.db.select().from(notes);
    expect(noteRows[0]?.body).toBe("Assistant note E2E");
    if (result.ok) {
      expect(
        result.value.items.some(
          (item) => item.kind === "message" && item.content.startsWith("Done: "),
        ),
      ).toBe(true);
    }
  });

  test("another user cannot confirm someone else's action", async () => {
    const { action, deal } = await pendingActionFor();
    const stranger = await seedUser(h.db, { email: `stranger-${Date.now()}@example.com` });
    const result = await confirmAiAction(h.db, actorFor(stranger, "regular"), action.id, SIG());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_ACTION_NOT_FOUND);
    const [stored] = await h.db.select().from(aiActions);
    expect(stored?.status).toBe("pending");
    expect(deal.id).toBeTruthy();
  });

  test("rejecting cancels the action without creating the note", async () => {
    const { action, actor } = await pendingActionFor();
    const result = await rejectAiAction(h.db, actor, action.id, SIG());
    expect(result.ok).toBe(true);
    const [stored] = await h.db.select().from(aiActions);
    expect(stored?.status).toBe("rejected");
    expect(await h.db.select().from(notes)).toHaveLength(0);
    if (result.ok) {
      expect(
        result.value.items.some(
          (item) => item.kind === "message" && item.content.startsWith("Cancelled: "),
        ),
      ).toBe(true);
    }
  });
});
