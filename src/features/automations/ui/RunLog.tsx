"use client";

import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/Collapsible";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { trpc } from "@/lib/trpc-client";
import type { StepRecord } from "../runner";

const S = AUTOMATIONS_STRINGS.runLog;

const STATUS_VARIANT: Record<string, "success" | "destructive" | "secondary" | "outline"> = {
  succeeded: "success",
  failed: "destructive",
  skipped: "secondary",
  running: "outline",
};

interface RunRow {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  skipReason: string | null;
  errorId: string | null;
  steps: unknown;
  startedAt: string | Date;
  finishedAt: string | Date | null;
}

function stepsOf(value: unknown): StepRecord[] {
  return Array.isArray(value) ? (value as StepRecord[]) : [];
}

function recordHref(entityType: string, entityId: string): string | null {
  if (entityType === "deal") return `/deals/${entityId}`;
  if (entityType === "person") return `/contacts/people/${entityId}`;
  if (entityType === "organization") return `/contacts/orgs/${entityId}`;
  if (entityType === "document" || entityType === "invoice") return `/documents/${entityId}`;
  return null;
}

export function RunLog({ automationId }: { automationId: string }): React.ReactNode {
  const runs = trpc.automations.runs.useQuery({ automationId });
  const rows = (runs.data ?? []) as unknown as RunRow[];

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{S.empty}</p>;
  }

  return (
    <div className="space-y-2" data-testid="automation-runs">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">{S.time}</th>
            <th className="py-2 font-medium">{S.record}</th>
            <th className="py-2 font-medium">{S.status}</th>
            <th className="py-2 font-medium">{S.skipReason}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((run) => {
            const href = recordHref(run.entityType, run.entityId);
            const status = run.status;
            return (
              <tr
                key={run.id}
                className="border-b align-top"
                data-testid="automation-run-row"
                data-status={status}
              >
                <td className="py-2">{new Date(run.startedAt).toLocaleString()}</td>
                <td className="py-2">
                  {href === null ? (
                    run.entityType
                  ) : (
                    <a className="hover:underline" href={href}>
                      {run.entityType}
                    </a>
                  )}
                </td>
                <td className="py-2">
                  <Badge variant={STATUS_VARIANT[status]}>
                    {S.statuses[status as keyof typeof S.statuses]}
                  </Badge>
                </td>
                <td className="py-2 text-muted-foreground">
                  {run.skipReason === null
                    ? ""
                    : S.skipReasons[run.skipReason as keyof typeof S.skipReasons]}
                  {run.errorId === null ? null : (
                    <span className="ml-2 text-destructive">{run.errorId}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rows.map((run) => {
        const steps = stepsOf(run.steps);
        if (steps.length === 0) return null;
        return (
          <Collapsible key={run.id}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                <ChevronDown className="mr-1 size-4" />
                {S.steps} ({steps.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="ml-2 space-y-1 border-l pl-3 text-sm">
                {steps.map((step) => (
                  <li key={step.index} className="text-muted-foreground">
                    <span className={step.ok ? "text-success" : "text-destructive"}>
                      {step.ok ? "OK" : "FAIL"}
                    </span>{" "}
                    {step.index + 1}. {step.type}
                    {step.errorId === undefined ? null : (
                      <span className="ml-1 text-destructive">{step.errorId}</span>
                    )}
                    {step.detail === undefined ? null : (
                      <span className="ml-1">({step.detail})</span>
                    )}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
