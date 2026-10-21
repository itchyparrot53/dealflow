"use client";

import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { AUTOMATION_MAX_ACTIONS } from "@/constants/automations";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { ACTION_TYPES, type Action } from "../definition";
import { defaultAction, type EditorLookups } from "./types";

const S = AUTOMATIONS_STRINGS;

function userOptions(lookups: EditorLookups): { value: string; label: string }[] {
  return lookups.users.map((user) => ({ value: `user:${user.id}`, label: user.name }));
}

function ActionFields({
  action,
  onChange,
  lookups,
}: {
  action: Action;
  onChange: (action: Action) => void;
  lookups: EditorLookups;
}): React.ReactNode {
  switch (action.type) {
    case "update_deal": {
      const { set } = action;
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={set.stageId ?? ""}
            onChange={(next) =>
              onChange({
                ...action,
                set: { ...set, stageId: next === "" ? undefined : next },
              })
            }
            options={[
              { value: "", label: "Keep stage" },
              ...lookups.pipelines.flatMap((pipeline) =>
                pipeline.stages.map((stage) => ({ value: stage.id, label: stage.name })),
              ),
            ]}
            ariaLabel={S.fields.stage}
          />
          <Select
            value={set.ownerId === undefined ? "" : `user:${set.ownerId}`}
            onChange={(next) =>
              onChange({
                ...action,
                set: { ...set, ownerId: next === "" ? undefined : next.slice("user:".length) },
              })
            }
            options={[{ value: "", label: "Keep owner" }, ...userOptions(lookups)]}
            ariaLabel={S.fields.owner}
          />
          <Select
            value={set.status ?? ""}
            onChange={(next) =>
              onChange({
                ...action,
                set: {
                  ...set,
                  status: next === "won" || next === "lost" ? next : undefined,
                },
              })
            }
            options={[
              { value: "", label: S.fields.statusNone },
              { value: "won", label: S.fields.won },
              { value: "lost", label: S.fields.lost },
            ]}
            ariaLabel={S.fields.status}
          />
          <Input
            value={set.expectedCloseInDays === undefined ? "" : String(set.expectedCloseInDays)}
            onChange={(event) => {
              const raw = event.target.value.trim();
              const days = raw === "" ? undefined : Number(raw);
              onChange({
                ...action,
                set: {
                  ...set,
                  expectedCloseInDays: days === undefined || Number.isNaN(days) ? undefined : days,
                },
              });
            }}
            inputMode="numeric"
            placeholder={S.fields.closeInDays}
            aria-label={S.fields.closeInDays}
          />
        </div>
      );
    }
    case "create_activity":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={action.activityTypeId}
            onChange={(next) => onChange({ ...action, activityTypeId: next })}
            options={lookups.activityTypes.map((type) => ({ value: type.id, label: type.name }))}
            ariaLabel={S.fields.activityType}
          />
          <Input
            value={action.subject}
            onChange={(event) => onChange({ ...action, subject: event.target.value })}
            placeholder={S.fields.subject}
            aria-label={S.fields.subject}
          />
          <Input
            value={String(action.dueInDays)}
            onChange={(event) => onChange({ ...action, dueInDays: Number(event.target.value) })}
            inputMode="numeric"
            placeholder={S.fields.dueInDays}
            aria-label={S.fields.dueInDays}
          />
          <Select
            value={
              typeof action.assignee === "string"
                ? action.assignee
                : `user:${action.assignee.userId}`
            }
            onChange={(next) =>
              onChange({
                ...action,
                assignee:
                  next === "deal_owner" || next === "automation_owner"
                    ? next
                    : { userId: next.slice("user:".length) },
              })
            }
            options={[
              { value: "deal_owner", label: S.fields.dealOwner },
              { value: "automation_owner", label: S.fields.automationOwner },
              ...userOptions(lookups),
            ]}
            ariaLabel={S.fields.assignee}
          />
        </div>
      );
    case "add_note":
      return (
        <Textarea
          value={action.body}
          onChange={(event) => onChange({ ...action, body: event.target.value })}
          aria-label={S.fields.note}
          rows={3}
        />
      );
    case "notify_user":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={typeof action.to === "string" ? action.to : `user:${action.to.userId}`}
            onChange={(next) =>
              onChange({
                ...action,
                to:
                  next === "deal_owner" || next === "automation_owner"
                    ? next
                    : { userId: next.slice("user:".length) },
              })
            }
            options={[
              { value: "deal_owner", label: S.fields.dealOwner },
              { value: "automation_owner", label: S.fields.automationOwner },
              ...userOptions(lookups),
            ]}
            ariaLabel={S.fields.recipient}
          />
          <Input
            value={action.message}
            onChange={(event) => onChange({ ...action, message: event.target.value })}
            placeholder={S.fields.message}
            aria-label={S.fields.message}
          />
        </div>
      );
    case "send_email":
      return (
        <Select
          value={action.templateId}
          onChange={(next) => onChange({ ...action, templateId: next })}
          options={lookups.emailTemplates.map((template) => ({
            value: template.id,
            label: template.name,
          }))}
          ariaLabel={S.fields.emailTemplate}
        />
      );
    case "ai_draft_email":
      return (
        <Input
          value={action.instructions}
          onChange={(event) => onChange({ ...action, instructions: event.target.value })}
          placeholder={S.fields.instructions}
          aria-label={S.fields.instructions}
        />
      );
    case "create_project":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={action.nameTemplate ?? ""}
            onChange={(event) =>
              onChange({
                ...action,
                nameTemplate: event.target.value === "" ? undefined : event.target.value,
              })
            }
            placeholder="{{deal.title}}"
            aria-label={S.fields.projectName}
          />
          <Input
            value={(action.phases ?? []).join(", ")}
            onChange={(event) => {
              const phases = event.target.value
                .split(",")
                .map((phase) => phase.trim())
                .filter((phase) => phase !== "")
                .slice(0, 10);
              onChange({ ...action, phases: phases.length === 0 ? undefined : phases });
            }}
            placeholder={S.fields.projectPhases}
            aria-label={S.fields.projectPhases}
          />
        </div>
      );
    case "ai_summarize_deal":
    case "ai_score_deal":
      return <p className="text-sm text-muted-foreground">{S.actionTypes[action.type]}</p>;
  }
}

