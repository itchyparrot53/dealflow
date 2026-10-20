"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { ERROR_IDS } from "@/constants/errorIds";
import { PRODUCTS_STRINGS } from "@/constants/salesStrings";
import {
  dealTotals,
  formatMoney,
  lineNet,
  parseBp,
  parseCents,
  parseMilli,
} from "@/features/currency/money";
import { supportedCurrencyCodes } from "@/features/currency/schemas";
import { CollapsibleSection } from "@/features/deal-workspace/CollapsibleSection";
import {
  addDealLineAction,
  removeDealLineAction,
  updateDealLineAction,
} from "@/features/products/actions";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { DealTermsFields } from "./DealTermsFields";

const S = PRODUCTS_STRINGS;

interface Props {
  dealId: string;
  canEdit: boolean;
  baseCurrency: string;
}

const CODES = supportedCurrencyCodes();

type Field = "quantity" | "itemPrice" | "discountPercent" | "taxPercent";

function trimNumeric(value: string): string {
  const trimmed = value.replace(/\.?0+$/, "");
  return trimmed === "" ? "0" : trimmed;
}

function errorText(id: string, code?: string): string {
  switch (id) {
    case ERROR_IDS.CURRENCY_RATE_MISSING:
      return S.rateMissing(code ?? "that currency");
    case ERROR_IDS.PRODUCT_LINE_NOT_FOUND:
      return S.lineNotFound;
    case ERROR_IDS.PRODUCT_VALUE_CALCULATED:
      return S.calculatedValue;
    case ERROR_IDS.CURRENCY_CHANGE_WITH_LINES:
      return S.currencyLocked;
    case ERROR_IDS.PRODUCT_IN_USE:
      return S.inUse;
    case ERROR_IDS.PERM_DENIED:
      return S.adminOnly;
    default:
      return S.lineSaveFailed;
  }
}

