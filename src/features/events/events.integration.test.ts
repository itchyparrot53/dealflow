import { randomUUID } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  automationRuns,
  automations,
  deals,
  documents,
  domainEvents,
  stages,
  webhookDeliveries,
  webhookSubscriptions,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { recordChange } from "@/features/collaboration/changeLog";
import { createDeal } from "@/features/deals/dealActions";
import { dispatchEvents } from "./dispatcher";
import { runRetention } from "./retentionJob";
import { runRottingDeals } from "./rottingJob";
import { changeStage } from "@/features/deal-workspace/changeStage";
import { acceptQuote } from "@/features/documents/publicDocuments";
import { runOverdueInvoices } from "@/features/documents/overdueJob";
import { markWon } from "@/features/deal-workspace/wonLost";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb } from "@/test/db";
import { runInChain } from "./chainContext";
import { emitDomainEvent } from "./emit";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let pipelineId: string;
let firstStageId: string;
let secondStageId: string;

const sig = (): AbortSignal => AbortSignal.timeout(15_000);

beforeAll(async () => {
  h = await makeTestDb();
  const row = await seedUser(h.db, { isAdmin: true, name: "Admin User" });
  admin = { id: row.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Negotiation"]);
  pipelineId = seeded.pipeline.id;
  firstStageId = seeded.stages[0]?.id ?? "";
  secondStageId = seeded.stages[1]?.id ?? "";
}, 60_000);

afterAll(async () => {
  await h.close();
});

async function seedDeal(): Promise<typeof deals.$inferSelect> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Event deal",
      pipelineId,
      stageId: firstStageId,
      ownerId: admin.id,
      visibilityLevel: "all",
      boardPosition: "0",
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "seedDeal failed");
  return row;
}

async function eventsFor(entityId: string) {
  return h.db
    .select({
      type: domainEvents.type,
      chainId: domainEvents.chainId,
      depth: domainEvents.depth,
      automationId: domainEvents.automationId,
      changes: domainEvents.changes,
    })
    .from(domainEvents)
    .where(eq(domainEvents.entityId, entityId))
    .orderBy(domainEvents.id);
}

