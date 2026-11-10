import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import {
  campaignRecipients,
  campaignSenders,
  campaignSettings,
  changeLogs,
  deals,
  personMarketing,
  persons,
  savedFilters,
  sequenceEnrollments,
  sequenceSegmentMembers,
  sequenceSteps,
  sequences,
} from "@/db/schema";
import { withTestDb } from "@/db/testing";
import { seedPipelineWithStages, seedUser } from "@/db/testing/factories";
import type { SystemMail } from "@/features/mailer/types";
import type { PermSetUser } from "@/features/permissions/effective";
import { listCampaigns } from "../service";
import { enrollPerson, syncSegmentEntries } from "./enroll";
import {
  DEFAULT_SEND_WINDOW,
  DEFAULT_SEQUENCE_ENTRY,
  DEFAULT_SEQUENCE_EXIT,
  defaultSequenceEmailStep,
  type SendWindow,
  type SequenceEntry,
  type SequenceExit,
  type SequenceStepInput,
} from "./model";
import { getSequenceEditorView } from "./queries";
import { runSequenceTick } from "./scheduler";
import { activateSequence, createSequence, updateSequence } from "./service";

const SIGNAL = new AbortController().signal;

function admin(id: string): PermSetUser {
  return { id, type: "admin", isActive: true, groupIds: new Set(), flags: new Set() };
}

function fakeSend(
  mails: SystemMail[],
  delayMs = 0,
): (mail: SystemMail) => Promise<{ ok: true; value: { messageId: string } }> {
  return async (mail) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    mails.push(mail);
    return { ok: true, value: { messageId: `m${mails.length}` } };
  };
}

interface SetupOptions {
  steps?: SequenceStepInput[];
  sendWindow?: SendWindow;
  entry?: SequenceEntry;
  exit?: SequenceExit;
  postalAddress?: string | null;
  verifiedSender?: boolean;
}

async function setPostalAddress(db: Db, address: string | null): Promise<void> {
  await db
    .insert(campaignSettings)
    .values({ id: 1, postalAddress: address })
    .onConflictDoUpdate({ target: campaignSettings.id, set: { postalAddress: address } });
}

