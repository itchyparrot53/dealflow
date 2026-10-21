import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import {
  activities,
  activityTypes,
  aiUsage,
  automationRuns,
  automations,
  changeLogs,
  deals,
  domainEvents,
  emailTemplates,
  notes,
  notifications,
  persons,
  users,
} from "@/db/schema";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import { updateAiSettings } from "@/features/ai/aiSettings";
import { fakeProvider } from "@/features/ai/fakeProvider";
import { setAiProviderForTest } from "@/features/ai/provider";
import { ScriptedAiProvider } from "@/features/ai/scriptedProvider";
import { changeStage } from "@/features/deal-workspace/changeStage";
import { markWon } from "@/features/deal-workspace/wonLost";
import { getActorMailboxStatus } from "@/features/email/mailboxOwnership";
import { dispatchEvents } from "@/features/events/dispatcher";
import { FakeStorageClient } from "@/features/files/storageFake";
import { connectImapMailbox } from "@/features/mail/connect/connect";
import { createFakeTransportFactory } from "@/features/mail/transport/fake";
import type { PermSetUser } from "@/features/permissions/effective";
import { hydrateActor } from "@/server/hydrateActor";
import { makeTestDb } from "@/test/db";
import { setSendEmailActionDepsForTest } from "./actions/sendEmail";
import {
  type Action,
  type AutomationDefinition,
  automationDefinitionSchema,
  type Trigger,
} from "./definition";
import { draftAutomation } from "./describe";
import { runAutomation } from "./runner";
import {
  createAutomation,
  deleteAutomation,
  duplicateAutomation,
  setAutomationEnabled,
  updateAutomation,
} from "./service";
import { AUTOMATION_TEMPLATES, buildTemplateContext } from "./templates";

let h: Awaited<ReturnType<typeof makeTestDb>>;
let admin: PermSetUser;
let regular: PermSetUser;
let inactiveAdminId: string;
let pipelineId: string;
let stageId: string;

const sig = (): AbortSignal => AbortSignal.timeout(15_000);

beforeAll(async () => {
  h = await makeTestDb();
  const row = await seedUser(h.db, { isAdmin: true, name: "Automation Admin" });
  admin = { id: row.id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
  const regularRow = await seedUser(h.db, { name: "Regular" });
  regular = {
    id: regularRow.id,
    type: "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
  const inactive = await seedUser(h.db, { isAdmin: true, name: "Inactive Admin" });
  // seedUser does not set isActive; deactivate this one for the owner_inactive case.
  await h.db.update(users).set({ isActive: false }).where(eq(users.id, inactive.id));
  inactiveAdminId = inactive.id;
  const seeded = await seedPipelineWithStages(h.db, ["Lead", "Won"]);
  pipelineId = seeded.pipeline.id;
  stageId = seeded.stages[0]?.id ?? "";
}, 60_000);

afterAll(async () => {
  setAiProviderForTest(undefined);
  setSendEmailActionDepsForTest(undefined);
  if (mailDir !== "") rmSync(mailDir, { recursive: true, force: true });
  await h.close();
});

let mailDir = "";
const MAIL_ADDRESS = "automation-owner@example.com";

beforeAll(async () => {
  mailDir = mkdtempSync(join(tmpdir(), "dfauto-"));
  const hydrated = await hydrateActor(h.db, admin.id, sig());
  if (hydrated === null) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "admin hydration failed");
  await connectImapMailbox(
    h.db,
    hydrated,
    { emailAddress: MAIL_ADDRESS, password: "fake-app-password-1", preset: "purelymail" },
    { transports: createFakeTransportFactory(mailDir), enqueueSync: () => Promise.resolve() },
    sig(),
  );
  setSendEmailActionDepsForTest({
    resolveDeps: { transports: createFakeTransportFactory(mailDir) },
    storage: new FakeStorageClient(),
  });
  setAiProviderForTest(fakeProvider());
  await updateAiSettings(
    h.db,
    { enabled: true, companyMonthlyTokenLimit: 5_000_000, userMonthlyTokenLimit: null },
    sig(),
  );
}, 60_000);

beforeEach(async () => {
  // Each case starts with no automations and no pending events, so one case's automations cannot
  // run against the next case's records.
  await h.db.delete(automations);
  await h.db
    .update(domainEvents)
    .set({ processedAt: new Date() })
    .where(isNull(domainEvents.processedAt));
  await updateAiSettings(
    h.db,
    { enabled: true, companyMonthlyTokenLimit: 5_000_000, userMonthlyTokenLimit: null },
    sig(),
  );
});

async function seedDeal(value = "100.00"): Promise<typeof deals.$inferSelect> {
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Automation deal",
      pipelineId,
      stageId,
      ownerId: admin.id,
      visibilityLevel: "all",
      boardPosition: "0",
      value,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "deal seed failed");
  return row;
}

