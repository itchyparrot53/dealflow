"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/Select";
import { INSIGHTS_STRINGS } from "@/constants/insightsStrings";
import { goalLabel } from "@/features/goals/goalLabel";
import type { GoalWithProgress } from "@/features/goals/router";
import { readCsrfToken } from "@/utils/csrfCookie";
import { addWidgetAction } from "../actions";
import { insightErrorMessage } from "./errorCopy";

const S = INSIGHTS_STRINGS;

// "Add widget": pick one of the viewer's reports or one of their goals. The action validates
// readability again on the server; the list here is only the convenience copy.

export function AddWidgetDialog({
  dashboardId,
  reports,
  goals,
  onAdded,
}: {
  dashboardId: string;
  reports: readonly { id: string; name: string }[];
  goals: readonly GoalWithProgress[];
  onAdded: () => Promise<void>;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"report" | "goal">("report");
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const options =
    kind === "report"
      ? reports.map((report) => ({ value: report.id, label: report.name }))
      : goals.map((row) => ({ value: row.goal.id, label: goalLabel(row.goal) }));

  async function add(): Promise<void> {
    setPending(true);
    setError(null);
    const response = await addWidgetAction(
      dashboardId,
      kind === "report" ? { kind, reportId: targetId } : { kind, goalId: targetId },
      readCsrfToken(),
    );
    setPending(false);
    if (!response.ok) {
      setError(response.error.id);
      return;
    }
    setOpen(false);
    setTargetId("");
    await onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" data-testid="dashboard-add-widget">
          {S.ui.addWidget}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{S.ui.addWidget}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Select
              ariaLabel={S.ui.addWidget}
              value={kind}
              onChange={(value) => {
                setKind(value === "goal" ? "goal" : "report");
                setTargetId("");
              }}
              options={[
                { value: "report", label: S.ui.tabReports },
                { value: "goal", label: S.ui.goals },
              ]}
            />
            <Select
              ariaLabel={S.ui.addWidget}
              value={targetId}
              placeholder={S.none}
              onChange={setTargetId}
              options={options}
            />
            {error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {insightErrorMessage(error)}
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={() => void add()} disabled={pending || targetId === ""}>
            {S.ui.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
