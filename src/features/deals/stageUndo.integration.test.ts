import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deals } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import { moveDeal } from "./dealMove";

// The data path behind the stage-move undo toast (6.8): the forward move returns a fresh updatedAt,
// and moving back with it succeeds while a stale one is refused by the compare-and-swap.

let tdb: TestDb;
beforeAll(async () => {
  tdb = await makeTestDb();
}, 60_000);
afterAll(async () => {
  await tdb.close();
});

const signal = new AbortController().signal;

function actor(user: { id: string }): PermSetUser {
  return {
    id: user.id,
    type: "admin",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}

async function seedDeal() {
  const user = await seedUser(tdb.db, { isAdmin: true });
  const pipe = await seedPipelineWithStages(tdb.db, ["Lead", "Won"]);
  const first = pipe.stages[0];
  const second = pipe.stages[1];
  if (first === undefined || second === undefined) throw new Error("stage seed failed");
  const [deal] = await tdb.db
    .insert(deals)
    .values({
      title: "Undo me",
      pipelineId: pipe.pipeline.id,
      stageId: first.id,
      ownerId: user.id,
      visibilityLevel: "all",
    })
    .returning();
  if (deal === undefined) throw new Error("deal seed failed");
  return { deal, first, second, actor: actor(user) };
}

describe("stage move undo", () => {
  it("returns the deal to its previous stage with the fresh updatedAt", async () => {
    const { deal, first, second, actor } = await seedDeal();

    const forward = await moveDeal(
      tdb.db,
      actor,
      {
        dealId: deal.id,
        toStageId: second.id,
        beforePosition: null,
        afterPosition: null,
        expectedUpdatedAt: deal.updatedAt.toISOString(),
      },
      signal,
    );
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    expect(forward.value.stageId).toBe(second.id);

    const back = await moveDeal(
      tdb.db,
      actor,
      {
        dealId: deal.id,
        toStageId: first.id,
        beforePosition: null,
        afterPosition: null,
        expectedUpdatedAt: forward.value.updatedAt.toISOString(),
      },
      signal,
    );
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value.stageId).toBe(first.id);
  });

  it("refuses the undo after another edit changed updatedAt", async () => {
    const { deal, first, second, actor } = await seedDeal();

    const forward = await moveDeal(
      tdb.db,
      actor,
      {
        dealId: deal.id,
        toStageId: second.id,
        beforePosition: null,
        afterPosition: null,
        expectedUpdatedAt: deal.updatedAt.toISOString(),
      },
      signal,
    );
    if (!forward.ok) throw new Error("forward move failed");

    // Another writer edits the deal before the undo runs.
    await tdb.db
      .update(deals)
      .set({ title: "Edited meanwhile", updatedAt: new Date() })
      .where(eq(deals.id, deal.id));

    const back = await moveDeal(
      tdb.db,
      actor,
      {
        dealId: deal.id,
        toStageId: first.id,
        beforePosition: null,
        afterPosition: null,
        expectedUpdatedAt: forward.value.updatedAt.toISOString(),
      },
      signal,
    );
    expect(back.ok).toBe(false);
    if (back.ok) return;
    expect(back.error.id).toBe("E_DEAL_002");
  });
});
