"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { PROJECTS_API_STRINGS } from "@/constants/projectsApiStrings";
import type { AuditRow } from "../auditLog";

const S = PROJECTS_API_STRINGS.audit;

export function AuditLog({
  rows,
  actions,
  users,
  filters,
  nextCursor,
  hasCursor,
}: {
  rows: AuditRow[];
  actions: string[];
  users: { id: string; name: string }[];
  filters: { actorId?: string; action?: string; from?: string; to?: string; cursor?: string };
  nextCursor: string | null;
  hasCursor: boolean;
}): React.ReactNode {
  const router = useRouter();

  function push(next: Partial<typeof filters>): void {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    for (const key of ["actorId", "action", "from", "to", "cursor"] as const) {
      const value = merged[key];
      if (value !== undefined && value !== "") params.set(key, value);
    }
    const query = params.toString();
    router.push(query === "" ? "/settings/audit-log" : `/settings/audit-log?${query}`);
  }

  function page(cursor?: string): void {
    push({ cursor });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select
          value={filters.actorId ?? ""}
          onChange={(value) => push({ actorId: value, cursor: undefined })}
          options={[
            { value: "", label: S.allActors },
            ...users.map((user) => ({ value: user.id, label: user.name })),
          ]}
          ariaLabel={S.columns.actor}
          triggerClassName="h-8"
        />
        <Select
          value={filters.action ?? ""}
          onChange={(value) => push({ action: value, cursor: undefined })}
          options={[
            { value: "", label: S.allActions },
            ...actions.map((action) => ({ value: action, label: action })),
          ]}
          ariaLabel={S.columns.action}
          triggerClassName="h-8"
        />
        <DatePicker
          value={filters.from ?? null}
          onChange={(value) => push({ from: value ?? undefined, cursor: undefined })}
          ariaLabel={S.from}
          placeholder={S.from}
        />
        <DatePicker
          value={filters.to ?? null}
          onChange={(value) => push({ to: value ?? undefined, cursor: undefined })}
          ariaLabel={S.to}
          placeholder={S.to}
        />
      </div>

      <p className="text-xs text-muted-foreground">{S.redacted}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table data-testid="audit-table" className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{S.columns.time}</th>
                <th className="px-3 py-2 font-medium">{S.columns.actor}</th>
                <th className="px-3 py-2 font-medium">{S.columns.action}</th>
                <th className="px-3 py-2 font-medium">{S.columns.target}</th>
                <th className="px-3 py-2 font-medium">{S.columns.details}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-testid="audit-row" className="border-t align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    {row.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2">{row.actorName ?? S.unknownActor}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.targetType}
                    {row.targetId !== null && (
                      <span className="block text-muted-foreground">{row.targetId}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        {S.columns.details}
                      </summary>
                      <pre className="mt-1 max-w-md overflow-x-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        {hasCursor && (
          <Button type="button" variant="outline" size="sm" onClick={() => page(undefined)}>
            {S.first}
          </Button>
        )}
        {nextCursor !== null && (
          <Button type="button" variant="outline" size="sm" onClick={() => page(nextCursor)}>
            {S.next}
          </Button>
        )}
      </div>
    </div>
  );
}
