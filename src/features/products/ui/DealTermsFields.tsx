"use client";

import type React from "react";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tip } from "@/components/ui/tooltip";
import { ERROR_IDS } from "@/constants/errorIds";
import { PRODUCTS_STRINGS } from "@/constants/salesStrings";
import { currencyOptions } from "@/features/currency/ui/currencyOptions";
import { setDealTermsAction } from "@/features/products/actions";
import { readCsrfToken } from "@/utils/csrfCookie";

const S = PRODUCTS_STRINGS;

interface Props {
  dealId: string;
  currency: string;
  stageProbability: number | null;
  probability: number | null;
  hasLines: boolean;
  canEdit: boolean;
  codes: string[];
  onSaved: () => void;
}

function errorText(id: string): string {
  switch (id) {
    case ERROR_IDS.CURRENCY_CHANGE_WITH_LINES:
      return S.currencyLocked;
    case ERROR_IDS.CURRENCY_UNKNOWN:
      return S.unknownCode;
    case ERROR_IDS.PERM_DENIED:
      return S.adminOnly;
    default:
      return S.termsSaveFailed;
  }
}

export function DealTermsFields({
  dealId,
  currency,
  stageProbability,
  probability,
  hasLines,
  canEdit,
  codes,
  onSaved,
}: Props): React.ReactNode {
  const [draft, setDraft] = useState(probability === null ? "" : String(probability));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = hasLines || !canEdit;

  async function saveTerms(next: {
    currency?: string;
    probability?: number | null;
  }): Promise<void> {
    setPending(true);
    setError(null);
    const result = await setDealTermsAction({ dealId, ...next }, readCsrfToken());
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    onSaved();
  }

  function commitProbability(): void {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (probability !== null) void saveTerms({ probability: null });
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100 || String(parsed) !== trimmed) {
      setDraft(probability === null ? "" : String(probability));
      setError(S.invalidProbability);
      return;
    }
    if (parsed !== probability) void saveTerms({ probability: parsed });
  }

  return (
    <div className="space-y-2 border-b px-3 pb-3">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">{S.termsCurrency}</span>
        <div data-testid="deal-currency-select" className="min-w-0 flex-1">
          {locked ? (
            <Tip label={hasLines ? S.currencyLocked : S.adminOnly}>
              <span>
                <Select
                  value={currency}
                  onChange={() => undefined}
                  options={currencyOptions(codes)}
                  ariaLabel={S.termsCurrency}
                  disabled
                />
              </span>
            </Tip>
          ) : (
            <Select
              value={currency}
              onChange={(value) => void saveTerms({ currency: value })}
              options={currencyOptions(codes)}
              ariaLabel={S.termsCurrency}
              disabled={pending}
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">{S.termsProbability}</span>
        <Input
          data-testid="deal-probability-input"
          aria-label={S.termsProbability}
          inputMode="numeric"
          className="h-8 w-20 text-sm"
          value={draft}
          placeholder={stageProbability === null ? "100" : S.stageProbabilityHint(stageProbability)}
          disabled={!canEdit || pending}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitProbability}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitProbability();
          }}
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
