import type { ExcludedCurrency } from "@/types/stats";

// Currencies a money read had to leave out because no rate is stored. Every stats and goal
// aggregation collects them the same way, so the UI note is built from one shape.

export function addExcluded(map: Map<string, number>, currency: string, count: number): void {
  if (count === 0) return;
  map.set(currency, (map.get(currency) ?? 0) + count);
}

export function excludedList(map: Map<string, number>): ExcludedCurrency[] {
  return [...map.entries()]
    .map(([currency, count]) => ({ currency, count }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
