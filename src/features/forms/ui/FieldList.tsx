"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { FORMS_STRINGS } from "@/constants/formsBookingStrings";
import type { FormField, FormFieldKey } from "../fields";

const S = FORMS_STRINGS;

export interface CustomFieldOptionView {
  id: string;
  name: string;
  targetEntity: string;
}

const LOCKED_KEYS: ReadonlySet<FormFieldKey> = new Set<FormFieldKey>(["name", "email"]);

const FIXED_ADDABLE: { key: FormFieldKey; label: string }[] = [
  { key: "phone", label: S.fieldLabels.phone },
  { key: "organization", label: S.fieldLabels.organization },
  { key: "job_title", label: S.fieldLabels.job_title },
  { key: "message", label: S.fieldLabels.message },
];

export function FieldList({
  fields,
  onChange,
  customFields,
}: {
  fields: FormField[];
  onChange: (next: FormField[]) => void;
  customFields: CustomFieldOptionView[];
}): React.ReactNode {
  const used = new Set(fields.map((field) => field.key));
  const addOptions = [
    ...FIXED_ADDABLE.filter((entry) => !used.has(entry.key)).map((entry) => ({
      value: entry.key,
      label: entry.label,
    })),
    ...customFields
      .filter((def) => !used.has(`cf_${def.id}` as FormFieldKey))
      .map((def) => ({
        value: `cf_${def.id}`,
        label: `${def.name} (${def.targetEntity})`,
      })),
  ];

  function update(index: number, patch: Partial<FormField>): void {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  function move(index: number, delta: -1 | 1): void {
    const next = [...fields];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const current = next[index];
    const other = next[target];
    if (current === undefined || other === undefined) return;
    next[index] = other;
    next[target] = current;
    onChange(next);
  }

  function add(key: string): void {
    if (key === "") return;
    const fixed = FIXED_ADDABLE.find((entry) => entry.key === key);
    const custom = customFields.find((def) => `cf_${def.id}` === key);
    const label = fixed?.label ?? custom?.name ?? key;
    onChange([...fields, { key: key as FormFieldKey, label, required: false, placeholder: null }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{S.editor.fields}</h2>
        <Select
          value=""
          onChange={add}
          options={addOptions}
          ariaLabel={S.editor.addField}
          placeholder={addOptions.length === 0 ? S.editor.noCustomFields : S.editor.addField}
          testId="form-field-add"
        />
      </div>

      {fields.map((field, index) => {
        const locked = LOCKED_KEYS.has(field.key);
        return (
          <div
            key={field.key}
            data-testid="form-field-row"
            data-key={field.key}
            className="flex flex-wrap items-center gap-2 rounded-md border p-2"
          >
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{field.key}</span>
            <Input
              aria-label={`${S.editor.label} ${field.key}`}
              value={field.label}
              maxLength={100}
              onChange={(event) => update(index, { label: event.target.value })}
              className="w-40"
            />
            <Input
              aria-label={`${S.editor.placeholder} ${field.key}`}
              value={field.placeholder ?? ""}
              maxLength={100}
              placeholder={S.editor.placeholder}
              onChange={(event) =>
                update(index, {
                  placeholder: event.target.value === "" ? null : event.target.value,
                })
              }
              className="w-40"
            />
            <span className="flex items-center gap-1 text-xs">
              {S.editor.required}
              <Switch
                checked={field.required}
                onCheckedChange={(required) => update(index, { required })}
                label={`${S.editor.required} ${field.key}`}
                disabled={locked}
              />
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={S.editor.moveUp}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={S.editor.moveDown}
              disabled={index === fields.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={S.editor.remove}
              disabled={locked}
              onClick={() => onChange(fields.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
