import { describe, expect, it } from "vitest";
import {
  automationDefinitionSchema,
  conditionTarget,
  matchesTrigger,
  type Trigger,
} from "./definition";

const PIPELINE = "11111111-1111-4111-8111-111111111111";
const OTHER_PIPELINE = "22222222-2222-4222-8222-222222222222";
const STAGE = "33333333-3333-4333-8333-333333333333";
const ACTIVITY_TYPE = "44444444-4444-4444-8444-444444444444";
const TEMPLATE = "55555555-5555-4555-8555-555555555555";
const USER = "66666666-6666-4666-8666-666666666666";
const FORM = "77777777-7777-4777-8777-777777777777";
const OTHER_FORM = "88888888-8888-4888-8888-888888888888";

const VALID_TRIGGERS: Trigger[] = [
  { type: "deal.created" },
  { type: "deal.created", pipelineId: PIPELINE },
  { type: "deal.updated", pipelineId: PIPELINE, fields: ["stageId", "ownerId"] },
  { type: "deal.stage_changed", pipelineId: PIPELINE, stageId: STAGE },
  { type: "deal.won" },
  { type: "deal.lost" },
  { type: "deal.deleted" },
  { type: "deal.rotting" },
  { type: "person.created" },
  { type: "organization.created" },
  { type: "activity.created" },
  { type: "activity.completed" },
  { type: "document.sent", kind: "quote" },
  { type: "document.viewed" },
  { type: "document.accepted", kind: "invoice" },
  { type: "document.declined" },
  { type: "invoice.overdue", kind: "invoice" },
  { type: "invoice.paid" },
];

const VALID_ACTIONS = [
  { type: "update_deal", set: { stageId: STAGE } },
  { type: "update_deal", set: { status: "won" } },
  { type: "update_deal", set: { ownerId: USER, expectedCloseInDays: 30 } },
  {
    type: "create_activity",
    activityTypeId: ACTIVITY_TYPE,
    subject: "Call {{person.name}}",
    dueInDays: 2,
    assignee: "deal_owner",
  },
  {
    type: "create_activity",
    activityTypeId: ACTIVITY_TYPE,
    subject: "Follow up",
    dueInDays: 0,
    assignee: { userId: USER },
  },
  { type: "add_note", body: "Won: {{deal.title}}" },
  { type: "notify_user", to: "deal_owner", message: "Quote accepted" },
  { type: "notify_user", to: { userId: USER }, message: "Quote accepted" },
  { type: "send_email", templateId: TEMPLATE, to: "deal_person" },
  { type: "ai_summarize_deal" },
  { type: "ai_score_deal" },
  { type: "ai_draft_email", instructions: "Write a friendly follow-up" },
];

