"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ERROR_IDS } from "@/constants/errorIds";
import { createActivityAction } from "@/features/activities/actions";
import { composeDueAt } from "@/features/activities/activityTime";
import { proposeActivitiesFromNoteAction } from "@/features/ai/actions/dealActions";
import { aiErrorMessage } from "@/features/ai/aiErrors";
import type { ActivityProposal } from "@/features/ai/notesToActivities";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";

interface Row extends ActivityProposal {
  checked: boolean;
}

interface Props {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

// Turns one note into editable activity proposals. Nothing is created until "Create selected",
// and each creation goes through warpdrive's own createActivityAction (permission + visibility).
export function NotesToActivitiesDialog({
  noteId,
  open,
  onOpenChange,
  onChanged,
}: Props): React.ReactNode {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [dealId, setDealId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);
  const types = trpc.activities.listTypes.useQuery().data ?? [];
  const utils = trpc.useUtils();

  async function load(): Promise<void> {
    setRows(null);
    setErrorId(null);
    setPending(true);
    try {
      const result = await proposeActivitiesFromNoteAction(noteId, readCsrfToken());
      if (!result.ok) {
        setErrorId(result.error.id);
        return;
      }
      setDealId(result.value.dealId);
      setRows(result.value.proposals.map((proposal) => ({ ...proposal, checked: true })));
    } finally {
      setPending(false);
    }
  }

  function update(index: number, patch: Partial<Row>): void {
    setRows((current) =>
      current === null
        ? current
        : current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function createSelected(): Promise<void> {
    if (rows === null || dealId === null) return;
    setPending(true);
    setErrorId(null);
    try {
      for (const row of rows.filter((candidate) => candidate.checked)) {
        const typeId =
          types.find((type) => type.key === row.typeKey)?.id ??
          types.find((type) => type.key === "task")?.id;
        if (typeId === undefined) {
          setErrorId(ERROR_IDS.AI_INPUT_INVALID);
          return;
        }
        const dueAt = composeDueAt(row.dueDate, "");
        const result = await createActivityAction(
          {
            typeId,
            subject: row.subject,
            allDay: dueAt.allDay,
            dueAt: dueAt.iso,
            dealId,
            note: row.note,
          },
          readCsrfToken(),
        );
        if (!result.ok) {
          setErrorId(result.error.id);
          return;
        }
      }
      await utils.activities.listForEntity.invalidate({ entityType: "deal", entityId: dealId });
      onChanged?.();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  const selected = rows?.filter((row) => row.checked).length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next && rows === null) void load();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suggested activities</DialogTitle>
          <DialogDescription>
            Edit anything before creating. Unchecked rows are skipped.
          </DialogDescription>
        </DialogHeader>

        {pending && rows === null && (
          <p className="text-sm text-muted-foreground">Reading the note...</p>
        )}

        {rows !== null && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No follow-ups found in this note.</p>
        )}

        {rows !== null && rows.length > 0 && (
          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li
                key={`${row.subject}-${row.dueDate}-${row.typeKey}`}
                data-testid="ai-proposal"
                className="space-y-2 rounded-md border p-3"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={row.checked}
                    onCheckedChange={(checked) => update(index, { checked })}
                    label={`Include ${row.subject}`}
                  />
                  <Input
                    aria-label="Subject"
                    value={row.subject}
                    onChange={(event) => update(index, { subject: event.target.value })}
                    maxLength={255}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={row.typeKey}
                    onChange={(value) => update(index, { typeKey: value })}
                    options={types.map((type) => ({ value: type.key, label: type.name }))}
                    ariaLabel="Type"
                  />
                  <DatePicker
                    value={row.dueDate}
                    onChange={(value) => update(index, { dueDate: value ?? row.dueDate })}
                    ariaLabel="Due date"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {errorId !== null && (
          <p role="alert" className="text-sm text-destructive">
            {aiErrorMessage(errorId)}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void createSelected()}
            disabled={pending || selected === 0}
          >
            Create selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