describe("recordChange emits domain events", () => {
  it("writes deal.stage_changed and deal.updated for a stage move", async () => {
    const deal = await seedDeal();
    const moved = await changeStage(
      h.db,
      admin,
      {
        dealId: deal.id,
        toStageId: secondStageId,
        expectedUpdatedAt: deal.updatedAt.toISOString(),
      },
      sig(),
    );
    expect(moved.ok).toBe(true);

    const rows = await eventsFor(deal.id);
    expect(rows.map((row) => row.type)).toEqual(["deal.stage_changed", "deal.updated"]);
    expect(rows[0]?.changes).toEqual([
      { field: "stageId", old: firstStageId, new: secondStageId },
    ]);
  });

  it("writes deal.won when a deal is marked won", async () => {
    const deal = await seedDeal();
    const won = await markWon(h.db, admin, deal.id, sig());
    expect(won.ok).toBe(true);

    const rows = await eventsFor(deal.id);
    const types = rows.map((row) => row.type);
    expect(types).toContain("deal.won");
    expect(types).toContain("deal.updated");
  });

  it("leaves no event when the transaction rolls back", async () => {
    const deal = await seedDeal();
    await expect(
      h.db.transaction(async (tx) => {
        await recordChange(
          tx,
          {
            entityType: "deal",
            entityId: deal.id,
            field: "value",
            oldValue: "10.00",
            newValue: "20.00",
            actorId: admin.id,
          },
          sig(),
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(await eventsFor(deal.id)).toHaveLength(0);
  });

  it("writes deal.created when a deal is created through the service", async () => {
    const created = await createDeal(
      h.db,
      {
        userId: admin.id,
        isAdmin: true,
        isActive: true,
        sessionLive: true,
        visibilityGroupIds: [],
        primaryVisibilityGroupId: null,
        flags: {},
      },
      { title: "Created deal", pipelineId, stageId: firstStageId },
      sig(),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const rows = await eventsFor(created.value.id);
    expect(rows.map((row) => row.type)).toEqual(["deal.created"]);
    expect(rows[0]?.depth).toBe(0);
  });

  it("writes document.accepted when a public quote is accepted", async () => {
    const deal = await seedDeal();
    const [quote] = await h.db
      .insert(documents)
      .values({
        kind: "quote",
        dealId: deal.id,
        publicId: `pub-${randomUUID()}`,
        title: "Quote",
        body: "Body",
        currency: "USD",
        subtotal: "100.00",
        tax: "0.00",
        total: "100.00",
        status: "sent",
        createdBy: admin.id,
        issueDate: "2026-01-01",
        validUntil: "2099-01-01",
      })
      .returning();
    if (quote === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "quote seed failed");

    const accepted = await acceptQuote(
      h.db,
      quote.publicId,
      { name: "Customer", agree: true, ip: "203.0.113.9" },
      sig(),
    );
    expect(accepted.ok).toBe(true);

    const rows = await eventsFor(quote.id);
    expect(rows.map((row) => row.type)).toContain("document.accepted");
  });

  it("writes one invoice.overdue event per swept invoice", async () => {
    const deal = await seedDeal();
    const base = {
      kind: "invoice",
      dealId: deal.id,
      title: "Invoice",
      body: "Body",
      currency: "USD",
      subtotal: "100.00",
      tax: "0.00",
      total: "100.00",
      issueDate: "2026-01-01",
      status: "sent",
      createdBy: admin.id,
    };
    const past = await h.db
      .insert(documents)
      .values([
        { ...base, publicId: `pub-${randomUUID()}`, dueDate: "2026-01-02" },
        { ...base, publicId: `pub-${randomUUID()}`, dueDate: "2026-01-03" },
        { ...base, publicId: `pub-${randomUUID()}`, dueDate: "2099-01-01" },
      ])
      .returning();

    const swept = await runOverdueInvoices(h.db, sig());
    expect(swept).toBe(2);
    const firstEvents = await eventsFor(past[0]?.id ?? "");
    const secondEvents = await eventsFor(past[1]?.id ?? "");
    const futureEvents = await eventsFor(past[2]?.id ?? "");
    expect(firstEvents.map((row) => row.type)).toEqual(["invoice.overdue"]);
    expect(secondEvents.map((row) => row.type)).toEqual(["invoice.overdue"]);
    expect(futureEvents).toHaveLength(0);
  });

  it("inherits the chain id, depth and automation id from runInChain", async () => {
    const deal = await seedDeal();
    const chainId = randomUUID();
    const automationId = randomUUID();

    await runInChain({ chainId, depth: 2, automationId }, async () =>
      h.db.transaction(async (tx) => {
        await recordChange(
          tx,
          {
            entityType: "deal",
            entityId: deal.id,
            field: "value",
            oldValue: "10.00",
            newValue: "20.00",
            actorId: admin.id,
          },
          sig(),
        );
      }),
    );

    const rows = await eventsFor(deal.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.chainId).toBe(chainId);
    expect(rows[0]?.depth).toBe(2);
    expect(rows[0]?.automationId).toBe(automationId);
  });
});

async function seedAutomation(trigger: unknown): Promise<string> {
  const [row] = await h.db
    .insert(automations)
    .values({
      name: `Auto ${randomUUID().slice(0, 8)}`,
      enabled: true,
      createdBy: admin.id,
      definition: { trigger, condition: null, actions: [{ type: "ai_score_deal" }] },
    })
    .returning({ id: automations.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "automation seed failed");
  return row.id;
}

async function seedSubscription(events: string[]): Promise<string> {
  const [row] = await h.db
    .insert(webhookSubscriptions)
    .values({
      name: "Hook",
      url: "https://example.invalid/hook",
      events,
      secretEnc: Buffer.from("whsec_test"),
      createdBy: admin.id,
    })
    .returning({ id: webhookSubscriptions.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "subscription seed failed");
  return row.id;
}

async function emitInChain(
  type: "deal.created" | "deal.won" | "deal.updated",
  entityId: string,
  chainId: string,
  depth: number,
): Promise<void> {
  await runInChain({ chainId, depth, automationId: null }, async () => {
    await emitDomainEvent(
      h.db,
      { type, entityType: "deal", entityId, actorId: admin.id },
      sig(),
    );
  });
}

describe("dispatcher", () => {
  it("coalesces two edits from one transaction into one event with two changes", async () => {
    const deal = await seedDeal();
    await seedAutomation({ type: "deal.updated" });
    await seedSubscription(["deal.updated"]);

    await h.db.transaction(async (tx) => {
      await recordChange(
        tx,
        {
          entityType: "deal",
          entityId: deal.id,
          field: "value",
          oldValue: null,
          newValue: "10.00",
          actorId: admin.id,
        },
        sig(),
      );
      await recordChange(
        tx,
        {
          entityType: "deal",
          entityId: deal.id,
          field: "title",
          oldValue: "Event deal",
          newValue: "Renamed",
          actorId: admin.id,
        },
        sig(),
      );
      await tx.update(deals).set({ title: "Renamed" }).where(eq(deals.id, deal.id));
    });

    const result = await dispatchEvents(h.db, sig());
    expect(result.deliveriesCreated).toBeGreaterThanOrEqual(1);

    const deliveries = await h.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.eventType, "deal.updated"));
    const delivery = deliveries.at(-1);
    expect(delivery).toBeDefined();
    const payload = delivery?.payload as {
      changes: { field: string }[];
      data: { title: string };
    };
    expect(payload.changes.map((change) => change.field).sort()).toEqual(["title", "value"]);
    expect(payload.data.title).toBe("Renamed");
  });

  it("processes each event once across two concurrent passes", async () => {
    const automationId = await seedAutomation({ type: "deal.created" });
    const dealIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const deal = await seedDeal();
      dealIds.push(deal.id);
      await emitInChain("deal.created", deal.id, randomUUID(), 0);
    }

    const [first, second] = await Promise.all([
      dispatchEvents(h.db, sig()),
      dispatchEvents(h.db, sig()),
    ]);
    expect(first.runsCreated + second.runsCreated).toBe(5);

    const runs = await h.db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, automationId));
    expect(runs).toHaveLength(5);

    const pending = await h.db
      .select({ id: domainEvents.id })
      .from(domainEvents)
      .where(isNull(domainEvents.processedAt));
    expect(pending).toHaveLength(0);
  });

  it("skips a second run for the same automation, chain and record", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({ type: "deal.won" });
    const chainId = randomUUID();
    await emitInChain("deal.won", deal.id, chainId, 0);
    await emitInChain("deal.won", deal.id, chainId, 0);

    await dispatchEvents(h.db, sig());
    const runs = await h.db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, automationId));
    expect(runs).toHaveLength(1);
  });

  it("records a depth_limit skip at depth 4", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({ type: "deal.won" });
    await emitInChain("deal.won", deal.id, randomUUID(), 4);

    await dispatchEvents(h.db, sig());
    const [run] = await h.db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, automationId));
    expect(run?.status).toBe("skipped");
    expect(run?.skipReason).toBe("depth_limit");
  });

  it("creates a webhook delivery with a deal snapshot and no secret fields", async () => {
    const deal = await seedDeal();
    const subscriptionId = await seedSubscription(["deal.won"]);
    await emitInChain("deal.won", deal.id, randomUUID(), 0);

    await dispatchEvents(h.db, sig());
    const [delivery] = await h.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.subscriptionId, subscriptionId));
    expect(delivery?.eventType).toBe("deal.won");
    const serialized = JSON.stringify(delivery?.payload);
    expect(serialized).toContain(deal.title);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("password");
    const payload = delivery?.payload as { id: string; data: { id: string } };
    expect(payload.id.startsWith("evt_")).toBe(true);
    expect(payload.data.id).toBe(deal.id);
  });
});

