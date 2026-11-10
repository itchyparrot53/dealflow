"use client";

import { useState } from "react";
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
import { readCsrfToken } from "@/utils/csrfCookie";
import { bulkMarketingStatusAction } from "../actions";

// 6.12's bulk action in the people list. at most 5,000 per action (the server also enforces it) and
// every person gets their own consent event.

const CHOICES: MarketingStatus[] = ["subscribed", "unsubscribed", "not_subscribed"];

export function BulkMarketingStatus({
  personIds,
  onDone,
}: {
  personIds: string[];
  onDone: () => void;
}): React.ReactNode {
  const [target, setTarget] = useState<MarketingStatus | "">("");
  const [basis, setBasis] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsBasis = target === "subscribed";

  async function apply(): Promise<void> {
    if (target === "") return;
    setBusy(true);
    setError(null);
    const result = await bulkMarketingStatusAction(
      { personIds, to: target, basis: needsBasis ? basis : null },
      readCsrfToken(),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    setOpen(false);
    setTarget("");
    setBasis("");
    onDone();
  }

  return (
    <>
      <span className="w-44">
        <Select
          ariaLabel="Change marketing status of selected people"
          value=""
          onChange={(value) => {
            if (value === "") return;
            setTarget(value as MarketingStatus);
            setError(null);
            setOpen(true);
          }}
          placeholder="Marketing status"
          options={CHOICES.map((status) => ({
            value: status,
            label: MARKETING_STATUS_LABELS[status],
          }))}
        />
      </span>
      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              Set {personIds.length} {personIds.length === 1 ? "person" : "people"} to{" "}
              {target === "" ? "" : MARKETING_STATUS_LABELS[target]}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {needsBasis ? (
              <FormField
                label="Consent basis"
                htmlFor="bulk-marketing-basis"
                hint="Required to subscribe people directly."
                required
              >
                <Select
                  ariaLabel="Bulk consent basis"
                  value={basis}
                  onChange={setBasis}
                  options={MANUAL_SUBSCRIBE_BASES.map((value) => ({
                    value,
                    label: CONSENT_BASIS_LABELS[value],
                  }))}
                  placeholder="Choose a basis"
                />
              </FormField>
            ) : (
              <p className="text-sm text-muted-foreground">
                Each person gets one consent event recording this change.
              </p>
            )}
            {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || (needsBasis && basis === "")}
              onClick={() => void apply()}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
