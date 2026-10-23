"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { explainReportAction } from "../actions";
import type { ReportDefinition } from "../definition";

const S = INSIGHTS_STRINGS;

// "Explain this report": a Sheet with a loading state, 3 to 5 insights, the note that they came
// from the aggregated numbers, and the error copy. The server sends only aggregates to the model,
// and the call is a CSRF-guarded server action like every other mutation.

export function ExplainPanel({
  definition,
  disabled,
}: {
  definition: ReportDefinition;
  disabled: boolean;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);

  async function launch(): Promise<void> {
    setOpen(true);
    setLoading(true);
    setFailed(false);
    setInsights([]);
    const response = await explainReportAction({ definition }, readCsrfToken());
    setLoading(false);
    if (!response.ok) {
      setFailed(true);
      return;
    }
    setInsights(response.value.insights);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="report-explain"
        disabled={disabled}
        onClick={() => void launch()}
      >
        {S.ui.explain}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md p-6">
          <SheetTitle className="mb-4 text-lg font-medium">{S.ui.explain}</SheetTitle>
          {loading && <p className="text-sm text-muted-foreground">{S.ui.explaining}</p>}
          {failed && (
            <div className="flex items-start justify-between gap-2">
              <p role="alert" className="text-sm text-destructive">
                {S.errors.explainUnavailable}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="report-explain-retry"
                onClick={() => void launch()}
                disabled={loading}
              >
                Try again
              </Button>
            </div>
          )}
          {insights.length > 0 && (
            <>
              <ul data-testid="explain-insights" className="space-y-2">
                {insights.map((insight) => (
                  <li
                    key={insight}
                    data-testid="explain-item"
                    className="rounded-md border p-3 text-sm"
                  >
                    {insight}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">{S.ui.generatedNote}</p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