describe("rotting job", () => {
  it("emits once per stage entry for a deal past its rotting days", async () => {
    const seeded = await seedPipelineWithStages(h.db, ["Stale"]);
    const stageId = seeded.stages[0]?.id ?? "";
    await h.db
      .update(stages)
      .set({ rottingDays: 1 })
      .where(eq(stages.id, stageId));
    const [deal] = await h.db
      .insert(deals)
      .values({
        title: "Rotting deal",
        pipelineId: seeded.pipeline.id,
        stageId,
        ownerId: admin.id,
        visibilityLevel: "all",
        boardPosition: "0",
        stageEnteredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      })
      .returning();
    if (deal === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "deal seed failed");

    const first = await runRottingDeals(h.db, sig());
    expect(first).toBeGreaterThanOrEqual(1);
    const afterFirst = await eventsFor(deal.id);
    expect(afterFirst.map((row) => row.type)).toContain("deal.rotting");

    const second = await runRottingDeals(h.db, sig());
    expect(second).toBe(0);
    const afterSecond = await eventsFor(deal.id);
    expect(afterSecond.filter((row) => row.type === "deal.rotting")).toHaveLength(1);
  });
});

describe("retention job", () => {
  it("deletes only old processed rows", async () => {
    const deal = await seedDeal();
    await h.db.insert(domainEvents).values([
      {
        type: "deal.updated",
        entityType: "deal",
        entityId: deal.id,
        chainId: randomUUID(),
        depth: 0,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        processedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      },
      {
        type: "deal.updated",
        entityType: "deal",
        entityId: deal.id,
        chainId: randomUUID(),
        depth: 0,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      },
    ]);

    const result = await runRetention(h.db, sig());
    expect(result.events).toBeGreaterThanOrEqual(1);
    const rows = await h.db
      .select({ processedAt: domainEvents.processedAt })
      .from(domainEvents)
      .where(eq(domainEvents.entityId, deal.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.processedAt).toBeNull();
  });
});