async function seedAutomation(opts: {
  enabled?: boolean;
  createdBy?: string;
  trigger?: Trigger;
  condition?: AutomationDefinition["condition"];
  actions?: Action[];
}): Promise<string> {
  const [row] = await h.db
    .insert(automations)
    .values({
      name: `Automation ${randomUUID().slice(0, 8)}`,
      enabled: opts.enabled ?? true,
      createdBy: opts.createdBy ?? admin.id,
      definition: {
        trigger: opts.trigger ?? { type: "deal.won" },
        condition: opts.condition ?? null,
        actions: opts.actions ?? [{ type: "ai_score_deal" }],
      },
    })
    .returning({ id: automations.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "automation seed failed");
  return row.id;
}

async function seedRun(automationId: string, entityId: string, depth = 0): Promise<string> {
  const [row] = await h.db
    .insert(automationRuns)
    .values({
      automationId,
      entityType: "deal",
      entityId,
      chainId: randomUUID(),
      depth,
      status: "running",
    })
    .returning({ id: automationRuns.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "run seed failed");
  return row.id;
}

async function loadRun(id: string) {
  const [row] = await h.db.select().from(automationRuns).where(eq(automationRuns.id, id));
  return row;
}

describe("runAutomation", () => {
  it("skips a run whose condition is false", async () => {
    const deal = await seedDeal("100.00");
    const automationId = await seedAutomation({
      condition: { conditions: [{ field: "value", op: "gt", value: 999_999 }] },
    });
    const runId = await seedRun(automationId, deal.id);

    const outcome = await runAutomation(h.db, runId, sig());
    expect(outcome.status).toBe("skipped");
    expect(outcome.skipReason).toBe("condition_false");
    const run = await loadRun(runId);
    expect(run?.status).toBe("skipped");
    expect(run?.skipReason).toBe("condition_false");
  });

  it("skips a disabled automation", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({ enabled: false });
    const runId = await seedRun(automationId, deal.id);

    const outcome = await runAutomation(h.db, runId, sig());
    expect(outcome.status).toBe("skipped");
    expect(outcome.skipReason).toBe("disabled");
  });

  it("skips an automation whose creator is no longer an active admin", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({ createdBy: inactiveAdminId });
    const runId = await seedRun(automationId, deal.id);

    const outcome = await runAutomation(h.db, runId, sig());
    expect(outcome.status).toBe("skipped");
    expect(outcome.skipReason).toBe("owner_inactive");
  });

  it("stops at the first failing action and records both the step and the run", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({
      actions: [{ type: "ai_score_deal" }, { type: "ai_summarize_deal" }],
    });
    const runId = await seedRun(automationId, deal.id);
    const calls: string[] = [];

    const outcome = await runAutomation(h.db, runId, sig(), {
      executeAction: (_ctx, action) => {
        calls.push(action.type);
        return Promise.resolve({ ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED });
      },
    });

    expect(calls).toEqual(["ai_score_deal"]);
    expect(outcome.status).toBe("failed");
    expect(outcome.errorId).toBe(ERROR_IDS.AUTOMATION_ACTION_FAILED);
    const run = await loadRun(runId);
    expect(run?.status).toBe("failed");
    expect(run?.errorId).toBe(ERROR_IDS.AUTOMATION_ACTION_FAILED);
    expect(run?.steps).toEqual([
      { index: 0, type: "ai_score_deal", ok: false, errorId: ERROR_IDS.AUTOMATION_ACTION_FAILED },
    ]);
  });

  it("is a no-op when the run is already finished", async () => {
    const deal = await seedDeal();
    const automationId = await seedAutomation({});
    const runId = await seedRun(automationId, deal.id);
    await h.db
      .update(automationRuns)
      .set({ status: "succeeded", finishedAt: new Date() })
      .where(eq(automationRuns.id, runId));
    let calls = 0;

    const outcome = await runAutomation(h.db, runId, sig(), {
      executeAction: () => {
        calls += 1;
        return Promise.resolve({ ok: true });
      },
    });

    expect(outcome.status).toBe("noop");
    expect(calls).toBe(0);
  });
});

