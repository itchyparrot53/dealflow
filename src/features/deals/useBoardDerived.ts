import { formatCents } from "@/features/currency/money";
import { type MoneyDeal, type RateMap, summarize } from "@/features/currency/totals";
import { applyConditions } from "./boardConditions";
import { distinctBoardOwners, matchesOwnerFilter } from "./boardFilter";
import type { Condition } from "./boardQuickFilter";
import type { BoardSortKey, SortDirection } from "./boardSort";
import { sortBoardCards } from "./boardSort";
import type { StageMeta } from "./boardTypes";
import type { BoardCard } from "./dealRepo";

interface DerivedInput {
  liveCards: BoardCard[];
  stages: StageMeta[];
  selectedOwnerId: string | null;
  conditions: Condition[];
  sortKey: BoardSortKey;
  sortDirection: SortDirection;
  // Base currency and manual rates. Optional so older board tests keep compiling; an
  // absent map treats every card as base currency with rate 1.
  rateMap?: RateMap;
}

export interface StageTotals {
  dealCount: number;
  total: string;
  weighted: string;
  excluded: string[];
}

interface Derived {
  owners: ReturnType<typeof distinctBoardOwners>;
  shownCards: BoardCard[];
  sumsByStage: Map<string, StageTotals>;
  boardTotal: string;
  sortedByStage: Map<string, BoardCard[]>;
}

// Board display derivations, all downstream of the client-side owner/saved-filter/quick-condition
// narrowing. Drag math reads the raw liveCards, not these, so filtering/sorting is display-only.
// No manual useMemo: React Compiler (enabled repo-wide) memoizes each derivation from its reactive
// inputs, so the hand-written memos were redundant.
export function useBoardDerived(input: DerivedInput): Derived {
  const { liveCards, stages, selectedOwnerId, conditions, sortKey, sortDirection } = input;
  const rateMap = input.rateMap ?? { base: "USD", rates: new Map() };

  const owners = distinctBoardOwners(liveCards);

  const shownCards = applyConditions(
    liveCards.filter((c) => matchesOwnerFilter(c, selectedOwnerId)),
    conditions,
  );

  // Convert to base and weight per deal (the same summarize the list and forecast use),
  // never summing raw amounts from different currencies.
  const moneyDeal = (c: BoardCard): MoneyDeal => ({
    id: c.id,
    value: c.value,
    currency: c.currency ?? rateMap.base,
    probability: c.probability ?? 100,
  });
  const byStage = new Map<string, MoneyDeal[]>();
  for (const c of shownCards) {
    const list = byStage.get(c.stageId) ?? [];
    list.push(moneyDeal(c));
    byStage.set(c.stageId, list);
  }
  const sumsByStage = new Map<string, StageTotals>();
  for (const [stageId, deals] of byStage) {
    const summary = summarize(deals, rateMap);
    sumsByStage.set(stageId, {
      dealCount: deals.length,
      total: formatCents(summary.total),
      weighted: formatCents(summary.weighted),
      excluded: [...new Set(summary.excluded.map((row) => row.currency))],
    });
  }

  const boardSummary = summarize(shownCards.map(moneyDeal), rateMap);
  const boardTotal = formatCents(boardSummary.total);

  const sortedByStage = new Map<string, BoardCard[]>(stages.map((s) => [s.id, []]));
  for (const c of shownCards) sortedByStage.get(c.stageId)?.push(c);
  for (const s of stages) {
    sortedByStage.set(s.id, sortBoardCards(sortedByStage.get(s.id) ?? [], sortKey, sortDirection));
  }

  return { owners, shownCards, sumsByStage, boardTotal, sortedByStage };
}