function EditableCell({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onCommit: (next: string) => Promise<boolean>;
}): React.ReactNode {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="h-8 w-16 px-1 text-right text-xs tabular-nums"
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim();
        if (next === value) return;
        void onCommit(next).then((ok) => {
          if (!ok) setDraft(value);
        });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function DealProductsSection({ dealId, canEdit, baseCurrency }: Props): React.ReactNode {
  const router = useRouter();
  const utils = trpc.useUtils();
  const linesQuery = trpc.products.dealLines.useQuery({ dealId });
  const termsQuery = trpc.products.dealTerms.useQuery({ dealId });
  const catalog = trpc.products.list.useQuery({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => linesQuery.data ?? [], [linesQuery.data]);
  const currency = termsQuery.data?.currency ?? baseCurrency;
  const totals = useMemo(
    () =>
      dealTotals(
        lines.map((line) => ({
          qty: parseMilli(line.quantity),
          price: parseCents(line.itemPrice),
          discount: parseBp(line.discountPercent),
          tax: parseBp(line.taxPercent),
        })),
      ),
    [lines],
  );

  function refresh(): void {
    void utils.products.dealLines.invalidate({ dealId });
    void utils.products.dealTerms.invalidate({ dealId });
    router.refresh();
  }

  async function addProduct(productId: string): Promise<void> {
    setPending(true);
    setError(null);
    const result = await addDealLineAction({ dealId, productId }, readCsrfToken());
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id, result.error.code));
      return;
    }
    refresh();
  }

  async function updateLine(lineId: string, field: Field, next: string): Promise<boolean> {
    setPending(true);
    setError(null);
    const result = await updateDealLineAction({ lineId, [field]: next }, readCsrfToken());
    setPending(false);
    refresh();
    if (!result.ok) {
      setError(errorText(result.error.id, result.error.code));
      return false;
    }
    return true;
  }

  async function removeLine(lineId: string): Promise<void> {
    setPending(true);
    setError(null);
    const result = await removeDealLineAction({ lineId }, readCsrfToken());
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id, result.error.code));
      return;
    }
    refresh();
  }

  const options = (catalog.data ?? []).map((product) => ({
    value: product.id,
    label: `${product.name} (${product.price} ${product.currency})`,
  }));

  return (
    <section data-testid="deal-products-section">
      <CollapsibleSection title={S.sectionTitle} showFilter={false}>
        <div className="px-3 py-2">
          {termsQuery.data !== undefined && (
            <DealTermsFields
              dealId={dealId}
              currency={currency}
              stageProbability={termsQuery.data.stageProbability}
              probability={termsQuery.data.probability}
              hasLines={lines.length > 0}
              canEdit={canEdit}
              codes={CODES}
              onSaved={refresh}
            />
          )}

          {canEdit && (
            <div data-testid="deal-product-add" className="mt-2">
              <Combobox
                value=""
                onChange={(value) => void addProduct(value)}
                options={options}
                ariaLabel={S.addProduct}
                placeholder={S.addProduct}
                disabled={pending}
              />
            </div>
          )}

          {lines.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">{S.noLines}</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-1 font-medium">{S.name}</th>
                    <th className="px-1 py-1 text-right font-medium">{S.quantity}</th>
                    <th className="px-1 py-1 text-right font-medium">{S.price}</th>
                    <th className="px-1 py-1 text-right font-medium">{S.discount}</th>
                    <th className="px-1 py-1 text-right font-medium">{S.taxPercent}</th>
                    <th className="px-1 py-1 text-right font-medium">{S.net}</th>
                    <th className="py-1 pl-1" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const net = lineNet(
                      parseMilli(line.quantity),
                      parseCents(line.itemPrice),
                      parseBp(line.discountPercent),
                    );
                    return (
                      <tr
                        key={line.id}
                        data-testid="deal-product-row"
                        data-line-id={line.id}
                        className="border-t"
                      >
                        <td className="max-w-24 truncate py-1 pr-1">
                          <span className="text-xs">{line.productName}</span>
                        </td>
                        <td className="px-1 py-1">
                          <EditableCell
                            label={`${S.quantity} ${line.productName}`}
                            value={trimNumeric(line.quantity)}
                            disabled={!canEdit || pending}
                            onCommit={(next) => updateLine(line.id, "quantity", next)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <EditableCell
                            label={`${S.price} ${line.productName}`}
                            value={trimNumeric(line.itemPrice)}
                            disabled={!canEdit || pending}
                            onCommit={(next) => updateLine(line.id, "itemPrice", next)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <EditableCell
                            label={`${S.discount} ${line.productName}`}
                            value={trimNumeric(line.discountPercent)}
                            disabled={!canEdit || pending}
                            onCommit={(next) => updateLine(line.id, "discountPercent", next)}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <EditableCell
                            label={`${S.taxPercent} ${line.productName}`}
                            value={trimNumeric(line.taxPercent)}
                            disabled={!canEdit || pending}
                            onCommit={(next) => updateLine(line.id, "taxPercent", next)}
                          />
                        </td>
                        <td className="px-1 py-1 text-right tabular-nums">
                          {formatMoney(net, currency)}
                        </td>
                        <td className="py-1 pl-1 text-right">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`${S.remove} ${line.productName}`}
                              disabled={pending}
                              onClick={() => void removeLine(line.id)}
                            >
                              {S.remove}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-2 flex flex-wrap justify-between gap-2 border-t pt-2 text-xs">
            <span>
              {S.net}{" "}
              <span data-testid="deal-products-net" className="font-medium tabular-nums">
                {formatMoney(totals.net, currency)}
              </span>
            </span>
            <span>
              {S.tax}{" "}
              <span data-testid="deal-products-tax" className="font-medium tabular-nums">
                {formatMoney(totals.tax, currency)}
              </span>
            </span>
            <span>
              {S.gross}{" "}
              <span data-testid="deal-products-gross" className="font-medium tabular-nums">
                {formatMoney(totals.gross, currency)}
              </span>
            </span>
          </div>

          {error !== null && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </CollapsibleSection>
    </section>
  );
}
