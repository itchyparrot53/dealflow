"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { duplicateReportAction, updateReportAction } from "../actions";
import { describeDefinition, type ReportDefinition } from "../definition";
import { ExplainPanel } from "./ExplainPanel";
import { formatReportValue } from "./format";
import { ReportChart } from "./ReportChart";
import { ReportConfigPanel } from "./ReportConfigPanel";
import { ReportTable } from "./ReportTable";

const S = INSIGHTS_STRINGS;
const PREVIEW_DEBOUNCE_MS = 400;

// The report builder. Local state holds unsaved edits; the preview runs the unsaved definition
// through the same engine the saved report uses, debounced at 400 ms. Saving writes the name, the
// shared flag and the definition together.

interface Props {
  reportId: string;
  initial: { name: string; definition: ReportDefinition; shared: boolean };
  canEdit: boolean;
  pipelines: readonly { id: string; name: string; stages: { id: string; name: string }[] }[];
}

export function ReportBuilder({ reportId, initial, canEdit, pipelines }: Props): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [shared, setShared] = useState(initial.shared);
  const [definition, setDefinition] = useState<ReportDefinition>(initial.definition);
  const [preview, setPreview] = useState<ReportDefinition>(initial.definition);
  const [saved, setSaved] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPreview(definition), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [definition]);

  function change(next: ReportDefinition): void {
    // A new definition is by definition unsaved, so the badge clears on the edit rather than in
    // an effect.
    setSaved(false);
    setDefinition(next);
  }

  const description = useMemo(
    () =>
      describeDefinition(definition, {
        pipelineName: (id) => pipelines.find((pipeline) => pipeline.id === id)?.name ?? null,
      }),
    [definition, pipelines],
  );
  const run = trpc.insights.run.useQuery({ definition: preview }, { retry: false });
  const result = run.data;

  async function save(): Promise<void> {
    setErrorId(null);
    const response = await updateReportAction(
      reportId,
      { name, definition, shared },
      readCsrfToken(),
    );
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setSaved(true);
  }

  async function duplicate(): Promise<void> {
    setErrorId(null);
    const response = await duplicateReportAction(reportId, readCsrfToken());
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    router.push(`/insights/reports/${response.value.id}`);
  }

  const isTable = definition.chart === "table";

  return (
    <div data-testid="report-builder" className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={S.ui.reportName}
          data-testid="report-name"
          value={name}
          disabled={!canEdit}
          onChange={(event) => setName(event.target.value)}
          className="max-w-xs"
        />
        <Button
          type="button"
          data-testid="report-save"
          disabled={!canEdit}
          onClick={() => void save()}
        >
          {S.ui.save}
        </Button>
        <span className="flex items-center gap-2 text-sm">
          <Switch
            checked={shared}
            onCheckedChange={setShared}
            label={S.ui.sharedBadge}
            testId="report-share"
            disabled={!canEdit}
          />
          {S.ui.sharedBadge}
        </span>
        <Button
          type="button"
          variant="outline"
          data-testid="report-duplicate"
          disabled={!canEdit}
          onClick={() => void duplicate()}
        >
          {S.ui.duplicate}
        </Button>
        <a
          className={buttonVariants({ variant: "outline", size: "sm" })}
          data-testid="report-export-csv"
          href={`/insights/reports/${reportId}/export.csv`}
        >
          {S.ui.exportCsv}
        </a>
        <ExplainPanel definition={preview} disabled={result === undefined} />
        {saved && <span className="text-sm text-muted-foreground">{S.ui.saved}</span>}
        {errorId !== null && <span className="text-sm text-destructive">{errorId}</span>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className="rounded-lg border p-4">
          <ReportConfigPanel definition={definition} onChange={change} pipelines={pipelines} />
        </aside>

        <section className="min-w-0 space-y-3">
          {run.isLoading && <p className="text-sm text-muted-foreground">{S.ui.loading}</p>}
          {run.isError && (
            <p role="alert" className="text-sm text-destructive">
              {S.ui.error}
            </p>
          )}
          {result !== undefined && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p data-testid="report-total" className="text-sm font-medium tabular-nums">
                  {S.ui.total}:{" "}
                  {formatReportValue(result.total.value, definition, result.baseCurrency)} (
                  {result.total.count})
                </p>
                {!isTable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="report-view-as-table"
                    aria-pressed={showTable}
                    onClick={() => setShowTable((value) => !value)}
                  >
                    {showTable ? S.ui.chart : S.ui.table}
                  </Button>
                )}
              </div>

              {showTable && !isTable ? (
                <ReportTable result={result} definition={definition} />
              ) : (
                <div
                  {...(showTable || isTable
                    ? {}
                    : { role: "img" as const, "aria-label": description })}
                  data-testid="report-chart"
                  data-chart={definition.chart}
                >
                  <ReportChart result={result} definition={definition} description={description} />
                </div>
              )}

              {result.excluded.length > 0 && (
                <p data-testid="report-excluded" className="text-xs text-muted-foreground">
                  {S.ui.excludedNote
                    .replace(
                      "{n}",
                      String(result.excluded.reduce((sum, row) => sum + row.count, 0)),
                    )
                    .replace("{currencies}", result.excluded.map((row) => row.currency).join(", "))}
                </p>
              )}
              {result.truncated && (
                <p className="text-xs text-muted-foreground">{S.ui.truncated}</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