async function activityTypeId(): Promise<string> {
  const [row] = await h.db.select().from(activityTypes).where(eq(activityTypes.key, "call"));
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "activity type missing");
  return row.id;
}

async function dispatchAndRun(): Promise<number> {
  await dispatchEvents(h.db, sig());
  const running = await h.db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(eq(automationRuns.status, "running"));
  for (const run of running) await runAutomation(h.db, run.id, sig());
  return running.length;
}

async function runsFor(automationId: string) {
  return h.db.select().from(automationRuns).where(eq(automationRuns.automationId, automationId));
}

describe("core actions", () => {
  it("runs deal won to create activity end to end", async () => {
    const deal = await seedDeal();
    const typeId = await activityTypeId();
    const automationId = await seedAutomation({
      trigger: { type: "deal.won" },
      actions: [
        {
          type: "create_activity",
          activityTypeId: typeId,
          subject: "Onboarding call with {{person.name}}",
          dueInDays: 2,
          assignee: "deal_owner",
        },
      ],
    });

    const won = await markWon(h.db, admin, deal.id, sig());
    expect(won.ok).toBe(true);
    expect(await dispatchAndRun()).toBe(1);

    const [run] = await runsFor(automationId);
    expect(run?.status).toBe("succeeded");
    const [activity] = await h.db.select().from(activities).where(eq(activities.dealId, deal.id));
    expect(activity?.subject).toBe("Onboarding call with ");
    expect(activity?.assigneeId).toBe(admin.id);
  });

  it("moves a deal to another stage with a change log entry and a depth 1 event", async () => {
    const seeded = await seedPipelineWithStages(h.db, ["One", "Two"]);
    const from = seeded.stages[0]?.id ?? "";
    const to = seeded.stages[1]?.id ?? "";
    const [deal] = await h.db
      .insert(deals)
      .values({
        title: "Stage deal",
        pipelineId: seeded.pipeline.id,
        stageId: from,
        ownerId: admin.id,
        visibilityLevel: "all",
        boardPosition: "0",
      })
      .returning();
    if (deal === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "deal seed failed");
    const automationId = await seedAutomation({
      trigger: { type: "deal.won" },
      actions: [{ type: "update_deal", set: { stageId: to } }],
    });

    await markWon(h.db, admin, deal.id, sig());
    await dispatchAndRun();

    const [run] = await runsFor(automationId);
    expect(run?.status).toBe("succeeded");
    const logs = await h.db.select().from(changeLogs).where(eq(changeLogs.entityId, deal.id));
    const log = logs.find((row) => row.field === "stageId");
    expect(log).toBeDefined();
    expect(log?.newValue).toBe(to);

    const stageEvents = await h.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.entityId, deal.id));
    const moved = stageEvents.find((event) => event.type === "deal.stage_changed");
    expect(moved?.chainId).toBe(run?.chainId);
    expect(moved?.depth).toBe((run?.depth ?? 0) + 1);
  });

  it("stops two automations that move a deal back and forth after one round", async () => {
    const seeded = await seedPipelineWithStages(h.db, ["Left", "Right"]);
    const left = seeded.stages[0]?.id ?? "";
    const right = seeded.stages[1]?.id ?? "";
    const [deal] = await h.db
      .insert(deals)
      .values({
        title: "Loop deal",
        pipelineId: seeded.pipeline.id,
        stageId: left,
        ownerId: admin.id,
        visibilityLevel: "all",
        boardPosition: "0",
      })
      .returning();
    if (deal === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "deal seed failed");

    const rightToLeft = await seedAutomation({
      trigger: { type: "deal.stage_changed", stageId: right },
      actions: [{ type: "update_deal", set: { stageId: left } }],
    });
    const leftToRight = await seedAutomation({
      trigger: { type: "deal.stage_changed", stageId: left },
      actions: [{ type: "update_deal", set: { stageId: right } }],
    });

    // Starting move into "Right" opens the chain; the two automations chase each other.
    const moved = await changeStage(
      h.db,
      admin,
      { dealId: deal.id, toStageId: right, expectedUpdatedAt: deal.updatedAt.toISOString() },
      sig(),
    );
    expect(moved.ok).toBe(true);
    for (let round = 0; round < 4; round += 1) await dispatchAndRun();

    const first = await runsFor(rightToLeft);
    const second = await runsFor(leftToRight);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]?.status).toBe("succeeded");
    expect(second[0]?.status).toBe("succeeded");
  });

  it("creates an automation notification for the deal owner", async () => {
    const deal = await seedDeal();
    await seedAutomation({
      trigger: { type: "deal.won" },
      actions: [{ type: "notify_user", to: "deal_owner", message: "Won: {{deal.title}}" }],
    });

    await markWon(h.db, admin, deal.id, sig());
    await dispatchAndRun();

    const rows = await h.db
      .select()
      .from(notifications)
      .where(eq(notifications.type, "automation"));
    const row = rows.find((item) => item.entityId === deal.id);
    expect(row?.userId).toBe(admin.id);
    expect(row?.payload).toMatchObject({ message: "Won: Automation deal" });
  });
});