export function ActionList({
  actions,
  onChange,
  lookups,
}: {
  actions: Action[];
  onChange: (actions: Action[]) => void;
  lookups: EditorLookups;
}): React.ReactNode {
  function replace(index: number, action: Action): void {
    onChange(actions.map((current, i) => (i === index ? action : current)));
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    const current = next[index];
    const swap = next[target];
    if (current === undefined || swap === undefined) return;
    next[index] = swap;
    next[target] = current;
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{S.editor.thenLabel}</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <Info className="mr-1 size-4" />
              {S.editor.variables}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="text-sm">{S.editor.variablesHelp}</PopoverContent>
        </Popover>
      </div>

      {actions.map((action, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: action rows are positional and reorder by index
          key={index}
          className="space-y-2 rounded-md border p-3"
          data-testid="automation-action"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{index + 1}</span>
            <Select
              value={action.type}
              onChange={(next) => replace(index, defaultAction(next as Action["type"], lookups))}
              options={ACTION_TYPES.map((type) => ({ value: type, label: S.actionTypes[type] }))}
              ariaLabel={S.editor.thenLabel}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={S.editor.moveUp}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={S.editor.moveDown}
              disabled={index === actions.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={S.editor.removeAction}
              onClick={() => onChange(actions.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <ActionFields
            action={action}
            onChange={(next) => replace(index, next)}
            lookups={lookups}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="automation-action-add"
        disabled={actions.length >= AUTOMATION_MAX_ACTIONS}
        onClick={() => onChange([...actions, defaultAction("add_note", lookups)])}
      >
        <Plus className="mr-1 size-4" />
        {S.editor.addAction}
      </Button>
      {actions.length >= AUTOMATION_MAX_ACTIONS ? (
        <p className="text-xs text-muted-foreground">{S.editor.maxActions}</p>
      ) : null}
    </div>
  );
}
