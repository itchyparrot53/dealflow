"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { backUpNowAction } from "../actions";

const S = PROJECTS_API_STRINGS.backups;

export interface BackupRunRow {
  id: string;
  fileName: string | null;
  status: "running" | "succeeded" | "failed";
  trigger: "schedule" | "manual";
  sizeBytes: number | null;
  fileCount: number | null;
  errorDetail: string | null;
  startedAt: string;
}

function size(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupsSettings({
  enabled,
  directory,
  keep,
  rows,
  nextRun,
}: {
  enabled: boolean;
  directory: string;
  keep: number;
  rows: BackupRunRow[];
  nextRun: string;
}): React.ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function backUpNow(): Promise<void> {
    setPending(true);
    setErrorId(null);
    const response = await backUpNowAction(readCsrfToken());
    setPending(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setNotice(S.queued);
    router.refresh();
  }

  const status = enabled ? S.enabled : S.disabled;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={enabled ? "success" : "secondary"}>{status}</Badge>
        <span>
          {S.directory}: <code>{directory}</code>
        </span>
        <span>
          {S.keep}: {keep}
        </span>
        <span>
          {S.nextRun}: {nextRun}
        </span>
      </div>
      {errorId !== null && (
        <p role="alert" className="text-sm text-destructive">
          {projectsErrorMessage(errorId)}
        </p>
      )}
      {notice !== null && <p className="text-sm text-muted-foreground">{notice}</p>}
      <Button
        type="button"
        data-testid="backup-now"
        disabled={pending || !enabled}
        onClick={() => void backUpNow()}
      >
        {pending ? S.pending : S.backUpNow}
      </Button>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table data-testid="backups-table" className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{S.columns.time}</th>
                <th className="px-3 py-2 font-medium">{S.columns.trigger}</th>
                <th className="px-3 py-2 font-medium">{S.columns.status}</th>
                <th className="px-3 py-2 font-medium">{S.columns.size}</th>
                <th className="px-3 py-2 font-medium">{S.columns.files}</th>
                <th className="px-3 py-2 font-medium">{S.columns.file}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-testid="backup-row" className="border-t">
                  <td className="px-3 py-2">{row.startedAt.slice(0, 19).replace("T", " ")}</td>
                  <td className="px-3 py-2">{S.triggers[row.trigger]}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        row.status === "succeeded"
                          ? "success"
                          : row.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {S.statuses[row.status]}
                    </Badge>
                    {row.errorDetail !== null && (
                      <span className="ml-2 text-xs text-muted-foreground">{row.errorDetail}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{size(row.sizeBytes)}</td>
                  <td className="px-3 py-2">{row.fileCount ?? ""}</td>
                  <td className="px-3 py-2">
                    {row.fileName === null ? (
                      ""
                    ) : row.status === "succeeded" ? (
                      <a
                        data-testid="backup-download"
                        className="underline"
                        href={`/settings/backups/${encodeURIComponent(row.fileName)}/download`}
                      >
                        {S.download}
                      </a>
                    ) : (
                      <code className="text-xs">{row.fileName}</code>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="space-y-2 rounded-lg border p-3">
        <h2 className="text-base font-medium">{S.restoreTitle}</h2>
        <p className="text-sm text-muted-foreground">{S.restoreTitleBody}</p>
        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
          {`docker compose stop app worker ws
docker compose run --rm -v ./backups:/restore worker \\
  node dist/backup-restore.mjs /restore/{{file}} \\
  --database-url "$DATABASE_URL" --files --yes
docker compose start app worker ws`}
        </pre>
      </section>
    </div>
  );
}