describe("automation service", () => {
  const definition = {
    trigger: { type: "deal.won" },
    condition: null,
    actions: [{ type: "ai_score_deal" }],
  };

  it("refuses a non-admin", async () => {
    const result = await createAutomation(h.db, regular, { name: "Nope", definition }, sig());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.PERM_DENIED);
  });

  it("creates, updates, enables, duplicates and deletes", async () => {
    const created = await createAutomation(h.db, admin, { name: "Mine", definition }, sig());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.enabled).toBe(false);

    const updated = await updateAutomation(
      h.db,
      admin,
      created.value.id,
      { name: "Renamed" },
      sig(),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.name).toBe("Renamed");

    const enabled = await setAutomationEnabled(h.db, admin, created.value.id, true, sig());
    expect(enabled.ok && enabled.value.enabled).toBe(true);

    const copy = await duplicateAutomation(h.db, admin, created.value.id, sig());
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.value.name).toBe("Renamed (copy)");
    expect(copy.value.enabled).toBe(false);

    const removed = await deleteAutomation(h.db, admin, created.value.id, sig());
    expect(removed.ok).toBe(true);
  });

  it("refuses an invalid definition with the input error", async () => {
    const result = await createAutomation(
      h.db,
      admin,
      {
        name: "Bad",
        definition: { trigger: { type: "deal.won" }, condition: null, actions: [] },
      },
      sig(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AUTOMATION_INPUT_INVALID);
  });
});

async function seedPerson(): Promise<string> {
  const [row] = await h.db
    .insert(persons)
    .values({
      name: "Ada Buyer",
      firstName: "Ada",
      primaryEmail: "ada@example.com",
      emails: [{ label: "work", value: "ada@example.com", primary: true }],
      ownerId: admin.id,
      visibilityLevel: "all",
    })
    .returning({ id: persons.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "person seed failed");
  return row.id;
}

async function seedDealWithPerson(existingPersonId?: string): Promise<typeof deals.$inferSelect> {
  const personId = existingPersonId ?? (await seedPerson());
  const [row] = await h.db
    .insert(deals)
    .values({
      title: "Email deal",
      pipelineId,
      stageId,
      ownerId: admin.id,
      visibilityLevel: "all",
      boardPosition: "0",
      value: "100.00",
      personId,
    })
    .returning();
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "deal seed failed");
  return row;
}

