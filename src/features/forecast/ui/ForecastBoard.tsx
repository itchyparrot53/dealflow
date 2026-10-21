"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToastStore } from "@/features/feedback/toastStore";
import { moveDealToMonthAction } from "@/features/forecast/actions";
import type { Forecast, ForecastDeal } from "@/features/forecast/forecast";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import { ForecastColumn } from "./ForecastColumn";

interface Props {
  pipelines: Array<{ id: string; name: string }>;
}

const S = {
  heading: "Forecast",
  allPipelines: "All pipelines",
  months: "Months",
  includeWon: "Include won",
  previous: "Previous month",
  next: "Next month",
  empty: "No open deals close in this period.",
  noDate: (count: number) => `No close date (${count})`,
  moveFailed: "Could not move that deal. It stays where it was.",
  loading: "Loading the forecast...",
};

const MONTH_OPTIONS = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
];

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

// Overlay the optimistic moves on the fetched months: take every moved card out of
// its old month and put it in the target column. Totals catch up when the query
// refetches, which is the same moment the override is dropped.
function withMoves(data: Forecast, moves: Record<string, string>): Forecast {
  const movedIds = new Set(Object.keys(moves));
  if (movedIds.size === 0) return data;
  const cards = new Map<string, ForecastDeal>();
  for (const month of data.months) for (const deal of month.open) cards.set(deal.id, deal);
  const months = data.months.map((month) => ({
    ...month,
    open: month.open.filter((deal) => !movedIds.has(deal.id)),
  }));
  const firstMonth = data.months[0]?.month;
  for (const [dealId, month] of Object.entries(moves)) {
    const card = cards.get(dealId);
    const target = months.find((entry) => entry.month === month);
    if (card !== undefined && target !== undefined) {
      target.open.push({
        ...card,
        // Overdue only means "before the first month"; a card moved forward loses the badge.
        overdue: month === firstMonth ? card.overdue : false,
        expectedCloseDate: `${month}-15`,
      });
    }
  }
  // openCount stays the service's count until the refetch, so the optimistic card cannot
  // disagree with the totals beside it.
  return { ...data, months };
}

function findDeal(data: Forecast, id: string): boolean {
  return data.months.some((month) => month.open.some((deal) => deal.id === id));
}

export function ForecastBoard({ pipelines }: Props): React.ReactNode {
  const utils = trpc.useUtils();
  const [pipelineId, setPipelineId] = useState("");
  const [months, setMonths] = useState(6);
  const [includeWon, setIncludeWon] = useState(true);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Failures surface in the shared toast region instead of an ad-hoc inline alert (6.8).
  useEffect(() => {
    if (error !== null) useToastStore.getState().push({ message: error, tone: "error" });
  }, [error]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const query = trpc.forecast.get.useQuery({
    pipelineId: pipelineId === "" ? undefined : pipelineId,
    startMonth,
    months,
    includeWon,
  });

  function onDragEnd(event: DragEndEvent): void {
    const dealId = String(event.active.id);
    const target = event.over?.id;
    if (typeof target !== "string" || query.data === undefined) return;
    if (!findDeal(query.data, dealId)) return;
    if (moves[dealId] === target) return;
    setMoves((prev) => ({ ...prev, [dealId]: target }));
    setError(null);
    void (async () => {
      const result = await moveDealToMonthAction({ dealId, month: target }, readCsrfToken());
      if (!result.ok) {
        setMoves((prev) => {
          const next = { ...prev };
          delete next[dealId];
          return next;
        });
        setError(S.moveFailed);
        return;
      }
      await utils.forecast.get.invalidate();
      setMoves((prev) => {
        const next = { ...prev };
        delete next[dealId];
        return next;
      });
    })();
  }

  const data = query.data === undefined ? undefined : withMoves(query.data, moves);
  const isEmpty =
    data?.months.every((month) => month.open.length === 0 && month.won.length === 0) ?? false;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-52">
          <Select
            value={pipelineId}
            onChange={setPipelineId}
            options={[
              { value: "", label: S.allPipelines },
              ...pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name })),
            ]}
            ariaLabel={S.allPipelines}
          />
        </div>
        <div className="w-32">
          <Select
            value={String(months)}
            onChange={(value) => setMonths(Number(value))}
            options={MONTH_OPTIONS}
            ariaLabel={S.months}
          />
        </div>
        <span className="flex items-center gap-2 text-sm">
          <Switch checked={includeWon} onCheckedChange={setIncludeWon} label={S.includeWon} />
          {S.includeWon}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label={S.previous}
            onClick={() => setStartMonth((month) => shiftMonth(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={S.next}
            onClick={() => setStartMonth((month) => shiftMonth(month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {data === undefined ? (
        <p className="text-sm text-muted-foreground">{S.loading}</p>
      ) : (
        <>
          {isEmpty ? <p className="text-sm text-muted-foreground">{S.empty}</p> : null}
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div
              data-testid="forecast-board"
              className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2"
            >
              {data.months.map((month) => (
                <ForecastColumn key={month.month} month={month} baseCurrency={data.baseCurrency} />
              ))}
            </div>
          </DndContext>

          <section data-testid="forecast-no-date" className="rounded-md border bg-card p-3">
            <h2 className="text-sm font-semibold">{S.noDate(data.noDateCount)}</h2>
            {data.noDate.length === 0 ? null : (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {data.noDate.map((deal) => (
                  <li key={deal.id}>
                    <Link href={`/deals/${deal.id}`} className="text-primary hover:underline">
                      {deal.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
