"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createSequenceAction, deleteSequenceAction } from "../actions";
import { defaultSequenceEmailStep } from "../model";
import type { SequenceListRow } from "../queries";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "success"> = {
  draft: "outline",
  active: "success",
  paused: "secondary",
};

const NEW_SEQUENCE_INPUT = {
  name: "New sequence",
  senderId: null,
  replyTo: null,
  entry: { manual: true, automation: true, segment: null },
  exit: { dealWon: false, replied: false, filter: null },
  sendWindow: { weekdaysOnly: false, startHour: 0, endHour: 24, timezone: "UTC" },
  steps: [defaultSequenceEmailStep()],
};

export function SequenceList({ rows }: { rows: SequenceListRow[] }): React.ReactNode {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await createSequenceAction(NEW_SEQUENCE_INPUT, readCsrfToken());
    setBusy(false);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    router.push(`/campaigns/automated/${result.value.id}`);
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    const result = await deleteSequenceAction({ id }, readCsrfToken());
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Drip sequences send email steps on their own schedule. Only subscribed contacts are
          enrolled.
        </p>
        <Button
          type="button"
          data-testid="sequence-new"
          onClick={() => void create()}
          disabled={busy}
        >
          + Sequence
        </Button>
      </div>
      {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
      {rows.length === 0 ? (
        <section className="space-y-2 rounded-lg border p-6">
          <h2 className="text-sm font-medium">Create your first sequence</h2>
          <p className="text-sm text-muted-foreground">
            A sequence is a series of emails and waits. Enroll people manually, from a saved filter
            or from an automation.
          </p>
          <Button
            type="button"
            variant="outline"
            data-testid="sequence-new"
            onClick={() => void create()}
            disabled={busy}
          >
            Create a sequence
          </Button>
        </section>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Steps</th>
                <th className="px-3 py-2 font-medium">Enrolled</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">
                    <a
                      href={`/campaigns/automated/${row.id}`}
                      className="font-medium text-link-record hover:underline"
                    >
                      {row.name}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>{row.status}</Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.stepCount}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {row.enrollments.active} active, {row.enrollments.completed} completed,{" "}
                    {row.enrollments.exited} exited
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void remove(row.id)}
                    >
                      Delete
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
