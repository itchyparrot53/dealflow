"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/Textarea";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { aiErrorMessage } from "@/features/ai/aiErrors";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createAutomationAction, draftAutomationAction } from "../actions";

const S = AUTOMATIONS_STRINGS;

export function DescribeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactNode {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft(): Promise<void> {
    setBusy(true);
    setError(null);
    const drafted = await draftAutomationAction(text, readCsrfToken());
    if (!drafted.ok) {
      setBusy(false);
      setError(
        drafted.error.id === "E_AUTOMATION_004"
          ? S.errors.automationInvalid
          : aiErrorMessage(drafted.error.id),
      );
      return;
    }
    // The draft is created disabled so it cannot run before an admin reviews it.
    const created = await createAutomationAction(
      {
        name: "Drafted automation",
        definition: drafted.value,
        enabled: false,
      },
      readCsrfToken(),
    );
    setBusy(false);
    if (!created.ok) {
      setError(created.error.id);
      return;
    }
    onOpenChange(false);
    router.push(`/settings/automations/${created.value.id}?drafted=1`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="automation-describe-dialog">
        <DialogHeader>
          <DialogTitle>{S.describe}</DialogTitle>
          <DialogDescription>{S.intro}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="When a deal is won, create a follow-up call tomorrow"
            data-testid="automation-describe-input"
          />
          {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {S.actions.close}
            </Button>
            <Button
              type="button"
              data-testid="automation-describe-submit"
              disabled={busy || text.trim() === ""}
              onClick={() => void draft()}
            >
              {busy ? S.editor.saving : "Draft it"}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
