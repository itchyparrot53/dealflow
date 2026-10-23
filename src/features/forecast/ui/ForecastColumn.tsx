"use client";

import { useDroppable } from "@dnd-kit/core";
import type React from "react";
import { Tip } from "@/components/ui/tooltip";
import { parseCents } from "@/features/currency/money";
import type { ForecastMonth } from "@/features/forecast/forecast";
import { formatMoney, formatMoneyCompact } from "@/lib/format/number";
import { ForecastCard } from "./ForecastCard";

interface Props {
  month: ForecastMonth;
  baseCurrency: string;
}

const S = {
  total: "Total",
  weighted: "Weighted",
  won: "Won",
  excluded: (count: number) => `${count} excluded`,
  empty: "Nothing closes this month.",
};

function money(value: string, currency: string): string {
  return formatMoney(Number(parseCents(value)), currency);
}

// 6.7.3: the compact form when the full value would not fit nine characters, with the full amount
// in the tooltip.
function valueText(value: string, currency: string): string {
  const full = money(value, currency);
  return full.length > 9 ? formatMoneyCompact(Number(parseCents(value)), currency) : full;
}

function ForecastTotal({
  label,
  testId,
  value,
  currency,
}: {
  label: string;
  testId: string;
  value: string;
  currency: string;
}): React.ReactNode {
  return (
    <div className="min-w-0">
      <div>{label}</div>
      <Tip label={money(value, currency)}>
        <div
          data-testid={testId}
          className="truncate text-sm font-semibold tabular-nums text-foreground"
        >
          {valueText(value, currency)}
        </div>
      </Tip>
    </div>
  );
}

export function ForecastColumn({ month, baseCurrency }: Props): React.ReactNode {
  const { setNodeRef, isOver } = useDroppable({ id: month.month });
  const excludedCurrencies = [...new Set(month.excluded.map((deal) => deal.currency))];

  return (
    <section
      ref={setNodeRef}
      data-testid="forecast-column"
      data-month={month.month}
      aria-label={month.label}
      className={[
        "flex min-w-[240px] flex-1 flex-col gap-2 rounded-lg bg-canvas-subtle p-2",
        isOver ? "ring-2 ring-ring/40" : "",
      ]
        .join(" ")
        .trim()}
    >
      <header className="px-2 pb-1 pt-2">
        <h2 className="truncate text-base font-semibold text-foreground">{month.label}</h2>
        <div className="mt-1 grid grid-cols-3 gap-2 text-meta text-muted-foreground">
          <ForecastTotal
            label={S.total}
            testId="forecast-month-total"
            value={month.total}
            currency={baseCurrency}
          />
          <ForecastTotal
            label={S.weighted}
            testId="forecast-month-weighted"
            value={month.weighted}
            currency={baseCurrency}
          />
          <ForecastTotal
            label={S.won}
            testId="forecast-month-won"
            value={month.wonTotal}
            currency={baseCurrency}
          />
        </div>
        {excludedCurrencies.length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            <Tip label={`No rate for ${excludedCurrencies.join(", ")}`}>
              <span data-testid="totals-excluded" className="cursor-default">
                {S.excluded(month.excluded.length)}
              </span>
            </Tip>
          </div>
        )}
      </header>

      {month.open.length === 0 && month.won.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">{S.empty}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        {month.open.map((deal) => (
          <ForecastCard key={deal.id} deal={deal} baseCurrency={baseCurrency} />
        ))}
        {month.won.map((deal) => (
          <ForecastCard key={deal.id} deal={deal} baseCurrency={baseCurrency} won />
        ))}
      </div>
    </section>
  );
}
