"use client";

import { MoreHorizontal } from "lucide-react";
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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/Input";
import { WEBHOOKS_STRINGS } from "@/constants/automationsStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  deleteSubscriptionAction,
  rotateSecretAction,
  sendTestAction,
  setSubscriptionEnabledAction,
} from "../actions";
import { DeliveryLog } from "./DeliveryLog";
import { type EditableSubscription, WebhookDialog } from "./WebhookDialog";

const S = WEBHOOKS_STRINGS;

export interface WebhookRowView {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  consecutiveFailures: number;
  disabledReason: string | null;
  lastDeliveryAt: string | null;
}

export interface WebhookDialogRow extends WebhookRowView {
  events: string[];
}

export function WebhooksSettings({ rows }: { rows: WebhookRowView[] }): React.ReactNode {
  const router = useRouter();
  const [editing, setEditing] = useState<EditableSubscription | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<WebhookRowView | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<WebhookRowView | null>(null);
  const [copied, setCopied] = useState(false);

  function openNew(): void {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: WebhookRowView): void {
    setEditing({ id: row.id, name: row.name, url: row.url, events: row.events });
    setDialogOpen(true);
  }

  async function rotate(row: WebhookRowView): Promise<void> {
    const result = await rotateSecretAction(row.id, readCsrfToken());
    if (result.ok) setSecret(result.value);
  }

  async function toggle(row: WebhookRowView): Promise<void> {
    await setSubscriptionEnabledAction(row.id, !row.enabled, readCsrfToken());
    router.refresh();
  }

  async function sendTest(row: WebhookRowView): Promise<void> {
    const result = await sendTestAction(row.id, readCsrfToken());
    if (!result.ok) {
      setTestResult(result.error.id);
      return;
    }
    setTestResult(
      S.testResult
        .replace("{status}", result.value.status)
        .replace("{duration}", String(result.value.durationMs)),
    );
    router.refresh();
  }

  async function remove(row: WebhookRowView): Promise<void> {
    await deleteSubscriptionAction(row.id, readCsrfToken());
    setDeleting(null);
    router.refresh();
  }

  async function copySecret(): Promise<void> {
    if (secret === null) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" data-testid="webhook-new" onClick={openNew}>
          {S.newWebhook}
        </Button>
        {testResult === null ? null : (
          <span className="text-sm text-muted-foreground">{testResult}</span>
        )}
      </div>

      {secret === null ? null : (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">{S.dialog.secretTitle}</p>
          <p className="text-sm text-muted-foreground">{S.dialog.secretOnce}</p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={secret}
              data-testid="webhook-secret"
              aria-label={S.dialog.secretTitle}
            />
            <Button type="button" variant="outline" onClick={() => void copySecret()}>
              {copied ? S.dialog.copied : S.dialog.copy}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSecret(null)}>
              {S.actions.close}
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.empty}</p>
      ) : (
        <table className="w-full text-sm" data-testid="webhooks-table">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium">{S.columns.name}</th>
              <th className="py-2 font-medium">{S.columns.url}</th>
              <th className="py-2 font-medium">{S.columns.events}</th>
              <th className="py-2 font-medium">{S.columns.status}</th>
              <th className="py-2 font-medium">{S.columns.lastDelivery}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b"
                data-testid="webhook-row"
                data-webhook-id={row.id}
              >
                <td className="py-2 font-medium">{row.name}</td>
                <td className="py-2 text-muted-foreground">{row.url}</td>
                <td className="py-2">{row.events.length}</td>
                <td className="py-2">
                  {row.enabled ? (
                    <Badge variant="success">{S.status.enabled}</Badge>
                  ) : (
                    <span className="flex flex-col gap-1">
                      <Badge variant="secondary">{S.status.disabled}</Badge>
                      {row.disabledReason === null ? null : (
                        <span className="text-xs text-muted-foreground">{row.disabledReason}</span>
                      )}
                    </span>
                  )}
                </td>
                <td className="py-2 text-muted-foreground">
                  {row.lastDeliveryAt === null ? "" : new Date(row.lastDeliveryAt).toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" aria-label={row.name}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openEdit(row)}>
                        {S.actions.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void sendTest(row)}>
                        {S.actions.sendTest}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void rotate(row)}>
                        {S.actions.rotate}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDeliveriesFor(row)}>
                        {S.deliveryLog.title}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void toggle(row)}>
                        {row.enabled ? S.actions.disable : S.actions.enable}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDeleting(row)}>
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

      <WebhookDialog
        key={`${dialogOpen ? "open" : "closed"}-${editing?.id ?? "new"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscription={editing}
        onCreated={(value) => {
          setSecret(value);
          router.refresh();
        }}
      />

      {deliveriesFor === null ? null : (
        <DeliveryLog
          open
          onOpenChange={(open) => {
            if (!open) setDeliveriesFor(null);
          }}
          subscriptionId={deliveriesFor.id}
          name={deliveriesFor.name}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
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
                if (deleting !== null) void remove(deleting);
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
