"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/Switch";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import {
  createAutomationAction,
  deleteAutomationAction,
  duplicateAutomationAction,
  setAutomationEnabledAction,
} from "../actions";

const S = AUTOMATIONS_STRINGS;

export interface AutomationRowView {
  id: string;
  name: string;
  enabled: boolean;
  runCount: number;
  lastRunAt: string | null;
  triggerSummary: string;
}

const NEW_DEFINITION = {
  trigger: { type: "deal.won" as const },
  condition: null,
  actions: [{ type: "ai_score_deal" as const }],
};

export function AutomationsList({ rows }: { rows: AutomationRowView[] }): React.ReactNode {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<AutomationRowView | null>(null);
  const [creating, setCreating] = useState(false);

  async function createAutomation(): Promise<void> {
    setCreating(true);
    const result = await createAutomationAction({
      name: "New automation",
      definition: NEW_DEFINITION,
    });
    setCreating(false);
    if (!result.ok) return;
    router.push(`/settings/automations/${result.value.id}`);
  }

  async function toggle(row: AutomationRowView, enabled: boolean): Promise<void> {
    await setAutomationEnabledAction(row.id, enabled);
    router.refresh();
  }

  async function duplicate(row: AutomationRowView): Promise<void> {
    const result = await duplicateAutomationAction(row.id);
    if (result.ok) router.push(`/settings/automations/${result.value.id}`);
  }

  async function remove(row: AutomationRowView): Promise<void> {
    await deleteAutomationAction(row.id);
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          data-testid="automation-new"
          disabled={creating}
          onClick={() => void createAutomation()}
        >
          {S.newAutomation}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.empty}</p>
      ) : (
        <table className="w-full text-sm" data-testid="automations-table">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium">{S.columns.name}</th>
              <th className="py-2 font-medium">{S.columns.trigger}</th>
              <th className="py-2 font-medium">{S.columns.enabled}</th>
              <th className="py-2 font-medium">{S.columns.runs}</th>
              <th className="py-2 font-medium">{S.columns.lastRun}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b"
                data-testid="automation-row"
                data-automation-id={row.id}
              >
                <td className="py-2">
                  <Link
                    className="font-medium hover:underline"
                    href={`/settings/automations/${row.id}`}
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="py-2 text-muted-foreground">{row.triggerSummary}</td>
                <td className="py-2">
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(checked) => void toggle(row, checked)}
                    label={`${S.columns.enabled}: ${row.name}`}
                  />
                </td>
                <td className="py-2">{row.runCount}</td>
                <td className="py-2 text-muted-foreground">
                  {row.lastRunAt === null ? "" : new Date(row.lastRunAt).toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" aria-label={row.name}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/settings/automations/${row.id}`}>{S.actions.edit}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void duplicate(row)}>
                        {S.actions.duplicate}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setPendingDelete(row)}>
                        {S.actions.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{S.actions.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{S.actions.confirmDeleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{S.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete !== null) void remove(pendingDelete);
              }}
            >
              {S.actions.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