async function setup(db: Db, options: SetupOptions = {}) {
  const user = await seedUser(db, { isAdmin: true, name: "Owner" });
  const [person] = await db
    .insert(persons)
    .values({
      name: "Ada Person",
      firstName: "Ada",
      primaryEmail: "ada@example.com",
      ownerId: user.id,
      visibilityLevel: "all",
    })
    .returning();
  if (person === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "person insert failed");
  await db.insert(personMarketing).values({ personId: person.id, status: "subscribed" });
  const [sender] = await db
    .insert(campaignSenders)
    .values({
      fromName: "Northwind News",
      fromEmail: `news-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      verifiedAt: options.verifiedSender === false ? null : new Date(),
    })
    .returning();
  if (sender === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "sender insert failed");
  if (options.postalAddress !== null) {
    await setPostalAddress(db, options.postalAddress ?? "1 Market Street, London");
  }
  const created = await createSequence(
    db,
    admin(user.id),
    {
      name: "Welcome",
      senderId: sender.id,
      replyTo: null,
      entry: options.entry ?? DEFAULT_SEQUENCE_ENTRY,
      exit: options.exit ?? DEFAULT_SEQUENCE_EXIT,
      sendWindow: options.sendWindow ?? DEFAULT_SEND_WINDOW,
      steps: options.steps ?? [defaultSequenceEmailStep()],
    },
    SIGNAL,
  );
  if (!created.ok)
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, `create sequence failed: ${created.error.id}`);
  return {
    user,
    person,
    sender,
    sequenceId: created.value.id,
  };
}

async function activate(db: Db, userId: string, sequenceId: string): Promise<void> {
  const result = await activateSequence(db, admin(userId), sequenceId, SIGNAL);
  if (!result.ok)
    throw new AppError(ERROR_IDS.DB_INSERT_FAILED, `activate failed: ${result.error.id}`);
}

async function dueEnrollment(
  db: Db,
  sequenceId: string,
  personId: string,
  due: Date,
): Promise<string> {
  const [row] = await db
    .insert(sequenceEnrollments)
    .values({
      sequenceId,
      personId,
      status: "active",
      currentPosition: 0,
      nextRunAt: due,
    })
    .returning({ id: sequenceEnrollments.id });
  if (row === undefined) throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "enrollment insert failed");
  return row.id;
}

const WEDNESDAY = new Date("2026-11-11T12:00:00.000Z");
const FRIDAY_EVENING = new Date("2026-11-13T18:00:00.000Z");

describe("sequence scheduler", () => {
  it("sends an email step through the hidden nurture campaign and completes", async () => {
    await withTestDb(async (db) => {
      const { user, person, sequenceId } = await setup(db);
      await activate(db, user.id, sequenceId);
      const enrolled = await enrollPerson(
        db,
        { sequenceId, personId: person.id, source: "manual" },
        SIGNAL,
      );
      expect(enrolled.ok).toBe(true);

      const [step] = await db
        .select()
        .from(sequenceSteps)
        .where(eq(sequenceSteps.sequenceId, sequenceId));
      expect(step?.campaignId).not.toBeNull();

      const mails: SystemMail[] = [];
      const tick = await runSequenceTick(db, SIGNAL, {
        send: fakeSend(mails),
        now: () => WEDNESDAY,
      });
      expect(tick.ok).toBe(true);
      expect(mails).toHaveLength(1);
      expect(mails[0]?.subject).toBe("A quick note");
      expect(mails[0]?.headers?.["X-Dealflow-Campaign"]).toBe(step?.campaignId);
      expect(mails[0]?.headers?.["List-Unsubscribe"]).toContain("/u/");

      const [enrollment] = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(enrollment?.status).toBe("completed");
      expect(enrollment?.currentPosition).toBe(1);

      const [recipient] = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, step?.campaignId ?? ""));
      expect(recipient?.status).toBe("sent");

      const timeline = await db.select().from(changeLogs).where(eq(changeLogs.entityId, person.id));
      expect(
        timeline.some(
          (row) =>
            (row.newValue as { label?: string } | null)?.label === "Campaign sent: Welcome step 1",
        ),
      ).toBe(true);

      const visible = await listCampaigns(db, SIGNAL);
      expect(visible.some((campaign) => campaign.id === step?.campaignId)).toBe(false);

      const view = await getSequenceEditorView(db, admin(user.id), sequenceId, SIGNAL);
      expect(view?.steps[0]?.stats?.sent).toBe(1);
    });
  });

  it("adjusts a wait into the send window (Friday evening to Monday start)", async () => {
    await withTestDb(async (db) => {
      const window: SendWindow = {
        weekdaysOnly: true,
        startHour: 9,
        endHour: 17,
        timezone: "UTC",
      };
      const { user, person, sequenceId } = await setup(db, {
        sendWindow: window,
        steps: [{ kind: "wait", waitMinutes: 60 }, defaultSequenceEmailStep()],
      });
      await activate(db, user.id, sequenceId);
      await dueEnrollment(db, sequenceId, person.id, FRIDAY_EVENING);

      const mails: SystemMail[] = [];
      const tick = await runSequenceTick(db, SIGNAL, {
        send: fakeSend(mails),
        now: () => FRIDAY_EVENING,
      });
      expect(tick.ok).toBe(true);
      expect(mails).toHaveLength(0);

      const [enrollment] = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(enrollment?.currentPosition).toBe(1);
      expect(enrollment?.nextRunAt?.toISOString()).toBe("2026-11-16T09:00:00.000Z");
    });
  });

  it("exits when the person unsubscribes before the next step", async () => {
    await withTestDb(async (db) => {
      const { user, person, sequenceId } = await setup(db);
      await activate(db, user.id, sequenceId);
      await dueEnrollment(db, sequenceId, person.id, WEDNESDAY);
      await db
        .update(personMarketing)
        .set({ status: "unsubscribed" })
        .where(eq(personMarketing.personId, person.id));

      const mails: SystemMail[] = [];
      const tick = await runSequenceTick(db, SIGNAL, {
        send: fakeSend(mails),
        now: () => WEDNESDAY,
      });
      expect(tick.ok).toBe(true);
      expect(mails).toHaveLength(0);

      const [enrollment] = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(enrollment?.status).toBe("exited");
      expect(enrollment?.exitReason).toBe("status_unsubscribed");
    });
  });

  it("leaves enrollments waiting while the sequence is paused, then resumes", async () => {
    await withTestDb(async (db) => {
      const { user, person, sequenceId } = await setup(db);
      await activate(db, user.id, sequenceId);
      await dueEnrollment(db, sequenceId, person.id, WEDNESDAY);
      await db.update(sequences).set({ status: "paused" }).where(eq(sequences.id, sequenceId));

      const mails: SystemMail[] = [];
      await runSequenceTick(db, SIGNAL, { send: fakeSend(mails), now: () => WEDNESDAY });
      expect(mails).toHaveLength(0);
      const [waiting] = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(waiting?.status).toBe("active");

      await activate(db, user.id, sequenceId);
      await runSequenceTick(db, SIGNAL, { send: fakeSend(mails), now: () => WEDNESDAY });
      expect(mails).toHaveLength(1);
    });
  });

  it("exits when a deal for the person is won after enrollment", async () => {
    await withTestDb(async (db) => {
      const { user, person, sequenceId } = await setup(db, {
        exit: { dealWon: true, replied: false, filter: null },
      });
      await activate(db, user.id, sequenceId);
      await dueEnrollment(db, sequenceId, person.id, WEDNESDAY);
      const { pipeline, stages: pipelineStages } = await seedPipelineWithStages(db, ["Lead"]);
      const stage = pipelineStages[0];
      if (stage === undefined) return;
      await db.insert(deals).values({
        title: "Won deal",
        pipelineId: pipeline.id,
        stageId: stage.id,
        ownerId: user.id,
        personId: person.id,
        status: "won",
        visibilityLevel: "all",
        updatedAt: new Date("2026-11-11T10:00:00.000Z"),
      });

      const mails: SystemMail[] = [];
      await runSequenceTick(db, SIGNAL, { send: fakeSend(mails), now: () => WEDNESDAY });
      expect(mails).toHaveLength(0);
      const [enrollment] = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(enrollment?.status).toBe("exited");
      expect(enrollment?.exitReason).toBe("deal_won");
    });
  });

  it("never sends twice under two concurrent ticks", async () => {
    await withTestDb(async (db) => {
      const { user, person, sequenceId } = await setup(db);
      await activate(db, user.id, sequenceId);
      await dueEnrollment(db, sequenceId, person.id, WEDNESDAY);

      const mails: SystemMail[] = [];
      await Promise.all([
        runSequenceTick(db, SIGNAL, { send: fakeSend(mails, 40), now: () => WEDNESDAY }),
        runSequenceTick(db, SIGNAL, { send: fakeSend(mails, 40), now: () => WEDNESDAY }),
      ]);
      expect(mails).toHaveLength(1);
    });
  });

  it("requires a postal address and a verified sender to activate", async () => {
    await withTestDb(async (db) => {
      const noAddress = await setup(db, { postalAddress: null });
      const addressError = await activateSequence(
        db,
        admin(noAddress.user.id),
        noAddress.sequenceId,
        SIGNAL,
      );
      expect(addressError.ok).toBe(false);
      if (!addressError.ok) expect(addressError.error.id).toBe("E_CAMPAIGN_005");

      const unverified = await setup(db, { verifiedSender: false });
      const senderError = await activateSequence(
        db,
        admin(unverified.user.id),
        unverified.sequenceId,
        SIGNAL,
      );
      expect(senderError.ok).toBe(false);
      if (!senderError.ok) expect(senderError.error.id).toBe("E_CAMPAIGN_004");
    });
  });
});

describe("sequence entries and exits", () => {
  it("does not re-enroll a segment member who leaves and returns, unless re-entry is allowed", async () => {
    await withTestDb(async (db) => {
      const { user, person, sender, sequenceId } = await setup(db);
      const [filter] = await db
        .insert(savedFilters)
        .values({
          name: "Ada",
          targetEntity: "person",
          definition: {
            combinator: "and",
            conditions: [{ field: "name", op: "contains", value: "Ada" }],
          },
          ownerId: user.id,
          isShared: true,
        })
        .returning();
      if (filter === undefined)
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "filter insert failed");
      const entry: SequenceEntry = {
        manual: true,
        automation: true,
        segment: { savedFilterId: filter.id, allowReentry: false },
      };
      const updated = await updateSequence(
        db,
        admin(user.id),
        sequenceId,
        {
          name: "Welcome",
          senderId: sender.id,
          replyTo: null,
          entry,
          exit: DEFAULT_SEQUENCE_EXIT,
          sendWindow: DEFAULT_SEND_WINDOW,
          steps: [defaultSequenceEmailStep()],
        },
        SIGNAL,
      );
      expect(updated.ok).toBe(true);
      await activate(db, user.id, sequenceId);

      await syncSegmentEntries(db, SIGNAL);
      let rows = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(rows).toHaveLength(1);

      await db.update(persons).set({ name: "Bob Person" }).where(eq(persons.id, person.id));
      await syncSegmentEntries(db, SIGNAL);
      await db.update(persons).set({ name: "Ada Person" }).where(eq(persons.id, person.id));
      await syncSegmentEntries(db, SIGNAL);
      rows = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(rows).toHaveLength(1);
    });
  });

  it("re-enrolls after the member leaves when re-entry is allowed", async () => {
    await withTestDb(async (db) => {
      const { user, person, sender, sequenceId } = await setup(db);
      const [filter] = await db
        .insert(savedFilters)
        .values({
          name: "Ada",
          targetEntity: "person",
          definition: {
            combinator: "and",
            conditions: [{ field: "name", op: "contains", value: "Ada" }],
          },
          ownerId: user.id,
          isShared: true,
        })
        .returning();
      if (filter === undefined)
        throw new AppError(ERROR_IDS.DB_INSERT_FAILED, "filter insert failed");
      await updateSequence(
        db,
        admin(user.id),
        sequenceId,
        {
          name: "Welcome",
          senderId: sender.id,
          replyTo: null,
          entry: {
            manual: true,
            automation: true,
            segment: { savedFilterId: filter.id, allowReentry: true },
          },
          exit: DEFAULT_SEQUENCE_EXIT,
          sendWindow: DEFAULT_SEND_WINDOW,
          steps: [defaultSequenceEmailStep()],
        },
        SIGNAL,
      );
      await activate(db, user.id, sequenceId);
      await syncSegmentEntries(db, SIGNAL);
      const [first] = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(first).toBeDefined();
      await db
        .update(sequenceEnrollments)
        .set({ status: "completed" })
        .where(eq(sequenceEnrollments.id, first?.id ?? ""));

      await db.update(persons).set({ name: "Bob Person" }).where(eq(persons.id, person.id));
      await syncSegmentEntries(db, SIGNAL);
      expect(
        await db
          .select()
          .from(sequenceSegmentMembers)
          .where(eq(sequenceSegmentMembers.sequenceId, sequenceId)),
      ).toHaveLength(0);

      await db.update(persons).set({ name: "Ada Person" }).where(eq(persons.id, person.id));
      await syncSegmentEntries(db, SIGNAL);
      const rows = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(rows).toHaveLength(2);
    });
  });

  it("enrolls once through the automation action", async () => {
    await withTestDb(async (db) => {
      const { user, person, sequenceId } = await setup(db);
      await activate(db, user.id, sequenceId);
      await import("@/features/automations/actions/index");
      const { getActionHandler } = await import("@/features/automations/actions/registry");
      const handler = getActionHandler("enroll_in_sequence");
      expect(handler).toBeDefined();
      if (handler === undefined) return;
      const action = { type: "enroll_in_sequence" as const, sequenceId };
      const ctx = {
        db,
        actor: admin(user.id),
        automationId: "00000000-0000-4000-8000-000000000001",
        entityType: "person",
        entityId: person.id,
        dealId: null,
        definition: {
          trigger: { type: "person.created" as const },
          condition: null,
          actions: [action],
        },
        signal: SIGNAL,
      };
      const first = await handler(ctx, action);
      const second = await handler(ctx, action);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(second.detail).toBe("already enrolled");
      const rows = await db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, sequenceId));
      expect(rows).toHaveLength(1);
    });
  });
});
