"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { STRINGS } from "@/constants/strings";
import { trpc } from "@/lib/trpc-client";

const IMP = STRINGS.settings.importer;

export interface PreviewStepProps {
  batchId: string;
  validation: { valid: number; invalid: number };
  busy: boolean;
  // True when any column maps Person > Marketing status, so the consent confirmation is required.
  needsMarketingConsent: boolean;
  onCommit: (marketingConsent: boolean) => void;
}

export function PreviewStep({
  batchId,
  validation,
  busy,
  needsMarketingConsent,
  onCommit,
}: PreviewStepProps): React.ReactNode {
  const rows = trpc.import.listRows.useQuery({ batchId }).data ?? [];
  const [consent, setConsent] = useState(false);
  const invalid = rows.filter((r) => r.status === "invalid");

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2.5 py-1 text-sm font-medium tabular-nums text-link-record">
          {IMP.valid(validation.valid)}
        </span>
        {validation.invalid > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-sm font-medium tabular-nums text-destructive">
            {IMP.withErrors(validation.invalid)}
          </span>
        )}
      </div>

      {invalid.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-sm font-medium">{IMP.rowErrors}</h2>
          <ul className="divide-y rounded-md border text-sm">
            {invalid.map((r) => (
              <li key={r.id} className="px-3 py-2">
                <span className="font-medium tabular-nums">#{r.rowNumber}</span>{" "}
                <span className="text-destructive">
                  {r.errors.map((e) => `${e.field}: ${e.message}`).join("; ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {needsMarketingConsent ? (
        <label htmlFor="import-marketing-consent" className="flex items-start gap-2 text-sm">
          <Checkbox
            id="import-marketing-consent"
            checked={consent}
            onCheckedChange={setConsent}
            label="I have consent to email the people marked subscribed"
            testId="import-marketing-consent"
          />
          <span>I have consent to email the people marked subscribed</span>
        </label>
      ) : null}
      <Button
        type="button"
        disabled={validation.valid === 0 || busy || (needsMarketingConsent && !consent)}
        onClick={() => onCommit(consent)}
        size="sm"
      >
        {IMP.commitButton(validation.valid)}
      </Button>
    </section>
  );
}
