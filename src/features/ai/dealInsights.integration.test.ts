import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { PermissionFlagKey } from "@/constants/permissionFlags";
import { activityTypes, aiUsage, dealAiInsights, deals } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { HydratedActor } from "@/server/hydrateActor";
import { makeTestDb, type TestDb } from "@/test/db";
import { readDealAiInsight, scoreDeal, summarizeDeal } from "./dealInsights";
import { setAiProviderForTest } from "./provider";
import { ScriptedAiProvider } from "./scriptedProvider";

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
    sql`TRUNCATE deal_ai_insights, ai_usage, ai_settings, activity_guests, activity_participants, activities, activity_types, notes, deal_followers, deal_participants, deals, stages, pipelines, visibility_group_members, visibility_groups, users, permission_sets, settings, audit_events RESTART IDENTITY CASCADE`,
  );
  // The truncated catalog is reseeded with the two types these tests name; migrations seed the
  // full system set in a real database.
  await h.db.insert(activityTypes).values([
    { key: "call", name: "Call", order: 0 },
    { key: "task", name: "Task", order: 1 },
  ]);
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

async function seedDeal(visibilityLevel: "owner" | "group" | "all") {
  const owner = await seedUser(h.db, { email: `owner-${Date.now()}@example.com`, name: "Owner" });
  const { pipeline, stages } = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  const [deal] = await h.db
    .insert(deals)
    .values({
      title: "Big deal",
      pipelineId: pipeline.id,
      stageId: stages[0]?.id ?? "",
      ownerId: owner.id,
      visibilityLevel,
      status: "open",
      value: "1000",
    })
    .returning();
  if (deal === undefined) throw new Error("deal fixture failed");
  return { deal, owner };
}

describe("summarizeDeal", () => {
  test("stores the summary, fixes up the model output and logs usage", async () => {
    const { deal, owner } = await seedDeal("all");
    const actor = actorFor(owner, "admin");
    provider.push({
      content: JSON.stringify({
        summary: "A solid deal.",
        health: "at_risk",
        risks: ["r1", "r2", "r3", "r4", "r5"],
        nextSteps: [
          { subject: "Call", typeKey: "nope", dueInDays: 99 },
          { subject: "S2", typeKey: "call", dueInDays: 2 },
          { subject: "S3", typeKey: "call", dueInDays: 3 },
          { subject: "S4", typeKey: "call", dueInDays: 4 },
        ],
      }),
    });

    const result = await summarizeDeal(h.db, actor, deal.id, SIG());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary?.summary).toBe("A solid deal.");
    expect(result.value.summary?.risks).toHaveLength(3);
    expect(result.value.summary?.nextSteps).toHaveLength(3);
    expect(result.value.summary?.nextSteps[0]?.typeKey).toBe("task");
    expect(result.value.summary?.nextSteps[0]?.dueInDays).toBe(30);
    expect(result.value.summaryAt).not.toBeNull();

    const stored = await readDealAiInsight(h.db, deal.id, SIG());
    expect(stored?.summary?.summary).toBe("A solid deal.");
    const usage = await h.db.select().from(aiUsage);
    expect(usage).toHaveLength(1);
    expect(usage[0]?.feature).toBe("deal_summary");
    // The prompt carries the active type keys.
    expect(provider.calls[0]?.messages[0]?.content).toContain("call");
  });

  test("returns a provider failure without writing an insight", async () => {
    const { deal, owner } = await seedDeal("all");
    const actor = actorFor(owner, "admin");
    provider.push(new AppError(ERROR_IDS.AI_PROVIDER_FAILED, "provider down"));

    const result = await summarizeDeal(h.db, actor, deal.id, SIG());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_PROVIDER_FAILED);
    expect(await h.db.select().from(dealAiInsights)).toHaveLength(0);
  });
});

describe("scoreDeal", () => {
  test("clamps the score to 100, slices the reasons and logs usage", async () => {
    const { deal, owner } = await seedDeal("all");
    const actor = actorFor(owner, "admin");
    provider.push({
      content: JSON.stringify({
        score: 140,
        reasons: ["a", "b", "c", "d", "e", "f"],
      }),
    });

    const result = await scoreDeal(h.db, actor, deal.id, SIG());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.score).toBe(100);
    expect(result.value.scoreReasons).toHaveLength(4);
    expect(result.value.scoredAt).not.toBeNull();

    const usage = await h.db.select().from(aiUsage);
    expect(usage).toHaveLength(1);
    expect(usage[0]?.feature).toBe("deal_score");
  });
});

describe("visibility", () => {
  test("refuses an invisible deal before any provider call", async () => {
    const { deal } = await seedDeal("owner");
    const stranger = await seedUser(h.db, { email: `stranger-${Date.now()}@example.com` });
    const actor = actorFor(stranger, "regular");

    const result = await summarizeDeal(h.db, actor, deal.id, SIG());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.DEAL_NOT_FOUND);
    expect(provider.calls).toHaveLength(0);
    expect(await h.db.select().from(aiUsage)).toHaveLength(0);
  });
});
