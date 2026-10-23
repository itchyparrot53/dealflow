import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import { aiUsage, users } from "@/db/schema";
import { makeTestDb, type TestDb } from "@/test/db";
import { updateAiSettings } from "./aiSettings";
import { setAiProviderForTest } from "./provider";
import { ScriptedAiProvider } from "./scriptedProvider";
import { assertAiAllowed, getUsage, monthStartUtc, recordAiUsage } from "./usage";

let h: TestDb;
const SIG = (): AbortSignal => AbortSignal.timeout(8_000);

beforeAll(async () => {
  h = await makeTestDb();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.db.execute(
    sql`TRUNCATE ai_usage, ai_settings, visibility_group_members, visibility_groups, sessions, users, permission_sets, settings, audit_events RESTART IDENTITY CASCADE`,
  );
  setAiProviderForTest(new ScriptedAiProvider());
});
afterEach(() => {
  setAiProviderForTest(undefined);
});

async function makeUser(email: string): Promise<string> {
  const [row] = await h.db
    .insert(users)
    .values({ email, name: email.split("@")[0] ?? email })
    .returning({ id: users.id });
  if (row === undefined) throw new Error("user fixture failed");
  return row.id;
}

async function makeSettings(
  over: Partial<{
    enabled: boolean;
    companyMonthlyTokenLimit: number;
    userMonthlyTokenLimit: number | null;
  }> = {},
): Promise<void> {
  await updateAiSettings(
    h.db,
    {
      enabled: true,
      companyMonthlyTokenLimit: 2_000_000,
      userMonthlyTokenLimit: null,
      ...over,
    },
    SIG(),
  );
}

async function addUsage(
  userId: string | null,
  feature: string,
  prompt: number,
  completion: number,
  at?: Date,
): Promise<void> {
  await h.db.insert(aiUsage).values({
    userId,
    feature,
    model: "test/model",
    promptTokens: prompt,
    completionTokens: completion,
    ...(at === undefined ? {} : { createdAt: at }),
  });
}

describe("assertAiAllowed", () => {
  test("E_AI_001 when no provider is configured", async () => {
    setAiProviderForTest(null);
    const result = await assertAiAllowed(h.db, "user-1", SIG());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_UNAVAILABLE);
  });

  test("E_AI_002 when the company switched AI off", async () => {
    await makeSettings({ enabled: false });
    const result = await assertAiAllowed(h.db, "user-1", SIG());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_DISABLED);
  });

  test("E_AI_003 when the company has used its monthly cap", async () => {
    await makeSettings({ companyMonthlyTokenLimit: 100 });
    const userId = await makeUser("company@example.com");
    await addUsage(userId, "assistant", 60, 50);
    const result = await assertAiAllowed(h.db, userId, SIG());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AI_COMPANY_LIMIT);
  });

  test("E_AI_004 applies per user while another user is still allowed", async () => {
    await makeSettings({ userMonthlyTokenLimit: 100 });
    const heavy = await makeUser("heavy@example.com");
    const fresh = await makeUser("fresh@example.com");
    await addUsage(heavy, "assistant", 100, 50);

    const blocked = await assertAiAllowed(h.db, heavy, SIG());
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.id).toBe(ERROR_IDS.AI_USER_LIMIT);

    const allowed = await assertAiAllowed(h.db, fresh, SIG());
    expect(allowed.ok).toBe(true);
  });

  test("usage from the previous month does not count", async () => {
    await makeSettings({ companyMonthlyTokenLimit: 100 });
    const userId = await makeUser("lastmonth@example.com");
    const lastMonth = new Date(monthStartUtc().getTime() - 1);
    await addUsage(userId, "assistant", 500, 500, lastMonth);
    const result = await assertAiAllowed(h.db, userId, SIG());
    expect(result.ok).toBe(true);
  });
});

describe("getUsage and recordAiUsage", () => {
  test("sums tokens by feature and by user for the current month", async () => {
    const ana = await makeUser("ana@example.com");
    const ben = await makeUser("ben@example.com");
    await addUsage(ana, "assistant", 10, 5);
    await addUsage(ana, "deal_summary", 20, 5);
    await addUsage(ben, "assistant", 7, 3);

    const usage = await getUsage(h.db, SIG());
    expect(usage.companyUsed).toBe(50);
    expect(usage.byFeature).toEqual([
      { feature: "assistant", tokens: 25 },
      { feature: "deal_summary", tokens: 25 },
    ]);
    expect(usage.byUser).toEqual([
      { userId: ana, name: "ana", tokens: 40 },
      { userId: ben, name: "ben", tokens: 10 },
    ]);
  });

  test("recordAiUsage writes one row with the provider's model and tokens", async () => {
    const userId = await makeUser("rec@example.com");
    await recordAiUsage(
      h.db,
      {
        userId,
        feature: "deal_score",
        result: {
          content: null,
          toolCalls: [],
          usage: { promptTokens: 12, completionTokens: 3 },
          model: "test/model",
          finishReason: "stop",
        },
      },
      SIG(),
    );
    const rows = await h.db.select().from(aiUsage);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.promptTokens).toBe(12);
    expect(rows[0]?.completionTokens).toBe(3);
    expect(rows[0]?.feature).toBe("deal_score");

    const usage = await getUsage(h.db, SIG());
    expect(usage.companyUsed).toBe(15);
  });
});
