"use client";

import { ConditionRowsBuilder, type RawCondition } from "@/components/filters/ConditionRowsBuilder";
import { Select } from "@/components/ui/Select";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { dealFilterFields, OP_LABELS } from "@/features/deals/dealFilterCatalog";
import type { FilterDefinition } from "@/features/saved-filters/schemas";
import { trpc } from "@/lib/trpc-client";
import type { ActivityFilter, ReportDefinition } from "../definition";

const S = INSIGHTS_STRINGS;

// The report's filter. Deals reuse Part 5's condition builder (the same field and operator
// allow-list the deals list uses); activities get the three inputs their definition allows,
// because an activity filter is not an AST.

interface Props {
  definition: ReportDefinition;
  onChange: (next: ReportDefinition) => void;
  stages: readonly { id: string; name: string }[];
}

function toRows(filter: FilterDefinition | null): RawCondition[] {
  return (filter?.conditions ?? []).map((condition) => {
    const value = condition.value;
    return {
      field: condition.field,
      op: condition.op,
      value: typeof value === "number" ? String(value) : (value ?? ""),
    };
  });
}

function DealFilter({
  definition,
  onChange,
  stages,
}: {
  definition: Extract<ReportDefinition, { entity: "deal" }>;
  onChange: (next: ReportDefinition) => void;
  stages: readonly { id: string; name: string }[];
}) {
  const owners = trpc.identity.assignableUsers.useQuery(undefined, { staleTime: 30_000 });
  const fields = dealFilterFields({
    owners: owners.data ?? [],
    stages: [...stages],
  });
  const filter = definition.filter;

  function apply(rows: RawCondition[], combinator: "and" | "or"): void {
    const next: FilterDefinition | null =
      rows.length === 0 ? null : ({ combinator, conditions: rows } as unknown as FilterDefinition);
    onChange({ ...definition, filter: next });
  }

  return (
    <div className="flex items-center gap-2">
      <ConditionRowsBuilder
        fields={fields}
        opLabels={OP_LABELS}
        activeCount={filter?.conditions.length ?? 0}
        appliedRows={toRows(filter)}
        appliedCombinator={filter?.combinator ?? "and"}
        onApply={apply}
        onClear={() => onChange({ ...definition, filter: null })}
      />
    </div>
  );
}

function ActivityFilterPanel({
  definition,
  onChange,
}: {
  definition: Extract<ReportDefinition, { entity: "activity" }>;
  onChange: (next: ReportDefinition) => void;
}) {
  const owners = trpc.identity.assignableUsers.useQuery(undefined, { staleTime: 30_000 });
  const types = trpc.activities.listTypes.useQuery(undefined, { staleTime: 30_000 });
  const filter = definition.filter ?? {};
  const ownerId = filter.ownerIds?.[0] ?? "";
  const typeId = filter.activityTypeIds?.[0] ?? "";

  function patch(next: ActivityFilter): void {
    const empty =
      (next.ownerIds?.length ?? 0) === 0 &&
      (next.activityTypeIds?.length ?? 0) === 0 &&
      next.done === undefined;
    onChange({ ...definition, filter: empty ? null : next });
  }

  const ANY = { value: "", label: S.ui.any };
  return (
    <div className="grid grid-cols-3 gap-2">
      <Select
        ariaLabel="Filter activity owner"
        value={ownerId}
        onChange={(value) => patch({ ...filter, ownerIds: value === "" ? [] : [value] })}
        options={[
          ANY,
          ...(owners.data ?? []).map((owner) => ({ value: owner.id, label: owner.name })),
        ]}
      />
      <Select
        ariaLabel="Filter activity type"
        value={typeId}
        onChange={(value) => patch({ ...filter, activityTypeIds: value === "" ? [] : [value] })}
        options={[ANY, ...(types.data ?? []).map((type) => ({ value: type.id, label: type.name }))]}
      />
      <Select
        ariaLabel="Filter activity done"
        value={filter.done === undefined ? "" : filter.done ? "done" : "open"}
        onChange={(value) =>
          patch({
            ...filter,
            done: value === "" ? undefined : value === "done",
          })
        }
        options={[ANY, { value: "done", label: S.ui.done }, { value: "open", label: S.ui.notDone }]}
      />
    </div>
  );
}

export function ReportFilterPanel({ definition, onChange, stages }: Props): React.ReactNode {
  return (
    <div data-testid="report-filter" className="space-y-2">
      <p className="text-meta font-semibold text-muted-foreground">{S.ui.filter}</p>
      {definition.entity === "deal" ? (
        <DealFilter definition={definition} onChange={onChange} stages={stages} />
      ) : (
        <ActivityFilterPanel definition={definition} onChange={onChange} />
      )}
    </div>
  );
}