describe("automationDefinitionSchema", () => {
  it("parses every trigger type", () => {
    for (const trigger of VALID_TRIGGERS) {
      const parsed = automationDefinitionSchema.parse({
        trigger,
        condition: null,
        actions: [{ type: "ai_score_deal" }],
      });
      expect(parsed.trigger.type).toBe(trigger.type);
    }
  });

  it("parses every action type", () => {
    for (const action of VALID_ACTIONS) {
      const parsed = automationDefinitionSchema.parse({
        trigger: { type: "deal.won" },
        condition: null,
        actions: [action],
      });
      expect(parsed.actions).toHaveLength(1);
    }
  });

  it("parses a condition", () => {
    const parsed = automationDefinitionSchema.parse({
      trigger: { type: "deal.stage_changed", stageId: STAGE },
      condition: {
        combinator: "and",
        conditions: [{ field: "value", op: "gt", value: 10000 }],
      },
      actions: [{ type: "ai_summarize_deal" }],
    });
    expect(parsed.condition?.conditions).toHaveLength(1);
  });

  it("refuses an empty action list", () => {
    expect(
      automationDefinitionSchema.safeParse({
        trigger: { type: "deal.won" },
        condition: null,
        actions: [],
      }).success,
    ).toBe(false);
  });

  it("refuses more than ten actions", () => {
    expect(
      automationDefinitionSchema.safeParse({
        trigger: { type: "deal.won" },
        condition: null,
        actions: Array.from({ length: 11 }, () => ({ type: "ai_score_deal" })),
      }).success,
    ).toBe(false);
  });

  it("refuses an update_deal with an empty set", () => {
    expect(
      automationDefinitionSchema.safeParse({
        trigger: { type: "deal.won" },
        condition: null,
        actions: [{ type: "update_deal", set: {} }],
      }).success,
    ).toBe(false);
  });

  it("refuses out-of-range numbers and bad enum values", () => {
    const base = { trigger: { type: "deal.won" }, condition: null };
    expect(
      automationDefinitionSchema.safeParse({
        ...base,
        actions: [
          {
            type: "create_activity",
            activityTypeId: ACTIVITY_TYPE,
            subject: "Follow up",
            dueInDays: 366,
            assignee: "deal_owner",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      automationDefinitionSchema.safeParse({
        ...base,
        actions: [{ type: "update_deal", set: { status: "open" } }],
      }).success,
    ).toBe(false);
    expect(
      automationDefinitionSchema.safeParse({
        ...base,
        actions: [{ type: "send_email", templateId: TEMPLATE, to: "deal_owner" }],
      }).success,
    ).toBe(false);
  });
});

describe("matchesTrigger", () => {
  const base = {
    changes: [] as { field: string }[],
    pipelineId: PIPELINE as string | null,
    stageId: STAGE as string | null,
    documentKind: null as "quote" | "invoice" | null,
    formId: null as string | null,
  };

  it("requires the event type to match", () => {
    expect(matchesTrigger({ type: "deal.won" }, { ...base, type: "deal.lost" })).toBe(false);
    expect(matchesTrigger({ type: "deal.won" }, { ...base, type: "deal.won" })).toBe(true);
  });

  it("filters on the pipeline when one is set", () => {
    const trigger: Trigger = { type: "deal.created", pipelineId: OTHER_PIPELINE };
    expect(matchesTrigger(trigger, { ...base, type: "deal.created" })).toBe(false);
    expect(
      matchesTrigger(trigger, { ...base, type: "deal.created", pipelineId: OTHER_PIPELINE }),
    ).toBe(true);
  });

  it("fires deal.updated only for the listed fields", () => {
    const trigger: Trigger = { type: "deal.updated", fields: ["stageId", "value"] };
    expect(
      matchesTrigger(trigger, { ...base, type: "deal.updated", changes: [{ field: "title" }] }),
    ).toBe(false);
    expect(
      matchesTrigger(trigger, { ...base, type: "deal.updated", changes: [{ field: "value" }] }),
    ).toBe(true);
  });

  it("treats an unset or empty field list as any change", () => {
    expect(
      matchesTrigger({ type: "deal.updated" }, { ...base, type: "deal.updated", changes: [] }),
    ).toBe(true);
    expect(
      matchesTrigger(
        { type: "deal.updated", fields: [] },
        { ...base, type: "deal.updated", changes: [{ field: "title" }] },
      ),
    ).toBe(true);
  });

  it("fires deal.stage_changed only for the entered stage", () => {
    const trigger: Trigger = { type: "deal.stage_changed", stageId: STAGE };
    expect(
      matchesTrigger(trigger, {
        ...base,
        type: "deal.stage_changed",
        stageId: OTHER_PIPELINE,
      }),
    ).toBe(false);
    expect(matchesTrigger(trigger, { ...base, type: "deal.stage_changed" })).toBe(true);
  });

  it("filters a form trigger by form id", () => {
    const trigger: Trigger = { type: "form.submitted", formId: FORM };
    expect(matchesTrigger(trigger, { ...base, type: "form.submitted", formId: OTHER_FORM })).toBe(
      false,
    );
    expect(matchesTrigger(trigger, { ...base, type: "form.submitted", formId: FORM })).toBe(true);
    expect(matchesTrigger({ type: "form.submitted" }, { ...base, type: "form.submitted" })).toBe(
      true,
    );
  });

  it("fires booking triggers regardless of extra fields", () => {
    expect(matchesTrigger({ type: "booking.created" }, { ...base, type: "booking.created" })).toBe(
      true,
    );
    expect(
      matchesTrigger({ type: "booking.cancelled" }, { ...base, type: "booking.cancelled" }),
    ).toBe(true);
    expect(
      matchesTrigger({ type: "booking.created" }, { ...base, type: "booking.cancelled" }),
    ).toBe(false);
  });

  it("filters document and invoice events by kind", () => {
    const quote: Trigger = { type: "document.sent", kind: "quote" };
    expect(matchesTrigger(quote, { ...base, type: "document.sent", documentKind: "invoice" })).toBe(
      false,
    );
    expect(matchesTrigger(quote, { ...base, type: "document.sent", documentKind: "quote" })).toBe(
      true,
    );
    expect(
      matchesTrigger(
        { type: "invoice.overdue", kind: "invoice" },
        {
          ...base,
          type: "invoice.overdue",
          documentKind: "invoice",
        },
      ),
    ).toBe(true);
    expect(
      matchesTrigger(
        { type: "invoice.paid" },
        { ...base, type: "invoice.paid", documentKind: null },
      ),
    ).toBe(true);
  });
});

describe("conditionTarget", () => {
  it("targets the contact for person and organization creates", () => {
    expect(conditionTarget({ type: "person.created" })).toBe("person");
    expect(conditionTarget({ type: "organization.created" })).toBe("organization");
  });

  it("targets the related deal for deal, activity, document and invoice events", () => {
    expect(conditionTarget({ type: "deal.updated" })).toBe("deal");
    expect(conditionTarget({ type: "activity.completed" })).toBe("deal");
    expect(conditionTarget({ type: "document.accepted" })).toBe("deal");
    expect(conditionTarget({ type: "invoice.paid" })).toBe("deal");
    expect(conditionTarget({ type: "invoice.overdue" })).toBe("deal");
  });

  it("targets the visitor's person for form and booking events", () => {
    expect(conditionTarget({ type: "form.submitted" })).toBe("person");
    expect(conditionTarget({ type: "booking.created" })).toBe("person");
    expect(conditionTarget({ type: "booking.cancelled" })).toBe("person");
  });
});
