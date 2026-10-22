"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import type React from "react";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, parseCents } from "@/features/currency/money";
import type { ForecastDeal } from "@/features/forecast/forecast";

// One forecast card. Open cards are draggable to another month; won cards are a
// muted record of what closed, so they cannot be dragged.

interface Props {
  deal: ForecastDeal;
  baseCurrency: string;
  won?: boolean;
}

const S = {
  overdue: "Overdue",
  won: "Won",
  noValue: "-",
};

function amount(value: string | null, currency: string): string {
  return value === null ? S.noValue : formatMoney(parseCents(value), currency);
}

export function ForecastCard({ deal, baseCurrency, won = false }: Props): React.ReactNode {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    disabled: won,
  });
  const approx =
    deal.valueBase !== null && deal.currency !== baseCurrency
      ? `≈ ${formatMoney(parseCents(deal.valueBase), baseCurrency)}`
      : null;

  return (
    <div
      ref={setNodeRef}
      // Listeners only: the dnd attributes add role=button/tabindex, which would nest an
      // interactive wrapper around the card's link (axe nested-interactive).
      {...listeners}
      data-testid="forecast-card"
      data-deal-id={deal.id}
      style={{ opacity: isDragging ? 0.4 : undefined }}
      className={[
        "rounded-md border border-border bg-card p-2 text-sm transition-shadow duration-100 hover:shadow-card-hover",
        won ? "bg-muted/40" : "cursor-grab active:cursor-grabbing",
        deal.overdue && !won ? "border-destructive/50" : "",
      ]
        .join(" ")
        .trim()}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/deals/${deal.id}`}
          className={`min-w-0 flex-1 truncate font-medium hover:underline ${won ? "text-muted-foreground" : "text-link-record"}`}
        >
          {deal.title}
        </Link>
        {won ? (
          <Badge variant="success">{S.won}</Badge>
        ) : deal.overdue ? (
          <Badge variant="destructive">{S.overdue}</Badge>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="tabular-nums">{amount(deal.value, deal.currency)}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{deal.probability}%</span>
      </div>
      {approx !== null && <div className="text-xs text-muted-foreground">{approx}</div>}
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {deal.ownerName ?? ""} · {deal.stageName}
      </div>
    </div>
  );
}
