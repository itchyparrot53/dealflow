"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { WEBHOOKS_STRINGS } from "@/constants/automationsStrings";
import { DOMAIN_EVENT_TYPES } from "@/features/events/types";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createSubscriptionAction, updateSubscriptionAction } from "../actions";

const S = WEBHOOKS_STRINGS;

const GROUPS: { title: string; prefixes: string[] }[] = [
  { title: "Deals", prefixes: ["deal."] },
  { title: "People", prefixes: ["person."] },
  { title: "Organizations", prefixes: ["organization."] },
  { title: "Activities", prefixes: ["activity."] },
  { title: "Documents", prefixes: ["document."] },
  { title: "Invoices", prefixes: ["invoice."] },
  // Part 6: one group for the two public surfaces.
  { title: "Forms and booking", prefixes: ["form.", "booking."] },
  // Part 8: projects and their tasks.
  { title: "Projects", prefixes: ["project.", "project_task."] },
];

export interface EditableSubscription {
  id: string;
  name: string;
  url: string;
  events: string[];
}

export function WebhookDialog({
  open,
  onOpenChange,
  subscription,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: EditableSubscription | null;
  onCreated: (secret: string) => void;
}): React.ReactNode {
  // The parent remounts this dialog with a key per open target, so initial props are enough and
  // an effect is not needed to reset the form.
  const [name, setName] = useState(subscription?.name ?? "");
  const [url, setUrl] = useState(subscription?.url ?? "");
  const [events, setEvents] = useState<string[]>(subscription?.events ?? ["deal.won"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleEvent(event: string, checked: boolean): void {
    setEvents((current) =>
      checked ? [...current, event] : current.filter((entry) => entry !== event),
    );
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    if (subscription === null) {
      const created = await createSubscriptionAction({ name, url, events }, readCsrfToken());
      setBusy(false);
      if (!created.ok) {
        setError(created.error.id === "E_WEBHOOK_002" ? S.dialog.invalidUrl : created.error.id);
        return;
      }
      onOpenChange(false);
      onCreated(created.value.secret);
      return;
    }
    const updated = await updateSubscriptionAction(
      subscription.id,
      { name, url, events },
      readCsrfToken(),
    );
    setBusy(false);
    if (!updated.ok) {
      setError(updated.error.id === "E_WEBHOOK_002" ? S.dialog.invalidUrl : updated.error.id);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="webhook-dialog">
        <DialogHeader>
          <DialogTitle>{subscription === null ? S.newWebhook : S.actions.edit}</DialogTitle>
          <DialogDescription>{S.intro}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block" htmlFor="webhook-name">
            <span className="mb-1.5 block text-sm font-medium">{S.dialog.name}</span>
            <Input
              id="webhook-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="block" htmlFor="webhook-url">
            <span className="mb-1.5 block text-sm font-medium">{S.dialog.url}</span>
            <Input
              id="webhook-url"
              data-testid="webhook-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/hooks/dealflow"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-medium">{S.dialog.events}</span>
            <div className="space-y-2">
              {GROUPS.map((group) => {
                const groupEvents = DOMAIN_EVENT_TYPES.filter((type) =>
                  group.prefixes.some((prefix) => type.startsWith(prefix)),
                );
                return (
                  <div key={group.title}>
                    <p className="text-meta font-semibold text-muted-foreground">{group.title}</p>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      {groupEvents.map((type) => (
                        <div key={type} className="flex items-center gap-2">
                          <Checkbox
                            checked={events.includes(type)}
                            onCheckedChange={(checked) => toggleEvent(type, checked)}
                            label={type}
                            id={`webhook-event-${type}`}
                          />
                          <label htmlFor={`webhook-event-${type}`} className="text-sm">
                            {type}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {S.actions.cancel}
          </Button>
          <Button
            type="button"
            disabled={busy || name.trim() === "" || url.trim() === "" || events.length === 0}
            onClick={() => void submit()}
          >
            {subscription === null ? S.dialog.create : S.dialog.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
