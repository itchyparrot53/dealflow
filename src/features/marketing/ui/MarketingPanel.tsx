"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/Select";
import {
  CONSENT_BASIS_LABELS,
  MANUAL_SUBSCRIBE_BASES,
  MARKETING_STATUS_LABELS,
  type MarketingStatus,
} from "@/constants/marketing";
import { CollapsibleSection } from "@/features/deal-workspace/CollapsibleSection";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { changeMarketingStatusAction } from "../actions";
import { allowedTargets } from "../status";

// 6.12's person Marketing section: status, evidence, the change dialog (allowed targets only) and
// the consent history. The IP and user agent arrive null unless the actor holds marketing.manage.

const STATUS_VARIANT: Record<MarketingStatus, "success" | "secondary" | "outline" | "destructive"> =
  {
    subscribed: "success",
    pending: "secondary",
    not_subscribed: "outline",
    unsubscribed: "outline",
    bounced: "destructive",
  };

function baseline(status: string | null): string {
  if (status === null) return "";
  return CONSENT_BASIS_LABELS[status as keyof typeof CONSENT_BASIS_LABELS] ?? status;
}

export function MarketingPanel({ personId }: { personId: string }): React.ReactNode {
  const utils = trpc.useUtils();
  const data = trpc.marketing.getPerson.useQuery({ personId }).data;
  const [dialog, setDialog] = useState<"change" | "history" | null>(null);
  const [target, setTarget] = useState("");
  const [basis, setBasis] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined || data === null) return null;

  const targets = allowedTargets(data.status, ["manual"]).map((entry) => ({
    value: entry.to,
    label: MARKETING_STATUS_LABELS[entry.to],
  }));
  const needsBasis = target === "subscribed";

  async function apply(): Promise<void> {
    if (target === "") return;
    setBusy(true);
    setError(null);
    const result = await changeMarketingStatusAction(
      { personId, to: target, basis: needsBasis ? basis : null },
      readCsrfToken(),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    setDialog(null);
    setTarget("");
    setBasis("");
    await utils.marketing.getPerson.invalidate({ personId });
  }

  return (
    <CollapsibleSection title="Marketing">
      <div className="space-y-2 px-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[data.status]}>
            {MARKETING_STATUS_LABELS[data.status]}
          </Badge>
          {data.consentBasis === null ? null : (
            <span className="text-xs text-muted-foreground">{baseline(data.consentBasis)}</span>
          )}
        </div>
        {data.statusChangedAt === null ? null : (
          <p className="text-xs text-muted-foreground">
            Since {new Date(data.statusChangedAt).toLocaleDateString()}
          </p>
        )}
        {data.lastCampaign === null ? null : (
          <p className="text-xs text-muted-foreground">
            Last campaign: {data.lastCampaign.name} ({data.lastCampaign.eventType})
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data.canManage || targets.length === 0}
            onClick={() => {
              setError(null);
              setTarget("");
              setDialog("change");
            }}
          >
            Change status
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDialog("history")}
            disabled={data.events.length === 0}
          >
            Consent history
          </Button>
        </div>
      </div>

      <Dialog open={dialog === "change"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Change marketing status</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <FormField label="New status" htmlFor="marketing-status-target">
              <Select
                ariaLabel="New marketing status"
                value={target}
                onChange={setTarget}
                options={targets}
                placeholder="Choose a status"
              />
            </FormField>
            {needsBasis ? (
              <FormField
                label="Consent basis"
                htmlFor="marketing-status-basis"
                hint="Only a basis you can evidence is allowed."
                required
              >
                <Select
                  ariaLabel="Consent basis"
                  value={basis}
                  onChange={setBasis}
                  options={MANUAL_SUBSCRIBE_BASES.map((value) => ({
                    value,
                    label: CONSENT_BASIS_LABELS[value],
                  }))}
                  placeholder="Choose a basis"
                />
              </FormField>
            ) : null}
            {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || target === "" || (needsBasis && basis === "")}
              onClick={() => void apply()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "history"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Consent history</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <ul className="divide-y text-sm">
              {data.events.map((event) => (
                <li key={event.id} className="space-y-1 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {event.fromStatus === null
                        ? "None"
                        : MARKETING_STATUS_LABELS[event.fromStatus]}{" "}
                      to {MARKETING_STATUS_LABELS[event.toStatus]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.source}
                    {event.basis === null ? "" : ` · ${CONSENT_BASIS_LABELS[event.basis]}`}
                    {event.actorName === null ? "" : ` · ${event.actorName}`}
                  </p>
                  {event.ip === null ? null : (
                    <p className="text-xs text-muted-foreground">
                      {event.ip}
                      {event.userAgent === null ? "" : ` · ${event.userAgent}`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CollapsibleSection>
  );
}
