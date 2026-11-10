"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
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
import { changeMarketingStatusAction, exportConsentHistoryAction } from "../actions";
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

function baseline(status: string): string {
  const labels: Record<string, string> = CONSENT_BASIS_LABELS;
  return labels[status] ?? status;
}

export function MarketingPanel({ personId }: { personId: string }): React.ReactNode {
  const utils = trpc.useUtils();
  const data = trpc.marketing.getPerson.useQuery({ personId }).data;
  const [dialog, setDialog] = useState<"change" | "history" | null>(null);
  const [target, setTarget] = useState("");
  const [basis, setBasis] = useState("");
  const [sendDoubleOptIn, setSendDoubleOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined || data === null) return null;

  const targets = allowedTargets(data.status, ["manual"]).map((entry) => ({
    value: entry.to,
    label: MARKETING_STATUS_LABELS[entry.to],
  }));
  const needsBasis = target === "subscribed";

  async function exportHistory(): Promise<void> {
    setExporting(true);
    setError(null);
    const result = await exportConsentHistoryAction({ personId }, readCsrfToken());
    setExporting(false);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    const blob = new Blob([result.value.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.value.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function apply(): Promise<void> {
    if (target === "") return;
    setBusy(true);
    setError(null);
    const result = await changeMarketingStatusAction(
      {
        personId,
        to: target,
        basis: needsBasis ? basis : null,
        sendDoubleOptIn: target === "pending" ? sendDoubleOptIn : false,
      },
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
    setSendDoubleOptIn(true);
    await utils.marketing.getPerson.invalidate({ personId });
  }

  return (
    <CollapsibleSection title="Marketing">
      <div className="space-y-2 px-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="marketing-status">
            <Badge variant={STATUS_VARIANT[data.status]}>
              {MARKETING_STATUS_LABELS[data.status]}
            </Badge>
          </span>
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
            data-testid="marketing-change"
            disabled={!data.canManage || targets.length === 0}
            onClick={() => {
              setError(null);
              setTarget("");
              setSendDoubleOptIn(true);
              setDialog("change");
            }}
          >
            Change status
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="marketing-history"
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
                testId="marketing-status-target"
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
                  testId="marketing-basis"
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
            {target === "pending" ? (
              <label htmlFor="marketing-doi" className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="marketing-doi"
                  testId="marketing-doi"
                  checked={sendDoubleOptIn}
                  onCheckedChange={setSendDoubleOptIn}
                  label="Send the double opt-in email"
                />
                Send the double opt-in email
              </label>
            ) : null}
            {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="marketing-save"
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
            {error === null ? null : <p className="mb-2 text-sm text-destructive">{error}</p>}
            <ul className="divide-y text-sm" data-testid="marketing-history-list">
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
            <Button
              type="button"
              variant="outline"
              data-testid="marketing-export-csv"
              disabled={exporting}
              onClick={() => void exportHistory()}
            >
              Export CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CollapsibleSection>
  );
}