async function seedTemplate(): Promise<string> {
  const [row] = await h.db
    .insert(emailTemplates)
    .values({
      name: "Automation template",
      subject: "Hello {{person.name}}",
      bodyHtml: "<p>Hi {{person.first_name}}</p>",
      ownerId: admin.id,
    })
    .returning({ id: emailTemplates.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "template seed failed");
  return row.id;
}

describe("email and AI actions", () => {
  it("sends an email template once, then hits the cooldown", async () => {
    const templateId = await seedTemplate();
    const automationId = await seedAutomation({
      trigger: { type: "deal.won" },
      actions: [{ type: "send_email", templateId, to: "deal_person" }],
    });
    const deal = await seedDealWithPerson();
    const mailbox = await getActorMailboxStatus(h.db, admin.id, sig());
    expect(mailbox).not.toBeNull();
    const countMessages = async (): Promise<number> => {
      const result = await h.db.execute(
        `SELECT count(*)::int AS count FROM email_messages WHERE account_id = '${mailbox?.id ?? ""}'`,
      );
      return (result.rows[0] as { count: number }).count;
    };

    await markWon(h.db, admin, deal.id, sig());
    await dispatchAndRun();
    const [firstRun] = await runsFor(automationId);
    expect(firstRun?.status).toBe("succeeded");
    expect(await countMessages()).toBe(1);

    const secondDeal = await seedDealWithPerson(deal.personId ?? undefined);
    await markWon(h.db, admin, secondDeal.id, sig());
    await dispatchAndRun();
    const runs = await runsFor(automationId);
    const cooldown = runs.find((run) => run.entityId === secondDeal.id);
    expect(cooldown?.status).toBe("failed");
    expect(cooldown?.errorId).toBe(ERROR_IDS.AUTOMATION_EMAIL_SKIPPED);
    expect(await countMessages()).toBe(1);
  });

  it("skips send_email when the person has no address", async () => {
    const templateId = await seedTemplate();
    const automationId = await seedAutomation({
      trigger: { type: "deal.won" },
      actions: [{ type: "send_email", templateId, to: "deal_person" }],
    });
    const deal = await seedDeal();

    await markWon(h.db, admin, deal.id, sig());
    await dispatchAndRun();
    const [run] = await runsFor(automationId);
    expect(run?.status).toBe("failed");
    expect(run?.errorId).toBe(ERROR_IDS.AUTOMATION_EMAIL_SKIPPED);
  });

  it("writes an AI summary as a note and records usage", async () => {
    const automationId = await seedAutomation({
      trigger: { type: "deal.won" },
      actions: [{ type: "ai_summarize_deal" }],
    });
    const deal = await seedDeal();

    await markWon(h.db, admin, deal.id, sig());
    await dispatchAndRun();
    const [run] = await runsFor(automationId);
    expect(run?.status).toBe("succeeded");

    const [note] = await h.db.select().from(notes).where(eq(notes.entityId, deal.id));
    expect(note?.body).toContain("FAKE summary of this deal.");
    const usage = await h.db.select().from(aiUsage).where(eq(aiUsage.feature, "deal_summary"));
    expect(usage.length).toBeGreaterThanOrEqual(1);
  });

  it("fails the step with the AI cap error when the company is over its limit", async () => {
    await updateAiSettings(
      h.db,
      { enabled: true, companyMonthlyTokenLimit: 0, userMonthlyTokenLimit: null },
      sig(),
    );
    const automationId = await seedAutomation({
      trigger: { type: "deal.won" },
      actions: [{ type: "ai_score_deal" }],
    });
    const deal = await seedDeal();

    await markWon(h.db, admin, deal.id, sig());
    await dispatchAndRun();
    const [run] = await runsFor(automationId);
    expect(run?.status).toBe("failed");
    expect(run?.errorId).toBe(ERROR_IDS.AI_COMPANY_LIMIT);
  });
});

describe("describe it and templates", () => {
  it("drafts a valid definition with the deterministic provider", async () => {
    const result = await draftAutomation(
      h.db,
      admin,
      { text: "When a deal is won, create a follow-up call tomorrow" },
      sig(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(automationDefinitionSchema.safeParse(result.value).success).toBe(true);
    expect(result.value.actions[0]?.type).toBe("create_activity");
  });

  it("fails with E_AUTOMATION_004 when the model returns invalid JSON twice", async () => {
    setAiProviderForTest(
      new ScriptedAiProvider({ content: "not json" }, { content: "still not json" }),
    );
    try {
      const result = await draftAutomation(h.db, admin, { text: "Anything" }, sig());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.AUTOMATION_DRAFT_INVALID);
    } finally {
      setAiProviderForTest(fakeProvider());
    }
  });

  it("builds a valid definition for every built-in template", async () => {
    const context = await buildTemplateContext(h.db, sig());
    expect(context).not.toBeNull();
    if (context === null) return;
    for (const template of AUTOMATION_TEMPLATES) {
      const definition = template.build(context);
      const parsed = automationDefinitionSchema.safeParse(definition);
      expect(parsed.success, template.key).toBe(true);
    }
    expect(AUTOMATION_TEMPLATES).toHaveLength(6);
  });
});
