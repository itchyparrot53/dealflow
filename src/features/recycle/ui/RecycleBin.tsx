"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { restoreItemAction } from "../actions";
import type { DeletedItem, RecycleEntity } from "../recycle";

const S = PROJECTS_API_STRINGS.recycle;

const ENTITIES: RecycleEntity[] = ["deal", "person", "organization", "activity", "lead", "project"];

export function RecycleBin({
  rows,
  filters,
}: {
  rows: DeletedItem[];
  filters: { entity?: string; search?: string };
}): React.ReactNode {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search ?? "");
  const [errorId, setErrorId] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function push(next: { entity?: string; search?: string }): void {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.entity !== undefined && merged.entity !== "") params.set("entity", merged.entity);
    if (merged.search !== undefined && merged.search !== "") params.set("search", merged.search);
    const query = params.toString();
    router.push(query === "" ? "/settings/recycle-bin" : `/settings/recycle-bin?${query}`);
  }

  async function restore(row: DeletedItem): Promise<void> {
    setPendingId(row.id);
    setErrorId(null);
    const response = await restoreItemAction({ entity: row.entity, id: row.id }, readCsrfToken());
    setPendingId(null);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setRestored(row.name);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{S.retentionNote}</p>
      {errorId !== null && (
        <p role="alert" className="text-sm text-destructive">
          {projectsErrorMessage(errorId)}
        </p>
      )}
      {restored !== null && (
        <p className="text-sm text-muted-foreground">
          {S.restored} {restored}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            push({ search });
          }}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={S.search}
            aria-label={S.search}
            className="h-8 w-56"
          />
        </form>
        <Select
          value={filters.entity ?? ""}
          onChange={(value) => push({ entity: value })}
          options={[
            { value: "", label: S.allEntities },
            ...ENTITIES.map((entity) => ({ value: entity, label: S.entities[entity] })),
          ]}
          ariaLabel={S.columns.entity}
          triggerClassName="h-8"
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table data-testid="recycle-table" className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{S.columns.entity}</th>
                <th className="px-3 py-2 font-medium">{S.columns.name}</th>
                <th className="px-3 py-2 font-medium">{S.columns.deletedAt}</th>
                <th className="px-3 py-2 font-medium">{S.columns.deletedBy}</th>
                <th className="px-3 py-2 font-medium">{S.columns.daysLeft}</th>
                <th className="px-3 py-2 font-medium">{S.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.entity}:${row.id}`}
                  data-testid="recycle-row"
                  data-entity={row.entity}
                  data-id={row.id}
                  className="border-t"
                >
                  <td className="px-3 py-2">{S.entities[row.entity]}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.deletedAt.slice(0, 10)}</td>
                  <td className="px-3 py-2">{row.deletedByName ?? S.unknownUser}</td>
                  <td className="px-3 py-2">
                    <Badge variant={row.daysLeft <= 3 ? "destructive" : "secondary"}>
                      {row.daysLeft}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="recycle-restore"
                      disabled={pendingId === row.id}
                      onClick={() => void restore(row)}
                    >
                      {S.restore}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
