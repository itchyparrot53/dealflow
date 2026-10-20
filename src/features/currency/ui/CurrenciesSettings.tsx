"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState, useTransition } from "react";
import {
  SETTINGS_TABLE_CELL,
  SETTINGS_TABLE_HEAD,
  SETTINGS_TABLE_HEADER_CELL,
  SETTINGS_TABLE_ROW,
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
} from "@/app/(app)/settings/SettingsSurface";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ERROR_IDS } from "@/constants/errorIds";
import { CURRENCY_STRINGS } from "@/constants/salesStrings";
import {
  deleteRateAction,
  saveRateAction,
  setBaseCurrencyAction,
} from "@/features/currency/actions";
import { readCsrfToken } from "@/utils/csrfCookie";

interface RateRow {
  code: string;
  rate: string;
  updatedAt: string;
}

interface Props {
  base: string;
  rates: RateRow[];
  codes: string[];
}

const S = CURRENCY_STRINGS;
const displayNames = new Intl.DisplayNames(["en"], { type: "currency" });

function currencyLabel(code: string): string {
  return S.currencyLabel(code, displayNames.of(code) ?? code);
}

// "1.08000000" -> "1.08", "1.00000000" -> "1". The database keeps eight
// decimals; the settings table should read like the number the user typed.
function rateText(rate: string): string {
  const trimmed = rate.replace(/\.?0+$/, "");
  return trimmed === "" ? "0" : trimmed;
}

function errorText(id: string): string {
  switch (id) {
    case ERROR_IDS.CURRENCY_BASE_RATE:
      return S.baseRateRefused;
    case ERROR_IDS.CURRENCY_UNKNOWN:
      return S.unknownCode;
    case ERROR_IDS.CURRENCY_INPUT_INVALID:
      return S.invalidRate;
    case ERROR_IDS.AUTH_SESSION_DEAD:
    case "E_AUTH_CSRF":
      return S.sessionExpired;
    default:
      return S.saveFailed;
  }
}

export function CurrenciesSettings({ base, rates, codes }: Props): React.ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingBase, setPendingBase] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newRate, setNewRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const codeOptions = codes.map((code) => ({ value: code, label: currencyLabel(code) }));
  const rateOptions = codeOptions.filter((option) => option.value !== base);

  function chooseBase(code: string): void {
    if (code === base) return;
    setError(null);
    setPendingBase(code);
  }

  function confirmBase(): void {
    const code = pendingBase;
    setPendingBase(null);
    if (code === null) return;
    startTransition(async () => {
      const result = await setBaseCurrencyAction({ code }, readCsrfToken());
      if (!result.ok) {
        setError(errorText(result.error.id));
        return;
      }
      router.refresh();
    });
  }

  function addRate(): void {
    const code = newCode;
    const rate = newRate.trim();
    if (code === "" || rate === "") {
      setError(S.invalidRate);
      return;
    }
    startTransition(async () => {
      const result = await saveRateAction({ code, rate }, readCsrfToken());
      if (!result.ok) {
        setError(errorText(result.error.id));
        return;
      }
      setNewRate("");
      setError(null);
      router.refresh();
    });
  }

  function removeRate(code: string): void {
    startTransition(async () => {
      const result = await deleteRateAction(code, readCsrfToken());
      if (!result.ok) {
        setError(errorText(result.error.id));
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsCardHeader title={S.base} description={S.baseDescription} />
        <SettingsCardBody>
          <div data-testid="currencies-base-select" className="max-w-xs">
            <Select
              value={base}
              onChange={chooseBase}
              options={codeOptions}
              ariaLabel={S.base}
              disabled={pending}
            />
          </div>
        </SettingsCardBody>
      </SettingsCard>

      <SettingsCard>
        <SettingsCardHeader title={S.rates} description={S.ratesDescription} />
        {rates.length === 0 ? (
          <SettingsCardBody>
            <p className="text-sm text-muted-foreground">{S.empty}</p>
          </SettingsCardBody>
        ) : (
          <table className="w-full text-sm">
            <thead className={SETTINGS_TABLE_HEAD}>
              <tr>
                <th className={SETTINGS_TABLE_HEADER_CELL}>{S.code}</th>
                <th className={SETTINGS_TABLE_HEADER_CELL}>{S.rate}</th>
                <th className={SETTINGS_TABLE_HEADER_CELL}>{S.updated}</th>
                <th className={SETTINGS_TABLE_HEADER_CELL} aria-label={S.actions} />
              </tr>
            </thead>
            <tbody>
              {rates.map((row) => (
                <tr
                  key={row.code}
                  data-testid="currency-rate-row"
                  data-code={row.code}
                  className={SETTINGS_TABLE_ROW}
                >
                  <td className={SETTINGS_TABLE_CELL}>{currencyLabel(row.code)}</td>
                  <td className={SETTINGS_TABLE_CELL}>
                    {S.rateLine(row.code, rateText(row.rate), base)}
                  </td>
                  <td className={SETTINGS_TABLE_CELL}>{row.updatedAt.slice(0, 10)}</td>
                  <td className={`${SETTINGS_TABLE_CELL} text-right`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-label={`${S.delete} ${row.code}`}
                      onClick={() => removeRate(row.code)}
                    >
                      {S.delete}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <SettingsCardBody className="border-t">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <span className="mb-1.5 block text-sm font-medium">{S.code}</span>
              <Select
                value={newCode}
                onChange={setNewCode}
                options={rateOptions}
                ariaLabel={S.code}
                placeholder={S.addRate}
                disabled={pending}
              />
            </div>
            <label className="block" htmlFor="currency-rate-new">
              <span className="mb-1.5 block text-sm font-medium">{S.rate}</span>
              <Input
                id="currency-rate-new"
                data-testid="currency-rate-input"
                aria-label={S.rate}
                inputMode="decimal"
                placeholder={S.ratePlaceholder}
                value={newRate}
                onChange={(event) => setNewRate(event.target.value)}
                disabled={pending}
                className="w-40"
              />
            </label>
            <Button
              type="button"
              size="sm"
              data-testid="currency-rate-save"
              disabled={pending}
              onClick={addRate}
            >
              {pending ? S.saving : S.save}
            </Button>
          </div>
          {error !== null && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </SettingsCardBody>
      </SettingsCard>

      <ConfirmDialog
        open={pendingBase !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBase(null);
        }}
        title={S.baseChangeTitle}
        description={S.baseChangeDescription}
        confirmLabel={S.baseChangeConfirm}
        onConfirm={confirmBase}
        pending={pending}
      />
    </div>
  );
}
