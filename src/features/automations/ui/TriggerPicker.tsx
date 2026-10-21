"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { TRIGGER_TYPES, type Trigger } from "../definition";
import { defaultTrigger, type EditorLookups, type TriggerType } from "./types";

const S = AUTOMATIONS_STRINGS;

function optionList(pairs: { id: string; name: string }[]): { value: string; label: string }[] {
  return pairs.map((entry) => ({ value: entry.id, label: entry.name }));
}

export function TriggerPicker({
  value,
  onChange,
  lookups,
}: {
  value: Trigger;
  onChange: (trigger: Trigger) => void;
  lookups: EditorLookups;
}): React.ReactNode {
  const type = value.type;
  const hasPipeline = "pipelineId" in value;
  const pipelineId = "pipelineId" in value ? (value.pipelineId ?? "") : "";
  const stages = lookups.pipelines
    .filter((pipeline) => pipelineId === "" || pipeline.id === pipelineId)
    .flatMap((pipeline) => pipeline.stages);
  const kind = "kind" in value ? (value.kind ?? "") : "";
  const fields = value.type === "deal.updated" ? (value.fields ?? []).join(", ") : "";

  function withPipeline(nextPipelineId: string): Trigger {
    const base = defaultTrigger(type);
    if ("pipelineId" in base) {
      base.pipelineId = nextPipelineId === "" ? undefined : nextPipelineId;
    }
    return base;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-medium">{S.editor.when}</span>
          <Select
            value={type}
            onChange={(next) => onChange(defaultTrigger(next as TriggerType))}
            options={TRIGGER_TYPES.map((triggerType) => ({
              value: triggerType,
              label: S.triggers[triggerType],
            }))}
            ariaLabel={S.editor.when}
            testId="automation-trigger-type"
          />
        </div>

        {hasPipeline ? (
          <div>
            <span className="mb-1.5 block text-sm font-medium">Pipeline</span>
            <Select
              value={pipelineId}
              onChange={(next) => onChange(withPipeline(next))}
              options={[
                { value: "", label: S.fields.anyPipeline },
                ...optionList(lookups.pipelines),
              ]}
              ariaLabel="Pipeline"
            />
          </div>
        ) : null}

        {value.type === "deal.stage_changed" ? (
          <div>
            <span className="mb-1.5 block text-sm font-medium">{S.fields.stage}</span>
            <Select
              value={value.stageId ?? ""}
              onChange={(next) => onChange({ ...value, stageId: next === "" ? undefined : next })}
              options={[{ value: "", label: S.fields.anyStage }, ...optionList(stages)]}
              ariaLabel={S.fields.stage}
            />
          </div>
        ) : null}

        {value.type === "form.submitted" ? (
          <div>
            <span className="mb-1.5 block text-sm font-medium">Form</span>
            <Select
              value={value.formId ?? ""}
              onChange={(next) =>
                onChange({ type: "form.submitted", formId: next === "" ? undefined : next })
              }
              options={[{ value: "", label: S.fields.anyForm }, ...optionList(lookups.forms)]}
              ariaLabel="Form"
            />
          </div>
        ) : null}

        {"kind" in value ? (
          <div>
            <span className="mb-1.5 block text-sm font-medium">Document</span>
            <Select
              value={kind}
              onChange={(next) =>
                onChange({
                  ...value,
                  kind: next === "" ? undefined : (next as "quote" | "invoice"),
                })
              }
              options={[
                { value: "", label: S.fields.anyKind },
                { value: "quote", label: S.fields.quote },
                { value: "invoice", label: S.fields.invoice },
              ]}
              ariaLabel="Document kind"
            />
          </div>
        ) : null}
      </div>

      {value.type === "deal.updated" ? (
        <div>
          <span className="mb-1.5 block text-sm font-medium">Fields (comma separated)</span>
          <Input
            value={fields}
            onChange={(event) => {
              const list = event.target.value
                .split(",")
                .map((part) => part.trim())
                .filter((part) => part !== "");
              onChange({ ...value, fields: list.length === 0 ? undefined : list });
            }}
            placeholder="stageId, value"
          />
        </div>
      ) : null}
    </div>
  );
}
