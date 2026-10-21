import type { Action, AutomationDefinition, Trigger } from "../definition";

export interface EditorLookups {
  pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
  users: { id: string; name: string }[];
  activityTypes: { id: string; name: string }[];
  emailTemplates: { id: string; name: string }[];
}

export type TriggerType = Trigger["type"];

export function defaultTrigger(type: TriggerType): Trigger {
  switch (type) {
    case "deal.updated":
      return { type: "deal.updated" };
    case "form.submitted":
      return { type: "form.submitted" };
    case "booking.created":
    case "booking.cancelled":
      return { type };
    case "deal.stage_changed":
      return { type: "deal.stage_changed" };
    case "document.sent":
    case "document.viewed":
    case "document.accepted":
    case "document.declined":
    case "invoice.overdue":
    case "invoice.paid":
      return { type };
    case "deal.created":
    case "deal.won":
    case "deal.lost":
    case "deal.deleted":
    case "deal.rotting":
    case "person.created":
    case "organization.created":
    case "activity.created":
    case "activity.completed":
      return { type };
  }
}

export function defaultAction(type: Action["type"], lookups: EditorLookups): Action {
  switch (type) {
    case "update_deal":
      return { type: "update_deal", set: { expectedCloseInDays: 7 } };
    case "create_activity":
      return {
        type: "create_activity",
        activityTypeId: lookups.activityTypes[0]?.id ?? "",
        subject: "Follow up with {{person.name}}",
        dueInDays: 1,
        assignee: "deal_owner",
      };
    case "add_note":
      return { type: "add_note", body: "{{deal.title}} changed" };
    case "notify_user":
      return { type: "notify_user", to: "deal_owner", message: "{{deal.title}} changed" };
    case "send_email":
      return {
        type: "send_email",
        templateId: lookups.emailTemplates[0]?.id ?? "",
        to: "deal_person",
      };
    case "ai_summarize_deal":
      return { type: "ai_summarize_deal" };
    case "ai_score_deal":
      return { type: "ai_score_deal" };
    case "ai_draft_email":
      return { type: "ai_draft_email", instructions: "Follow up on our last conversation" };
  }
}

export function defaultDefinition(lookups: EditorLookups): AutomationDefinition {
  return {
    trigger: { type: "deal.won" },
    condition: null,
    actions: [defaultAction("create_activity", lookups)],
  };
}
