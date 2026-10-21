"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import type { FilterDefinition } from "@/features/saved-filters/schemas";
import { FILTER_FIELDS, OPS_BY_FIELD } from "@/features/saved-filters/schemas";

const S = AUTOMATIONS_STRINGS;

const OP_LABELS: Record<string, string> = {
  eq: "is",
  neq: "is not",
  gt: "is greater than",
  lt: "is less than",
  gte: "is at least",
  lte: "is at most",
  contains: "contains",
  startsWith: "starts with",
  notContains: "does not contain",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  between: "is between",
  in: "is any of",
};

const VALUELESS = new Set(["isEmpty", "isNotEmpty"]);

type Condition = FilterDefinition["conditions"][number];

function valueToString(value: Condition["value"]): string {
  if (Array.isArray(value)) return value.join(", ");
  return value === undefined ? "" : String(value);
}

function parseValue(field: string, raw: string): string | number | string[] {
  if (field === "value") return Number(raw);
  if (field === "labels") {
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "");
  }
  return raw;
}

// A small condition builder over the deal fields the saved-filter AST supports (section 10's
// fallback): field, operator and value, ANDed. Reuses the same field/op allow-lists the list
// filters use, so a condition the UI offers always compiles.
export function ConditionEditor({
  value,
  onChange,
}: {
  value: FilterDefinition | null;
  onChange: (condition: FilterDefinition | null) => void;
}): React.ReactNode {
  const conditions = value?.conditions ?? [];

  function update(next: Condition[]): void {
    onChange(next.length === 0 ? null : { combinator: "and", conditions: next });
  }

  function changeCondition(index: number, patch: Partial<Condition>): void {
    update(
      conditions.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)),
    );
  }

  return (
    <div className="space-y-2" data-testid="automation-condition">
      {conditions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.editor.noCondition}</p>
      ) : null}

      {conditions.map((condition, index) => {
        const ops = OPS_BY_FIELD[condition.field];
        const showValue = !VALUELESS.has(condition.op);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: condition rows are positional and reorder by index
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: condition rows are positional and reorder by index
            key={index}
            className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Select
              value={condition.field}
              onChange={(field) => {
                const nextField = field as Condition["field"];
                const nextOps = OPS_BY_FIELD[nextField];
                changeCondition(index, {
                  field: nextField,
                  op: (nextOps[0] ?? "eq") as Condition["op"],
                  value: undefined,
                });
              }}
              options={FILTER_FIELDS.map((field) => ({ value: field, label: field }))}
              ariaLabel="Field"
            />
            <Select
              value={condition.op}
              onChange={(op) => changeCondition(index, { op: op as Condition["op"] })}
              options={ops.map((op) => ({ value: op, label: OP_LABELS[op] ?? op }))}
              ariaLabel="Operator"
            />
            {showValue ? (
              <Input
                value={valueToString(condition.value)}
                onChange={(event) =>
                  changeCondition(index, {
                    value: parseValue(condition.field, event.target.value),
                  })
                }
                aria-label="Value"
              />
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={S.editor.removeCondition}
              onClick={() => update(conditions.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => update([...conditions, { field: "value", op: "gt", value: 0 }])}
      >
        <Plus className="mr-1 size-4" />
        {S.editor.addCondition}
      </Button>
    </div>
  );
}
