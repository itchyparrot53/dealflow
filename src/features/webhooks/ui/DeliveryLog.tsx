"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/Collapsible";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WEBHOOKS_STRINGS } from "@/constants/automationsStrings";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { redeliverAction } from "../actions";

const S = WEBHOOKS_STRINGS.deliveryLog;

interface DeliveryRow {
  id: string;
  eventType: string;
  status: string;
  attempts: number;
  lastStatusCode: number | null;
  durationMs: number | null;
  payload: unknown;
  createdAt: string | Date;
}

function timeOf(value: string | Date): string {
  return new Date(value).toLocaleString();
}

export function DeliveryLog({
  open,
  onOpenChange,
  subscriptionId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  name: string;
}): React.ReactNode {
  const utils = trpc.useUtils();
  const deliveries = trpc.webhooks.deliveries.useQuery({ subscriptionId }, { enabled: open });
  const [busy, setBusy] = useState<string | null>(null);
  const rows = (deliveries.data ?? []) as unknown as DeliveryRow[];

  async function redeliver(id: string): Promise<void> {
    setBusy(id);
    await redeliverAction(id, readCsrfToken());
    setBusy(null);
    await utils.webhooks.deliveries.invalidate({ subscriptionId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="webhook-deliveries">
        <DialogHeader>
          <DialogTitle>{S.title}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{S.empty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">{S.time}</th>
                  <th className="py-2 font-medium">{S.event}</th>
                  <th className="py-2 font-medium">{S.status}</th>
                  <th className="py-2 font-medium">{S.attempts}</th>
                  <th className="py-2 font-medium">{S.code}</th>
                  <th className="py-2 font-medium">{S.duration}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b align-top"
                    data-testid="webhook-delivery-row"
                    data-status={row.status}
                  >
                    <td className="py-2">{timeOf(row.createdAt)}</td>
                    <td className="py-2">{row.eventType}</td>
                    <td className="py-2">{row.status}</td>
                    <td className="py-2">{row.attempts}</td>
                    <td className="py-2">{row.lastStatusCode ?? ""}</td>
                    <td className="py-2">
                      {row.durationMs === null ? "" : `${row.durationMs} ms`}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void redeliver(row.id)}
                      >
                        {WEBHOOKS_STRINGS.actions.redeliver}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="space-y-2">
            {rows.map((row) => (
              <Collapsible key={row.id}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    {S.payload}: {row.eventType}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {WEBHOOKS_STRINGS.actions.close}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
