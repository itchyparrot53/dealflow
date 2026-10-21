import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { domainEvents, deals, documents } from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { recordChange } from "@/features/collaboration/changeLog";
import { createDeal } from "@/features/deals/dealActions";
import { changeStage } from "@/features/deal-workspace/changeStage";
import { acceptQuote } from "@/features/documents/publicDocuments";
import { runOverdueInvoices } from "@/features/documents/overdueJob";
import { markWon } from "@/features/deal-workspace/wonLost";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb } from "@/test/db";
import { runInChain } from "./chainContext";

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
