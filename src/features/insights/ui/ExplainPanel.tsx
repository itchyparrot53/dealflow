"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { trpc } from "@/lib/trpc-client";
import type { ReportDefinition } from "../definition";

const S = INSIGHTS_STRINGS;

// "Explain this report": a Sheet with a loading state, 3 to 5 insights, the note that they came
// from the aggregated numbers, and the error copy. The server sends only aggregates to the model.

export function ExplainPanel({
  definition,
  disabled,
}: {
  definition: ReportDefinition;
  disabled: boolean;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const explain = trpc.insights.explain.useMutation();

  function launch(): void {
    setOpen(true);
    explain.mutate({ definition });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="report-explain"
        disabled={disabled}
        onClick={launch}
      >
        {S.ui.explain}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md p-6">
          <SheetTitle className="mb-4 text-lg font-medium">{S.ui.explain}</SheetTitle>
          {explain.isPending && <p className="text-sm text-muted-foreground">{S.ui.explaining}</p>}
          {explain.isError && (
            <p role="alert" className="text-sm text-destructive">
              {S.errors.explainUnavailable}
            </p>
          )}
          {explain.data !== undefined && (
            <>
              <ul data-testid="explain-insights" className="space-y-2">
                {explain.data.insights.map((insight) => (
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
