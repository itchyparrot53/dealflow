"use client";

import { useDroppable } from "@dnd-kit/core";
import type React from "react";
import { Tip } from "@/components/ui/tooltip";
import { parseCents } from "@/features/currency/money";
import { formatMoney } from "@/lib/format/number";
import type { ForecastMonth } from "@/features/forecast/forecast";
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
        "flex min-w-[248px] flex-1 flex-col gap-2 rounded-lg bg-canvas-subtle p-2",
        isOver ? "ring-2 ring-ring/40" : "",
      ]
        .join(" ")
        .trim()}
    >
      <header className="px-2 pb-1 pt-2">
        <h2 className="truncate text-base font-semibold text-foreground">{month.label}</h2>
        <div className="mt-1 grid grid-cols-3 gap-1 text-meta text-muted-foreground">
          <div>
            <div>{S.total}</div>
            <div data-testid="forecast-month-total" className="font-medium tabular-nums">
              {money(month.total, baseCurrency)}
            </div>
          </div>
          <div>
            <div>{S.weighted}</div>
            <div data-testid="forecast-month-weighted" className="font-medium tabular-nums">
              {money(month.weighted, baseCurrency)}
            </div>
          </div>
          <div>
            <div>{S.won}</div>
            <div data-testid="forecast-month-won" className="font-medium tabular-nums">
              {money(month.wonTotal, baseCurrency)}
            </div>
          </div>
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
